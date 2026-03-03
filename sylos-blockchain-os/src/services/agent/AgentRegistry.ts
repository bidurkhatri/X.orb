/**
 * @file AgentRegistry.ts
 * @description Agent Registry — Immigration System for the SylOS Civilization
 *
 * An agent cannot exist without sponsorship. Just like a visa.
 *
 * To exist in SylOS, an agent must:
 * - Be spawned by a human (wallet) or DAO
 * - Be registered in this Agent Registry
 * - Receive: unique ID, session wallet, initial stake, permission scope, expiry
 *
 * Without sponsorship, an agent cannot exist.
 */

import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/lib/supabase'
import { supabaseData, type AgentRow } from '@/services/db/SupabaseDataService'
import type { AgentRole, AgentStatus, PermissionScope, ReputationTier } from './AgentRoles'
import { ROLE_PERMISSIONS, getReputationTier } from './AgentRoles'
import { citizenIdentity } from './CitizenIdentity'

/* ═══════════════════════════════
   ═══  REGISTERED AGENT  ═══════
   ═══════════════════════════════ */

export interface LLMProvider {
    name: string            // "OpenAI" | "Groq" | "OpenRouter" | "Ollama" | "SylOS-Hosted"
    apiUrl: string
    model: string
    apiKey?: string         // Encrypted at rest via CredentialVault (Phase 2)
}

export interface RegisteredAgent {
    agentId: string
    name: string                     // Human-readable: "OpenClaw-v2", "MyTrader"
    role: AgentRole
    sponsorAddress: string           // Human/DAO wallet that spawned this agent
    sessionWalletAddress: string     // Sub-wallet for this agent
    stakeBond: string                // wSYLOS staked as collateral (serialized bigint)
    permissionScope: PermissionScope
    reputation: number               // 0-10000 basis points
    reputationTier: ReputationTier
    status: AgentStatus
    createdAt: number
    expiresAt: number                // Renewal timestamp (0 = no expiry)
    lastActiveAt: number
    llmProvider: LLMProvider
    totalActionsExecuted: number
    totalValueGenerated: string      // serialized bigint
    slashEvents: number
    description: string              // What this agent does
}

export interface SpawnAgentConfig {
    name: string
    role: AgentRole
    sponsorAddress: string
    stakeBond?: string               // Default: 100 wSYLOS
    expiryDays?: number              // Default: 30 days, 0 = no expiry
    llmProvider: LLMProvider
    description?: string
    customPermissions?: Partial<PermissionScope>  // Override role defaults
}

/* ═══════════════════════════════
   ═══  STORAGE KEYS  ═══════════
   ═══════════════════════════════ */

const REGISTRY_KEY = 'sylos_agent_registry'
const REGISTRY_VERSION = 1

/* ═══════════════════════════════
   ═══  AGENT REGISTRY  ═════════
   ═══════════════════════════════ */

class AgentRegistryService {
    private agents: Map<string, RegisteredAgent> = new Map()
    private _loaded = false

    constructor() {
        this.loadFromStorage()
        // Async: merge Supabase data after initial local load
        this.loadFromSupabase()
    }

    /* ─── Persistence ─── */

    private loadFromStorage(): void {
        try {
            const raw = localStorage.getItem(REGISTRY_KEY)
            if (!raw) { this._loaded = true; return }

            const parsed = JSON.parse(raw)
            if (parsed.version !== REGISTRY_VERSION) {
                console.warn('[AgentRegistry] Version mismatch, clearing stale registry')
                localStorage.removeItem(REGISTRY_KEY)
                this._loaded = true
                return
            }

            const agents: RegisteredAgent[] = parsed.agents || []
            agents.forEach(a => this.agents.set(a.agentId, a))
            this._loaded = true
        } catch (e) {
            console.error('[AgentRegistry] Failed to load:', e)
            this._loaded = true
        }
    }

