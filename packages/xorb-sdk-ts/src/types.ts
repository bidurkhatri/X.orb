/** Default API endpoint — x.orb is the primary agent-facing domain */
export const XORB_DEFAULT_API_URL = 'https://x.orb'
/** Fallback API endpoint — traditional DNS, always reachable */
export const XORB_FALLBACK_API_URL = 'https://api.xorb.xyz'

export interface XorbConfig {
  /** API endpoint. Defaults to x.orb (HNS gateway). Falls back to api.xorb.xyz if unreachable. */
  apiUrl?: string
  apiKey: string
  timeout?: number
  /** Disable automatic fallback to api.xorb.xyz if x.orb is unreachable. Default: false */
  disableFallback?: boolean
}

export type AgentRole = 'TRADER' | 'RESEARCHER' | 'MONITOR' | 'CODER' | 'GOVERNANCE_ASSISTANT' | 'FILE_INDEXER' | 'RISK_AUDITOR'
export type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired'
export type ReputationTier = 'UNTRUSTED' | 'NOVICE' | 'RELIABLE' | 'TRUSTED' | 'ELITE'

export interface Agent {
  agentId: string
  name: string
  role: AgentRole
  sponsorAddress: string
  sessionWalletAddress: string
  stakeBond: string
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

export interface CreateAgentParams {
  name: string
  role: AgentRole
  sponsor_address: string
  stake_bond?: string
  expiry_days?: number
  description?: string
}

export interface ExecuteActionParams {
  agent_id: string
  action: string
  tool: string
  params?: Record<string, unknown>
}

export interface GateResult {
  gate: string
  passed: boolean
  reason?: string
  latency_ms: number
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

export interface ReputationInfo {
  agent_id: string
  score: number
  tier: ReputationTier
  total_actions: number
  slash_events: number
}

export interface WebhookSubscription {
  id: string
  url: string
  event_types: string[]
  secret: string
  active: boolean
}

export interface AuditLog {
  agent_id: string
  events: number
  recent_events: unknown[]
  violations: {
    count: number
    total_slashed: string
    records: unknown[]
  }
  reputation: unknown
}

export interface PricingEndpoint {
  endpoint: string
  price_usdc: number
  description: string
}

export interface XorbError {
  error: string
  request_id?: string
  status?: number
}
