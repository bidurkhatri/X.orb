-- ==========================================
-- Agent Audit Logs Table
-- Used by AgentAuditLogService.ts to record AI agent actions
-- ==========================================
CREATE TABLE agent_audits (
    "logId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "agentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "payloadStr" TEXT,
    "reputationDelta" INTEGER DEFAULT 0,
    "cidLocator" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security: Row Level Security
ALTER TABLE agent_audits ENABLE ROW LEVEL SECURITY;

-- Only the service role (Edge Functions) can insert audit logs
-- Standard authenticated users can read audit trails for transparency
CREATE POLICY "Authenticated users can view agent audits"
ON agent_audits FOR SELECT
TO authenticated
USING (true);

-- Create index for fast agent-specific queries
CREATE INDEX idx_agent_audits_agent_id ON agent_audits ("agentId");
CREATE INDEX idx_agent_audits_action_type ON agent_audits ("actionType");