    /**
     * Load agents from Supabase and merge with local state.
     * Supabase is the source of truth for status/reputation;
     * localStorage is the source of truth for LLM keys (never sent to server).
     */
    private async loadFromSupabase(): Promise<void> {
        try {
            if (!(await supabaseData.isAvailable())) return
            const rows = await supabaseData.fetchAllAgents()
            let merged = 0
            for (const row of rows) {
                const existing = this.agents.get(row.agent_id)
                if (existing) {
                    // Server wins for status & reputation
                    existing.status = row.status.toLowerCase() as AgentStatus
                    existing.reputation = row.reputation_score
                    existing.reputationTier = (row.reputation_tier as ReputationTier) || getReputationTier(row.reputation_score)
                    existing.totalActionsExecuted = row.total_actions
                } else {
                    // New agent from server (spawned from another device)
                    this.agents.set(row.agent_id, this.rowToAgent(row))
                }
                merged++
            }
            if (merged > 0) {
                this.saveToStorage()
            }
        } catch {
            // Supabase may not be configured — that's fine
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
            permissionScope: (row.permission_scope as unknown as PermissionScope) || ROLE_PERMISSIONS[role],
            reputation: row.reputation_score,
            reputationTier: (row.reputation_tier as ReputationTier) || getReputationTier(row.reputation_score),
            status: row.status.toLowerCase() as AgentStatus,
            createdAt: new Date(row.spawned_at).getTime(),
            expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
            lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : Date.now(),
            llmProvider: { name: row.llm_provider || 'Unknown', apiUrl: '', model: '' },
            totalActionsExecuted: row.total_actions,
            totalValueGenerated: '0',
            slashEvents: 0,
            description: `${role} agent`,
        }
    }

    private saveToStorage(): void {
        try {
            const data = {
                version: REGISTRY_VERSION,
                agents: Array.from(this.agents.values()),
                savedAt: Date.now(),
            }
            localStorage.setItem(REGISTRY_KEY, JSON.stringify(data))
        } catch (e) {
            console.error('[AgentRegistry] Failed to save:', e)
        }
    }

    private async syncToSupabase(agent: RegisteredAgent): Promise<void> {
        if (!navigator.onLine) return
        try {
            const statusMap: Record<string, string> = { active: 'Active', paused: 'Paused', revoked: 'Revoked', expired: 'Expired' }
            await supabaseData.upsertAgent({
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
                llm_provider: agent.llmProvider.name,
            })
        } catch {
            // Graceful — Supabase may not be configured yet
        }
    }

    /* ─── Agent Lifecycle ─── */

    /**
     * Spawn a new agent — the immigration process.
     * Returns the registered agent or throws if validation fails.
     */
    spawnAgent(config: SpawnAgentConfig): RegisteredAgent {
        // Validate sponsor
        if (!config.sponsorAddress || config.sponsorAddress.length < 10) {
            throw new Error('Agent spawn failed: Invalid sponsor address. Connect your wallet first.')
        }

        // Validate name
        if (!config.name || config.name.length < 2 || config.name.length > 64) {
            throw new Error('Agent spawn failed: Name must be 2-64 characters.')
        }

        // Check for duplicate names under same sponsor
        const existing = this.getAgentsBySponsor(config.sponsorAddress)
        if (existing.some(a => a.name === config.name && a.status !== 'revoked')) {
            throw new Error(`Agent spawn failed: You already have an active agent named "${config.name}".`)
        }

        // Max agents per sponsor
        const activeCount = existing.filter(a => a.status === 'active' || a.status === 'paused').length
        if (activeCount >= 10) {
            throw new Error('Agent spawn failed: Maximum 10 active agents per sponsor.')
        }

        // Build permission scope from role defaults + any custom overrides
        const baseScope = { ...ROLE_PERMISSIONS[config.role] }
        if (config.customPermissions) {
            Object.assign(baseScope, config.customPermissions)
        }

        // Generate session wallet address (deterministic from agent ID for now)
        const agentId = `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`
        const sessionWallet = `0x${agentId.replace('agent_', '').padEnd(40, '0')}`

        const now = Date.now()
        const expiryMs = (config.expiryDays ?? 30) > 0
            ? now + ((config.expiryDays ?? 30) * 24 * 60 * 60 * 1000)
            : 0 // 0 = no expiry

        const agent: RegisteredAgent = {
            agentId,
            name: config.name,
            role: config.role,
            sponsorAddress: config.sponsorAddress,
            sessionWalletAddress: sessionWallet,
            stakeBond: config.stakeBond ?? '100000000000000000000', // 100 wSYLOS default
            permissionScope: baseScope,
            reputation: 1000, // Start as NOVICE
            reputationTier: 'NOVICE',
            status: 'active',
            createdAt: now,
            expiresAt: expiryMs,
            lastActiveAt: now,
            llmProvider: config.llmProvider,
            totalActionsExecuted: 0,
            totalValueGenerated: '0',
            slashEvents: 0,
            description: config.description || `${config.role} agent spawned by ${config.sponsorAddress.slice(0, 8)}...`,
        }

        this.agents.set(agentId, agent)
        this.saveToStorage()
        this.syncToSupabase(agent)

        // Create full citizen identity profile
        citizenIdentity.createProfile({
            agentId,
            name: agent.name,
            role: agent.role,
            sponsorAddress: agent.sponsorAddress,
            stakeBond: agent.stakeBond,
            llmProvider: agent.llmProvider.name,
            llmModel: agent.llmProvider.model,
            purpose: agent.description,
            expiresAt: agent.expiresAt,
        })

        console.log(`[AgentRegistry] Agent spawned: ${agent.name} (${agent.role}) — ID: ${agentId}`)
        return agent
    }

