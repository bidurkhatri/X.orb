/** Shared types for dashboard — matches API response shapes */

export interface Agent {
  agentId: string
  name: string
  scope?: string
  permissionScope?: string
  role?: string
  sponsorAddress: string
  stakeBond: string
  trustScore?: number
  reputation?: number
  trustSource?: string
  status: 'active' | 'paused' | 'revoked' | 'expired'
  createdAt: number
  expiresAt: number
  lastActiveAt: number
  totalActionsExecuted: number
  slashEvents: number
  description?: string
  allowedTools?: string[]
  reputationTier?: string
  sessionWalletAddress?: string
}

export interface XorbEvent {
  id: string
  type: string
  agentId: string
  data: Record<string, unknown>
  timestamp: string
}

export interface PricingEndpoint {
  endpoint: string
  price_usdc: number
  description?: string
}

export interface MarketplaceListing {
  id: string
  agent_id: string
  agent_name?: string
  owner_address: string
  description?: string
  rate_usdc_per_hour?: number
  rate_usdc_per_action?: number
  status: string
}

export interface ComplianceSection {
  id: string
  title: string
  status: string
  description: string
  evidence: string[]
  recommendations: string[]
}

export interface WebhookEndpoint {
  id: string
  url: string
  event_types?: string[]
  active: boolean
  failure_count?: number
  secret?: string
}
