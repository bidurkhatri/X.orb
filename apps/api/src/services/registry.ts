import { AgentRegistryService } from '@xorb/agent-core'
import type { DataStore, AgentRow, AgentUpsert, ActionInsert } from '@xorb/agent-core'

// In-memory DataStore implementation (replace with Supabase adapter later)
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
      slashed_amount: agent.slashed_amount || '0',
      permission_hash: agent.permission_hash || '',
      permission_scope: null,
      reputation_tier: null,
      reputation_score: agent.reputation_score,
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

let registry: AgentRegistryService | null = null

export async function getRegistry(): Promise<AgentRegistryService> {
  if (!registry) {
    const store = new InMemoryDataStore()
    registry = new AgentRegistryService(store)
    await registry.load()
  }
  return registry
}