    /**
     * Pause an agent — sponsor or admin can pause.
     * Agent stops executing but retains state and reputation.
     */
    pauseAgent(agentId: string, callerAddress: string): RegisteredAgent {
        const agent = this.getAgent(agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found`)
        if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            throw new Error('Only the sponsor can pause this agent')
        }
        if (agent.status === 'revoked') throw new Error('Cannot pause a revoked agent')

        agent.status = 'paused'
        this.saveToStorage()
        this.syncToSupabase(agent)
        citizenIdentity.updateStatus(agentId, 'paused')

        console.log(`[AgentRegistry] Agent paused: ${agent.name}`)
        return agent
    }

    /**
     * Resume a paused agent.
     */
    resumeAgent(agentId: string, callerAddress: string): RegisteredAgent {
        const agent = this.getAgent(agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found`)
        if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            throw new Error('Only the sponsor can resume this agent')
        }
        if (agent.status !== 'paused') throw new Error('Agent is not paused')

        // Check expiry
        if (agent.expiresAt > 0 && Date.now() > agent.expiresAt) {
            agent.status = 'expired'
            this.saveToStorage()
            throw new Error('Agent has expired. Renew before resuming.')
        }

        agent.status = 'active'
        agent.lastActiveAt = Date.now()
        this.saveToStorage()
        this.syncToSupabase(agent)
        citizenIdentity.updateStatus(agentId, 'active')

