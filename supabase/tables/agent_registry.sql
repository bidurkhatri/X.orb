-- Agent Registry: Off-chain index of on-chain agent state
-- Synced from AgentRegistry.sol events via indexer
CREATE TABLE IF NOT EXISTS agent_registry (
    agent_id TEXT PRIMARY KEY,              -- bytes32 from contract
    sponsor_address TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR')),
    stake_bond TEXT NOT NULL,               -- wei string
    slashed_amount TEXT NOT NULL DEFAULT '0',
    permission_hash TEXT NOT NULL,
    permission_scope JSONB,                 -- full permission JSON (off-chain)
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Revoked', 'Expired')),
    spawned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    reputation_score INTEGER NOT NULL DEFAULT 5000 CHECK (reputation_score >= 0 AND reputation_score <= 10000),
    reputation_tier TEXT GENERATED ALWAYS AS (
        CASE
            WHEN reputation_score < 1000 THEN 'UNTRUSTED'
            WHEN reputation_score < 3000 THEN 'NOVICE'
            WHEN reputation_score < 6000 THEN 'RELIABLE'
            WHEN reputation_score < 8500 THEN 'TRUSTED'
            ELSE 'ELITE'
        END
    ) STORED,
    session_wallet TEXT,
    total_actions INTEGER NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    llm_provider TEXT,                      -- off-chain only: OpenAI, Groq, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_sponsor ON agent_registry(sponsor_address);
CREATE INDEX IF NOT EXISTS idx_agent_status ON agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_agent_role ON agent_registry(role);
CREATE INDEX IF NOT EXISTS idx_agent_reputation ON agent_registry(reputation_score DESC);

-- RLS: Sponsors can see their own agents, public can see active agents
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active agents" ON agent_registry
    FOR SELECT USING (status = 'Active');

CREATE POLICY "Sponsors can view all their agents" ON agent_registry
    FOR SELECT USING (
        sponsor_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    );

CREATE POLICY "Service role can manage all" ON agent_registry
    FOR ALL USING (
        current_setting('role') = 'service_role'
    );
