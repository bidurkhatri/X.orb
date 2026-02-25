-- Agent Actions: Log of every agent action for audit and reputation calculation
CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    action_type TEXT NOT NULL CHECK (action_type IN (
        'TOOL_SUCCESS', 'TASK_COMPLETION', 'TOOL_FAILURE',
        'TASK_FAILURE', 'RATE_LIMIT_VIOLATION', 'PERMISSION_VIOLATION',
        'LLM_PROMPT', 'TX_SIGN_REQUEST', 'FILE_ACCESS', 'AGENT_CHAT'
    )),
    tool_name TEXT,
    reputation_delta INTEGER NOT NULL DEFAULT 0,
    reputation_before INTEGER,
    reputation_after INTEGER,
    details JSONB,                          -- tool call params, results, errors
    ipfs_cid TEXT,                          -- for critical actions pinned to IPFS
    tx_hash TEXT,                           -- if action resulted in on-chain tx
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_agent ON agent_actions(agent_id);
CREATE INDEX IF NOT EXISTS idx_action_type ON agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_action_time ON agent_actions(created_at DESC);

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view actions of active agents" ON agent_actions
    FOR SELECT USING (true);

CREATE POLICY "Service role can insert" ON agent_actions
    FOR INSERT WITH CHECK (
        current_setting('role') = 'service_role'
    );
