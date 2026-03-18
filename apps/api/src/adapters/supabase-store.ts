import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  PersistenceError,
  type DataStore, type AgentRow, type AgentUpsert, type ActionInsert,
  type PaginationOptions, type PaginatedResult,
} from '@xorb/agent-core'

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

    if (error) {
      if (error.code === 'PGRST116') return null // not found
      throw new PersistenceError(`fetchAgent failed: ${error.message}`, true)
    }
    return data as AgentRow
  }

  async fetchAllAgents(): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('agent_registry')
      .select('*')
      .order('spawned_at', { ascending: false })

    if (error) throw new PersistenceError(`fetchAllAgents failed: ${error.message}`, true)
    return (data || []) as AgentRow[]
  }

  async fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]> {
    const { data, error } = await this.client
      .from('agent_registry')
      .select('*')
      .ilike('sponsor_address', sponsorAddress)

    if (error) throw new PersistenceError(`fetchAgentsBySponsor failed: ${error.message}`, true)
    return (data || []) as AgentRow[]
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

    if (error) throw new PersistenceError(`upsertAgent failed: ${error.message}`, false)
  }

  async deleteAgent(agentId: string): Promise<void> {
    const { error } = await this.client
      .from('agent_registry')
      .delete()
      .eq('agent_id', agentId)

    if (error) throw new PersistenceError(`deleteAgent failed: ${error.message}`, false)
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

    if (error) throw new PersistenceError(`insertAction failed: ${error.message}`, false)
  }

  async fetchAgentActions(agentId: string, opts?: PaginationOptions): Promise<PaginatedResult<ActionInsert>> {
    const limit = opts?.limit || 100

    let query = this.client
      .from('agent_actions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit + 1) // fetch one extra to detect has_more

    if (opts?.cursor) {
      query = query.lt('created_at', opts.cursor)
    }

    const { data, error } = await query

    if (error) throw new PersistenceError(`fetchAgentActions failed: ${error.message}`, true)

    const rows = (data || []) as (ActionInsert & { created_at: string })[]
    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : undefined

    return {
      data: pageRows,
      next_cursor: nextCursor,
      has_more: hasMore,
    }
  }
}
