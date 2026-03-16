import { AgentRegistryService } from '@xorb/agent-core'
import type { DataStore, AgentRow, AgentUpsert, ActionInsert } from '@xorb/agent-core'
import { SupabaseDataStore } from '../adapters/supabase-store'

// In-memory DataStore for development
class InMemoryDataStore implements DataStore {
  private agents = new Map<string, AgentRow>()
  private actions: ActionInsert[] = []

  async fetchAgent(id: string): Promise<AgentRow | null> {
    return this.agents.get(id) || null
  }

  async fetchAllAgents(): Promise<AgentRow[]> {
    return Array.from(this.agents.values())
  }

  async fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]> {
    return Array.from(this.agents.values())
      .filter(a => a.sponsor_address.toLowerCase() === sponsorAddress.toLowerCase())
  }

  async upsertAgent(agent: AgentUpsert): Promise<void> {
    this.agents.set(agent.agent_id, {
      ...agent,
      permission_scope: null,
      reputation_tier: null,
    } as AgentRow)
  }

  async deleteAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId)
  }

  async insertAction(action: ActionInsert): Promise<void> {
    this.actions.push(action)
  }

  async fetchAgentActions(agentId: string, limit = 100): Promise<ActionInsert[]> {
    return this.actions.filter(a => a.agent_id === agentId).slice(-limit)
  }
}

function createDataStore(): DataStore {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    console.log('[Registry] Using Supabase DataStore')
    return new SupabaseDataStore(supabaseUrl, supabaseKey)
  }

  console.log('[Registry] Using in-memory DataStore (set SUPABASE_URL + SUPABASE_SERVICE_KEY for persistence)')
  return new InMemoryDataStore()
}

let registry: AgentRegistryService | null = null

export async function getRegistry(): Promise<AgentRegistryService> {
  if (!registry) {
    const store = createDataStore()
    registry = new AgentRegistryService(store)
    await registry.load()
  }
  return registry
}
