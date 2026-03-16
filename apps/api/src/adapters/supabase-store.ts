import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DataStore, AgentRow, AgentUpsert, ActionInsert } from '@xorb/agent-core'

export class SupabaseDataStore implements DataStore {
  private client: SupabaseClient

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey)
  }

  async fetchAgent(id: string): Promise<AgentRow | null> {
    const { data, error } = await this.client
      .from('agent_registry')
      .select('*')
      .eq('agent_id', id)
      .single()

    if (error || !data) return null
    return data as AgentRow
  }

  async fetchAllAgents(): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('agent_registry')
      .select('*')
      .order('spawned_at', { ascending: false })

    if (error || !data) return []
    return data as AgentRow[]
  }

  async fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('agent_registry')
      .select('*')
      .ilike('sponsor_address', sponsorAddress)

    if (error || !data) return []
    return data as AgentRow[]
  }

  async upsertAgent(agent: AgentUpsert): Promise<void> {
    const { error } = await this.client
      .from('agent_registry')
      .upsert({
        agent_id: agent.agent_id,
        name: agent.name,
        role: agent.role,
        sponsor_address: agent.sponsor_address,
        session_wallet: agent.session_wallet,
        stake_bond: agent.stake_bond,
        slashed_amount: agent.slashed_amount,
        permission_hash: agent.permission_hash,
        reputation_score: agent.reputation_score,
        status: agent.status,
        spawned_at: agent.spawned_at,
        expires_at: agent.expires_at,
        total_actions: agent.total_actions,
        last_active_at: agent.last_active_at,
        llm_provider: agent.llm_provider,
      }, { onConflict: 'agent_id' })

    if (error) {
      console.error('[SupabaseDataStore] upsertAgent error:', error.message)
    }
  }

  async deleteAgent(agentId: string): Promise<void> {
    const { error } = await this.client
      .from('agent_registry')
      .delete()
      .eq('agent_id', agentId)

    if (error) {
      console.error('[SupabaseDataStore] deleteAgent error:', error.message)
    }
  }

  async insertAction(action: ActionInsert): Promise<void> {
    const { error } = await this.client
      .from('agent_actions')
      .insert({
        action_id: action.action_id,
        agent_id: action.agent_id,
        action_type: action.action_type,
        tool: action.tool,
        params: action.params,
        approved: action.approved,
        gate_results: action.gate_results,
        reputation_delta: action.reputation_delta,
        audit_hash: action.audit_hash,
        latency_ms: action.latency_ms,
      })

    if (error) {
      console.error('[SupabaseDataStore] insertAction error:', error.message)
    }
  }

  async fetchAgentActions(agentId: string, limit = 100): Promise<ActionInsert[]> {
    const { data, error } = await this.client
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as ActionInsert[]
  }
}
