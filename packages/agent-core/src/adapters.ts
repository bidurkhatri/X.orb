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

export interface DataStore {
  fetchAgent(id: string): Promise<AgentRow | null>
  fetchAllAgents(): Promise<AgentRow[]>
  fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]>
  upsertAgent(agent: AgentUpsert): Promise<void>
  deleteAgent(agentId: string): Promise<void>
  insertAction(action: ActionInsert): Promise<void>
  fetchAgentActions(agentId: string, limit?: number): Promise<ActionInsert[]>
}

export interface IpfsAdapter {
  pin(data: Uint8Array, name: string): Promise<string>
}