        console.log(`[AgentRegistry] Agent resumed: ${agent.name}`)
        return agent
    }

    /**
     * Revoke an agent permanently — slashes remaining stake.
     * This is death/deportation.
     */
    revokeAgent(agentId: string, callerAddress: string): RegisteredAgent {
        const agent = this.getAgent(agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found`)
        if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            throw new Error('Only the sponsor can revoke this agent')
        }
        if (agent.status === 'revoked') throw new Error('Agent already revoked')

        agent.status = 'revoked'
        agent.stakeBond = '0' // Slash remaining stake
        this.saveToStorage()
        this.syncToSupabase(agent)
        citizenIdentity.updateStatus(agentId, 'revoked')
        citizenIdentity.updateFinancials(agentId, { newStake: '0' })

        console.log(`[AgentRegistry] Agent revoked: ${agent.name} — stake slashed`)
        return agent
    }

    /**
     * Permanently delete an agent from the registry.
     * Only works on revoked or expired agents — active ones must be revoked first.
     */
    deleteAgent(agentId: string, callerAddress: string): void {
        const agent = this.getAgent(agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found`)
        if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            throw new Error('Only the sponsor can delete this agent')
        }
        if (agent.status === 'active' || agent.status === 'paused') {
            throw new Error('Cannot delete an active/paused agent. Revoke it first.')
        }

        this.agents.delete(agentId)
        this.saveToStorage()

        // Clean up from Supabase
        Promise.resolve(supabase.from('agents').delete().eq('agent_id', agentId)).then(() => {
            console.log(`[AgentRegistry] Agent deleted from Supabase: ${agentId}`)
        }).catch(() => { /* graceful */ })

        // Clean localStorage keys for this agent
        try {
            localStorage.removeItem(`sylos_agent_messages_${agentId}`)
            localStorage.removeItem(`sylos_agent_tasks_${agentId}`)
            localStorage.removeItem(`sylos_agent_config_${agentId}`)
        } catch { /* */ }

        console.log(`[AgentRegistry] Agent permanently deleted: ${agent.name} (${agentId})`)
    }

    /**
     * Renew an agent's visa (extend expiry).
     */
    renewAgent(agentId: string, callerAddress: string, additionalDays: number = 30): RegisteredAgent {
        const agent = this.getAgent(agentId)
        if (!agent) throw new Error(`Agent ${agentId} not found`)
        if (agent.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase()) {
            throw new Error('Only the sponsor can renew this agent')
        }
        if (agent.status === 'revoked') throw new Error('Cannot renew a revoked agent')

        const baseTime = Math.max(agent.expiresAt, Date.now())
        agent.expiresAt = baseTime + (additionalDays * 24 * 60 * 60 * 1000)
        if (agent.status === 'expired') agent.status = 'active'
        agent.lastActiveAt = Date.now()
        this.saveToStorage()
        this.syncToSupabase(agent)
        citizenIdentity.renewVisa(agentId, agent.expiresAt)
        if (agent.status === 'active') citizenIdentity.updateStatus(agentId, 'active')

        console.log(`[AgentRegistry] Agent renewed: ${agent.name} — +${additionalDays} days`)
        return agent
    }

    /* ─── Agent Actions (called by runtime) ─── */

    /**
     * Record that an agent performed an action. Updates stats + activity.
     */
    recordAction(agentId: string): void {
        const agent = this.agents.get(agentId)
        if (!agent) return
        agent.totalActionsExecuted++
        agent.lastActiveAt = Date.now()
        // Batch save — don't write on every single action
        if (agent.totalActionsExecuted % 10 === 0) {
            this.saveToStorage()
        }
    }

    /**
     * Update agent reputation score.
     */
    updateReputation(agentId: string, delta: number): void {
        const agent = this.agents.get(agentId)
        if (!agent) return
        agent.reputation = Math.max(0, Math.min(10000, agent.reputation + delta))
        agent.reputationTier = getReputationTier(agent.reputation)

        // Auto-pause if reputation drops to UNTRUSTED
        if (agent.reputation < 500 && agent.status === 'active') {
            agent.status = 'paused'
            console.warn(`[AgentRegistry] ⚠️ Agent ${agent.name} auto-paused: reputation dropped to ${agent.reputation}`)
        }

        if (delta < 0) agent.slashEvents++
        this.saveToStorage()
        citizenIdentity.updateReputation(agentId, agent.reputation, agent.reputationTier)
    }

    /**
     * Check if an agent is allowed to execute right now.
     */
    canExecute(agentId: string): { allowed: boolean; reason?: string } {
        const agent = this.agents.get(agentId)
        if (!agent) return { allowed: false, reason: 'Agent not registered' }
        if (agent.status !== 'active') return { allowed: false, reason: `Agent is ${agent.status}` }
        if (agent.expiresAt > 0 && Date.now() > agent.expiresAt) {
            agent.status = 'expired'
            this.saveToStorage()
            return { allowed: false, reason: 'Agent visa expired' }
        }
        return { allowed: true }
    }

    /* ─── Queries ─── */

    getAgent(agentId: string): RegisteredAgent | undefined {
        return this.agents.get(agentId)
    }

    getAgentsBySponsor(sponsorAddress: string): RegisteredAgent[] {
        return Array.from(this.agents.values())
            .filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())
    }

    getAllAgents(): RegisteredAgent[] {
        return Array.from(this.agents.values())
    }

    getActiveAgents(): RegisteredAgent[] {
        return Array.from(this.agents.values()).filter(a => a.status === 'active')
    }

    getAgentCount(): number {
        return this.agents.size
    }
}

/* ═══════════════════════════════
   ═══  SINGLETON EXPORT  ═══════
   ═══════════════════════════════ */

export const agentRegistry = new AgentRegistryService()
