-- Slash Records: Log of all slashing events
CREATE TABLE IF NOT EXISTS slash_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    violation_type TEXT NOT NULL CHECK (violation_type IN (
        'RATE_LIMIT_EXCEEDED', 'PERMISSION_VIOLATION', 'FUND_MISUSE', 'CRITICAL_FAULT'
    )),
    slash_amount TEXT NOT NULL,             -- wei string
    reputation_penalty INTEGER NOT NULL,
    evidence TEXT,                          -- IPFS CID or description
    reporter_address TEXT NOT NULL,
    tx_hash TEXT,                           -- on-chain slash tx
    auto_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slash_agent ON slash_records(agent_id);
CREATE INDEX IF NOT EXISTS idx_slash_time ON slash_records(created_at DESC);

ALTER TABLE slash_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view slash records" ON slash_records
    FOR SELECT USING (true);

CREATE POLICY "Service role can insert" ON slash_records
    FOR INSERT WITH CHECK (
        current_setting('role') = 'service_role'
    );
