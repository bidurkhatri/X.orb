// Agent types
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
  maxFundsPerAction: string
  fileAccess: 'none' | 'read' | 'readwrite'
}

export interface AgentProfile {
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

// API types
export interface ApiKey {
  id: string
  keyPrefix: string
  ownerAddress: string
  name: string
  scopes: ApiKeyScope[]
  rateLimitPerMinute: number
  isActive: boolean
  createdAt: string
  expiresAt?: string
}

export type ApiKeyScope =
  | 'agents:read'
  | 'agents:write'
  | 'actions:write'
  | 'reputation:read'
  | 'audit:read'
  | 'webhooks:manage'

// Pipeline types
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

// Webhook types
export interface WebhookSubscription {
  id: string
  sponsorAddress: string
  url: string
  eventTypes: string[]
  secret: string
  active: boolean
  createdAt: string
}

export interface WebhookPayload {
  id: string
  type: string
  created_at: string
  data: Record<string, unknown>
}

// Event types
export type XorbEventType =
  | 'agent.registered'
  | 'agent.paused'
  | 'agent.resumed'
  | 'agent.revoked'
  | 'action.approved'
  | 'action.blocked'
  | 'action.verified'
  | 'reputation.changed'
  | 'reputation.tier_changed'
  | 'agent.warned'
  | 'agent.slashed'
  | 'agent.suspended'
  | 'listing.created'
  | 'engagement.started'
  | 'engagement.completed'
