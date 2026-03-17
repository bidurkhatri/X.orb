-- 001_base_tables.sql
-- Core tables for the X.orb platform.
-- Must run before 002_xorb_schema.sql (which adds columns to these tables).

-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════
-- Agent Registry — on-chain agent mirror
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_registry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT UNIQUE NOT NULL,          -- bytes32 hex from on-chain
    sponsor         TEXT NOT NULL,                  -- sponsor wallet address
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'MONITOR',
    stake_bond      NUMERIC(20,6) NOT NULL DEFAULT 0,
    slashed_amount  NUMERIC(20,6) NOT NULL DEFAULT 0,
    permission_hash TEXT,                           -- keccak256 of permission scope JSON
    status          TEXT NOT NULL DEFAULT 'active', -- active | paused | revoked | expired
    spawned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    reputation_score INTEGER NOT NULL DEFAULT 5000,
    session_wallet  TEXT,
    total_actions   INTEGER NOT NULL DEFAULT 0,
    last_active_at  TIMESTAMPTZ DEFAULT now(),
    identity_cid    TEXT,                           -- IPFS CID of agent identity profile
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_registry_agent_id ON agent_registry(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_registry_sponsor ON agent_registry(sponsor);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry(status);

-- ═══════════════════════════════════════════
-- Agent Actions — audit log of every action
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS agent_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL REFERENCES agent_registry(agent_id),
    action          TEXT NOT NULL,                  -- action name / description
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | blocked
    approved        BOOLEAN DEFAULT true,
    tool            TEXT,                           -- tool name if applicable
    gate_results    JSONB,                         -- JSON of per-gate pass/fail
    latency_ms      INTEGER DEFAULT 0,
    audit_hash      TEXT,                          -- SHA-256 of action payload
    ip_address      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_agent_id ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions(created_at DESC);

-- ═══════════════════════════════════════════
-- API Keys — authentication for SDK / API
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash        TEXT UNIQUE NOT NULL,           -- SHA-256 hash of the raw key
    owner           TEXT NOT NULL,                  -- wallet address or user identifier
    label           TEXT,                           -- human-readable label
    scopes          TEXT[] DEFAULT '{}',            -- permitted scopes (e.g., agent:read, agent:write)
    rate_limit      INTEGER NOT NULL DEFAULT 1000,  -- requests per month
    usage_count     INTEGER NOT NULL DEFAULT 0,
    last_used_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner);

-- ═══════════════════════════════════════════
-- Updated-at trigger (reusable)
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER trg_agent_registry_updated_at
        BEFORE UPDATE ON agent_registry
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER trg_api_keys_updated_at
        BEFORE UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
