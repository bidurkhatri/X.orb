export interface AgentRow {
  agent_id: string
  name: string
  role: string
  sponsor_address: string
  session_wallet: string | null
  stake_bond: string
  slashed_amount: string
  permission_hash: string
  permission_scope: unknown
  reputation_score: number
  reputation_tier: string | null
  status: string
  spawned_at: string
  expires_at: string | null
  total_actions: number
  last_active_at: string | null
  llm_provider: string | null
}

export interface AgentUpsert {
  agent_id: string
  name: string
  role: string
  sponsor_address: string
  session_wallet: string
  stake_bond: string
  slashed_amount: string
  permission_hash: string
  reputation_score: number
  status: string
  spawned_at: string
  expires_at: string | null
  total_actions: number
  last_active_at: string
  llm_provider: string
}

export interface ActionInsert {
  action_id: string
  agent_id: string
  action_type: string
  tool: string | null
  params: unknown
  approved: boolean
  gate_results: unknown
  reputation_delta: number
  audit_hash: string
  latency_ms: number
}

/** Pagination options for list queries (A-12) */
export interface PaginationOptions {
  limit?: number
  cursor?: string  // ISO timestamp or ID for cursor-based pagination
}

/** Paginated result set */
export interface PaginatedResult<T> {
  data: T[]
  next_cursor?: string
  has_more: boolean
}

/**
 * Error thrown when a persistence operation fails.
 * `retryable` indicates whether the caller should retry (A-32).
 */
export class PersistenceError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable = false) {
    super(message)
    this.name = 'PersistenceError'
    this.retryable = retryable
  }
}

/**
 * DataStore interface — the persistence contract for agent-core.
 *
 * Error semantics (A-32):
 * - fetchAgent(): returns Agent | null (not found = null). Throws PersistenceError on network/DB failure.
 * - fetchAllAgents(): returns Agent[] (empty if none). Throws PersistenceError on failure.
 * - upsertAgent(): returns void on success. Throws PersistenceError on failure.
 * - deleteAgent(): returns void on success (no-op if not found). Throws PersistenceError on failure.
 * - insertAction(): returns void on success. Throws PersistenceError on failure.
 * - fetchAgentActions(): returns paginated results. Throws PersistenceError on failure.
 */
export interface DataStore {
  fetchAgent(id: string): Promise<AgentRow | null>
  fetchAllAgents(): Promise<AgentRow[]>
  fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]>
  upsertAgent(agent: AgentUpsert): Promise<void>
  deleteAgent(agentId: string): Promise<void>
  insertAction(action: ActionInsert): Promise<void>
  fetchAgentActions(agentId: string, opts?: PaginationOptions): Promise<PaginatedResult<ActionInsert>>
}

export interface IpfsAdapter {
  pin(data: Uint8Array, name: string): Promise<string>
}
