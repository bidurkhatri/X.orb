import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'node:crypto'
import type { DataStore, AgentRow } from './adapters'
import type { RegisteredAgent, SpawnAgentConfig, AgentRole, AgentStatus, ReputationTier, PermissionScope } from './types'
import { ROLE_PERMISSIONS, getReputationTier } from './roles'

export class AgentRegistryService {
  private agents: Map<string, RegisteredAgent> = new Map()
  private store: DataStore

  constructor(store: DataStore) {
    this.store = store
  }

  async load(): Promise<void> {
    const rows = await this.store.fetchAllAgents()
    for (const row of rows) {
      this.agents.set(row.agent_id, this.rowToAgent(row))
    }
  }

  private rowToAgent(row: AgentRow): RegisteredAgent {
    const role = row.role as AgentRole
    return {
      agentId: row.agent_id,
      name: row.name,
      role,
      sponsorAddress: row.sponsor_address,
      sessionWalletAddress: row.session_wallet || '',
      stakeBond: row.stake_bond,
      permissionScope: (row.permission_scope as PermissionScope) || ROLE_PERMISSIONS[role],
      reputation: row.reputation_score,
      reputationTier: (row.reputation_tier as ReputationTier) || getReputationTier(row.reputation_score),
      status: row.status.toLowerCase() as AgentStatus,
      createdAt: new Date(row.spawned_at).getTime(),
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : Date.now(),
      totalActionsExecuted: row.total_actions,
      slashEvents: 0,
      description: `${role} agent`,
    }
  }

  private toUpsert(agent: RegisteredAgent): import('./adapters').AgentUpsert {
    const statusMap: Record<string, string> = { active: 'Active', paused: 'Paused', revoked: 'Revoked', expired: 'Expired' }
    return {
      agent_id: agent.agentId,
      name: agent.name,
      role: agent.role,
      sponsor_address: agent.sponsorAddress,
      session_wallet: agent.sessionWalletAddress,
      stake_bond: agent.stakeBond,
      slashed_amount: '0',
      permission_hash: '',
      reputation_score: agent.reputation,
      status: statusMap[agent.status] || 'Active',
      spawned_at: new Date(agent.createdAt).toISOString(),
      expires_at: agent.expiresAt ? new Date(agent.expiresAt).toISOString() : null,
      total_actions: agent.totalActionsExecuted,
      last_active_at: new Date(agent.lastActiveAt).toISOString(),
      llm_provider: '',
    }
  }

  async spawnAgent(config: SpawnAgentConfig): Promise<RegisteredAgent> {
    if (!config.sponsorAddress || config.sponsorAddress.length < 10) {
      throw new Error('Invalid sponsor address')
    }
    if (!config.name || config.name.length < 2 || config.name.length > 64) {
      throw new Error('Name must be 2-64 characters')
    }

    const existing = await this.getAgentsBySponsor(config.sponsorAddress)
    if (existing.some(a => a.name === config.name && a.status !== 'revoked')) {
      throw new Error(`Already have an active agent named "${config.name}"`)
    }
    const activeCount = existing.filter(a => a.status === 'active' || a.status === 'paused').length
    if (activeCount >= 10) {
      throw new Error('Maximum 10 active agents per sponsor')
    }

    const baseScope = { ...ROLE_PERMISSIONS[config.role] }
    if (config.customPermissions) {
      Object.assign(baseScope, config.customPermissions)
    }

    const agentId = `agent_${uuidv4().replace(/-/g, '')}` // A-4: full UUID (32 hex = 128 bits)
    const sessionWallet = `0x${randomBytes(20).toString('hex')}` // A-3: cryptographically random wallet
    const now = Date.now()
    const expiryMs = (config.expiryDays ?? 30) > 0
      ? now + ((config.expiryDays ?? 30) * 24 * 60 * 60 * 1000)
      : 0

    const agent: RegisteredAgent = {
      agentId,
      name: config.name,
      role: config.role,
      sponsorAddress: config.sponsorAddress,
      sessionWalletAddress: sessionWallet,
      stakeBond: config.stakeBond ?? '50000000', // 50 USDC (6 decimals)
      permissionScope: baseScope,
      reputation: 1000,
      reputationTier: 'NOVICE',
      status: 'active',
      createdAt: now,
      expiresAt: expiryMs,
      lastActiveAt: now,
      totalActionsExecuted: 0,
      slashEvents: 0,
      description: config.description || `${config.role} agent`,
    }

    this.agents.set(agentId, agent)
    await this.store.upsertAgent(this.toUpsert(agent))
    return agent
  }

  async pauseAgent(agentId: string, callerAddress: string): Promise<RegisteredAgent> {
    const agent = this.getAgent(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)
    if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error('Only the sponsor can pause this agent')
    }
    if (agent.status === 'revoked') throw new Error('Cannot pause a revoked agent')

    agent.status = 'paused'
    await this.store.upsertAgent(this.toUpsert(agent))
    return agent
  }

  async resumeAgent(agentId: string, callerAddress: string): Promise<RegisteredAgent> {
    const agent = this.getAgent(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)
    if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error('Only the sponsor can resume this agent')
    }
    if (agent.status !== 'paused') throw new Error('Agent is not paused')
    if (agent.expiresAt > 0 && Date.now() > agent.expiresAt) {
      agent.status = 'expired'
      await this.store.upsertAgent(this.toUpsert(agent))
      throw new Error('Agent has expired. Renew before resuming.')
    }

    agent.status = 'active'
    agent.lastActiveAt = Date.now()
    await this.store.upsertAgent(this.toUpsert(agent))
    return agent
  }

  async revokeAgent(agentId: string, callerAddress: string): Promise<RegisteredAgent> {
    const agent = this.getAgent(agentId)
    if (!agent) throw new Error(`Agent ${agentId} not found`)
    if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error('Only the sponsor can revoke this agent')
    }
    if (agent.status === 'revoked') throw new Error('Agent already revoked')

    agent.status = 'revoked'
    agent.stakeBond = '0'
    await this.store.upsertAgent(this.toUpsert(agent))
    return agent
  }

  canExecute(agentId: string): { allowed: boolean; reason?: string } {
    const agent = this.agents.get(agentId)
    if (!agent) return { allowed: false, reason: 'Agent not registered' }
    if (agent.status !== 'active') return { allowed: false, reason: `Agent is ${agent.status}` }
    if (agent.expiresAt > 0 && Date.now() > agent.expiresAt) {
      agent.status = 'expired'
      return { allowed: false, reason: 'Agent access policy expired' }
    }
    return { allowed: true }
  }

  async updateReputation(agentId: string, delta: number): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.reputation = Math.max(0, Math.min(10000, agent.reputation + delta))
    agent.reputationTier = getReputationTier(agent.reputation)
    if (agent.reputation < 500 && agent.status === 'active') {
      agent.status = 'paused'
    }
    if (delta < 0) agent.slashEvents++
    // Persist updated agent to DataStore
    await this.store.upsertAgent(this.toUpsert(agent))
  }

  async recordAction(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.totalActionsExecuted++
    agent.lastActiveAt = Date.now()
    // Persist updated agent to DataStore
    await this.store.upsertAgent(this.toUpsert(agent))
  }

  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId)
  }

  async getAgentsBySponsor(sponsorAddress: string): Promise<RegisteredAgent[]> {
    const rows = await this.store.fetchAgentsBySponsor(sponsorAddress)
    return rows.map(r => this.rowToAgent(r))
  }

  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values())
  }

  getActiveAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(a => a.status === 'active')
  }
}
