export { XorbClient, XorbAPIError, WalletHelpers } from './client'
export { PaymentSigner } from './payment'
export type { PaymentSignerConfig, PaymentHeader } from './payment'
export {
  XORB_DEFAULT_API_URL,
  XORB_FALLBACK_API_URL,
} from './types'
export type {
  XorbConfig,
  Agent,
  AgentRole,
  AgentStatus,
  ReputationTier,
  CreateAgentParams,
  ExecuteActionParams,
  GateResult,
  PipelineResult,
  ReputationInfo,
  WebhookSubscription,
  AuditLog,
  PricingEndpoint,
  XorbError,
} from './types'
