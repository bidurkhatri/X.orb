export type AgentRole =
  | 'TRADER'
  | 'RESEARCHER'
  | 'MONITOR'
  | 'CODER'
  | 'GOVERNANCE_ASSISTANT'
  | 'FILE_INDEXER'
  | 'RISK_AUDITOR'

export type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired'

export type ReputationTier = 'UNTRUSTED' | 'NOVICE' | 'RELIABLE' | 'TRUSTED' | 'ELITE'

export interface PermissionScope {
  allowedTools: string[]
  allowedContracts: string[]
  maxActionsPerHour: number
  canTransferFunds: boolean
  maxFundsPerAction: string // serialized bigint (avoid BigInt for JSON compat)
  fileAccess: 'none' | 'read' | 'readwrite'
}

export interface RegisteredAgent {
  agentId: string
  name: string
  role: AgentRole
  sponsorAddress: string
  sessionWalletAddress: string
  stakeBond: string
  permissionScope: PermissionScope
  reputation: number
  reputationTier: ReputationTier
  status: AgentStatus
  createdAt: number
  expiresAt: number
  lastActiveAt: number
  totalActionsExecuted: number
  slashEvents: number
  description: string
}

export interface SpawnAgentConfig {
  name: string
  role: AgentRole
  sponsorAddress: string
  stakeBond?: string
  expiryDays?: number
  description?: string
  customPermissions?: Partial<PermissionScope>
}

export interface GateResult {
  gate: string
  passed: boolean
  reason?: string
  latency_ms: number
}

export interface PipelineContext {
  agentId: string
  action: string
  tool: string
  params: unknown
  agent?: RegisteredAgent
  gateResults: GateResult[]
  startTime: number
}

export interface PipelineResult {
  action_id: string
  agent_id: string
  approved: boolean
  gates: GateResult[]
  reputation_delta: number
  audit_hash: string
  timestamp: string
  latency_ms: number
}
