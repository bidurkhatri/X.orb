-- ================================================================
-- SylOS Supabase Migration — All Required Tables
-- Run this in the Supabase SQL Editor to fix 404 errors
-- ================================================================

-- ─── Agent Registry ───
CREATE TABLE IF NOT EXISTS agent_registry (
    agent_id        TEXT PRIMARY KEY,
    sponsor_address TEXT NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'CODER',
    stake_bond      TEXT NOT NULL DEFAULT '0',
    slashed_amount  TEXT NOT NULL DEFAULT '0',
    permission_hash TEXT DEFAULT '',
    permission_scope JSONB DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'active',
    spawned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    reputation_score INTEGER NOT NULL DEFAULT 1000,
    reputation_tier TEXT NOT NULL DEFAULT 'NOVICE',
    session_wallet  TEXT,
    total_actions   INTEGER NOT NULL DEFAULT 0,
    last_active_at  TIMESTAMPTZ,
    llm_provider    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sponsor ON agent_registry (sponsor_address);
CREATE INDEX IF NOT EXISTS idx_agent_status ON agent_registry (status);

-- ─── Agent Actions (Audit Log) ───
CREATE TABLE IF NOT EXISTS agent_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    action_type     TEXT NOT NULL,
    tool_name       TEXT,
    reputation_delta INTEGER NOT NULL DEFAULT 0,
    reputation_before INTEGER,
    reputation_after INTEGER,
    details         JSONB DEFAULT '{}',
    ipfs_cid        TEXT,
    tx_hash         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_agent ON agent_actions (agent_id);
CREATE INDEX IF NOT EXISTS idx_actions_type ON agent_actions (action_type);

-- ─── Agent Audits (Kill Switch / AuditLogService) ───
CREATE TABLE IF NOT EXISTS agent_audits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    tool_name       TEXT,
    description     TEXT,
    reputation_delta INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    ipfs_cid        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audits_agent ON agent_audits (agent_id);

-- ─── Civilization Stats (Dashboard) ───
CREATE TABLE IF NOT EXISTS civilization_stats (
    id                      TEXT PRIMARY KEY DEFAULT 'global',
    total_agents            INTEGER NOT NULL DEFAULT 0,
    active_agents           INTEGER NOT NULL DEFAULT 0,
    paused_agents           INTEGER NOT NULL DEFAULT 0,
    revoked_agents          INTEGER NOT NULL DEFAULT 0,
    total_stake_locked      TEXT NOT NULL DEFAULT '0',
    total_slashed           TEXT NOT NULL DEFAULT '0',
    total_actions_24h       INTEGER NOT NULL DEFAULT 0,
    total_violations_24h    INTEGER NOT NULL DEFAULT 0,
    avg_reputation          INTEGER NOT NULL DEFAULT 1000,
    economy_volume_24h      TEXT NOT NULL DEFAULT '0',
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the global stats row
INSERT INTO civilization_stats (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- ─── Transactions ───
CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_address    TEXT NOT NULL,
    to_address      TEXT NOT NULL,
    value           TEXT NOT NULL DEFAULT '0',
    token           TEXT DEFAULT 'POL',
    tx_hash         TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions (from_address);
CREATE INDEX IF NOT EXISTS idx_tx_to ON transactions (to_address);

-- ─── Decentralized Files (VFS cloud backup) ───
CREATE TABLE IF NOT EXISTS decentralized_files (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL,
    file_name           TEXT NOT NULL,
    file_path           TEXT,
    file_size           BIGINT DEFAULT 0,
    mime_type           TEXT,
    ipfs_cid            TEXT,
    content             TEXT,
    upload_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user ON decentralized_files (user_id);

-- ─── Community Posts ───
CREATE TABLE IF NOT EXISTS community_posts (
    id                  TEXT PRIMARY KEY,
    channel_id          TEXT NOT NULL DEFAULT 'general',
    author_id           TEXT NOT NULL,
    author_name         TEXT NOT NULL,
    author_role         TEXT NOT NULL DEFAULT 'CODER',
    author_reputation   INTEGER NOT NULL DEFAULT 1000,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL DEFAULT '',
    upvotes             INTEGER NOT NULL DEFAULT 0,
    downvotes           INTEGER NOT NULL DEFAULT 0,
    voted_by            JSONB NOT NULL DEFAULT '{}',
    reply_count         INTEGER NOT NULL DEFAULT 0,
    pinned              BOOLEAN NOT NULL DEFAULT FALSE,
    tags                TEXT[] DEFAULT '{}',
    created_at          BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_posts_channel ON community_posts (channel_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON community_posts (author_id);

-- ─── Community Replies ───
CREATE TABLE IF NOT EXISTS community_replies (
    id                  TEXT PRIMARY KEY,
    post_id             TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_id           TEXT NOT NULL,
    author_name         TEXT NOT NULL,
    author_role         TEXT NOT NULL DEFAULT 'CODER',
    body                TEXT NOT NULL DEFAULT '',
    upvotes             INTEGER NOT NULL DEFAULT 0,
    downvotes           INTEGER NOT NULL DEFAULT 0,
    voted_by            JSONB NOT NULL DEFAULT '{}',
    created_at          BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_replies_post ON community_replies (post_id);

-- ─── RLS Policies (allow all for now — tighten for production) ───
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE civilization_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decentralized_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;

-- Public read/write for all (using anon key from client)
CREATE POLICY "Allow all" ON agent_registry FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON agent_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON agent_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON civilization_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON decentralized_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON community_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON community_replies FOR ALL USING (true) WITH CHECK (true);
