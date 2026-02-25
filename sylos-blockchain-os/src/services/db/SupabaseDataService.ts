/**
 * SupabaseDataService — typed query layer for all SylOS Supabase tables.
 *
 * Provides real data access for:
 *  - agent_registry (agents, spawn, lifecycle)
 *  - agent_actions (audit log, tool calls)
 *  - civilization_stats (dashboard metrics)
 *  - transactions (on-chain tx records)
 *  - decentralized_files (VFS)
 *
 * Falls back gracefully when Supabase is unreachable (offline-first).
 */

import { supabase } from '@/lib/supabase'

/* ─── Types ─── */

export interface AgentRow {
    agent_id: string
    sponsor_address: string
    name: string
    role: string
    stake_bond: string
    slashed_amount: string
    permission_hash: string
    permission_scope: Record<string, unknown> | null
    status: string
    spawned_at: string
    expires_at: string | null
    reputation_score: number
    reputation_tier: string
    session_wallet: string | null
    total_actions: number
    last_active_at: string | null
    llm_provider: string | null
    created_at: string
    updated_at: string
}

export interface AgentActionRow {
    id: string
    agent_id: string
    action_type: string
    tool_name: string | null
    reputation_delta: number
    reputation_before: number | null
    reputation_after: number | null
    details: Record<string, unknown> | null
    ipfs_cid: string | null
    tx_hash: string | null
    created_at: string
}

export interface CivilizationStatsRow {
    id: string
    total_agents: number
    active_agents: number
    paused_agents: number
    revoked_agents: number
    total_stake_locked: string
    total_slashed: string
    total_actions_24h: number
    total_violations_24h: number
    avg_reputation: number
    economy_volume_24h: string
    updated_at: string
}

/* ─── Service ─── */

class SupabaseDataService {
    private static instance: SupabaseDataService
    private _available: boolean | null = null

    static getInstance(): SupabaseDataService {
        if (!this.instance) this.instance = new SupabaseDataService()
        return this.instance
    }

    /** Quick check — is Supabase configured and reachable? */
    async isAvailable(): Promise<boolean> {
        if (this._available !== null) return this._available
        try {
            const { error } = await supabase.from('civilization_stats').select('id').limit(1)
            this._available = !error
        } catch {
            this._available = false
        }
        return this._available
    }

    /* ═══ Agent Registry ═══ */

    async fetchAgentsBySponsor(sponsorAddress: string): Promise<AgentRow[]> {
        const { data, error } = await supabase
            .from('agent_registry')
            .select('*')
            .ilike('sponsor_address', sponsorAddress)
            .order('spawned_at', { ascending: false })
        if (error) throw error
        return data ?? []
    }

    async fetchAllAgents(): Promise<AgentRow[]> {
        const { data, error } = await supabase
            .from('agent_registry')
            .select('*')
            .order('spawned_at', { ascending: false })
            .limit(200)
        if (error) throw error
        return data ?? []
    }

    async fetchAgent(agentId: string): Promise<AgentRow | null> {
        const { data, error } = await supabase
            .from('agent_registry')
            .select('*')
            .eq('agent_id', agentId)
            .single()
        if (error) return null
        return data
    }

    async upsertAgent(row: Partial<AgentRow> & { agent_id: string }): Promise<void> {
        await supabase.from('agent_registry').upsert([row], { onConflict: 'agent_id' })
    }

    async updateAgentStatus(agentId: string, status: string): Promise<void> {
        await supabase.from('agent_registry').update({ status, updated_at: new Date().toISOString() }).eq('agent_id', agentId)
    }

    /* ═══ Agent Actions (Audit Log) ═══ */

    async fetchAgentActions(agentId: string, limit = 50): Promise<AgentActionRow[]> {
        const { data, error } = await supabase
            .from('agent_actions')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })
            .limit(limit)
        if (error) throw error
        return data ?? []
    }

    async insertAgentAction(action: Omit<AgentActionRow, 'id' | 'created_at'>): Promise<void> {
        await supabase.from('agent_actions').insert([action])
    }

    /* ═══ Civilization Stats ═══ */

    async fetchCivilizationStats(): Promise<CivilizationStatsRow | null> {
        const { data, error } = await supabase
            .from('civilization_stats')
            .select('*')
            .eq('id', 'global')
            .single()
        if (error) return null
        return data
    }

    /* ═══ Transactions ═══ */

    async fetchTransactions(walletAddress: string, limit = 20): Promise<Array<Record<string, unknown>>> {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .or(`from_address.ilike.${walletAddress},to_address.ilike.${walletAddress}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        if (error) throw error
        return data ?? []
    }

    /* ═══ Files (VFS) ═══ */

    async fetchFiles(userId: string): Promise<Array<Record<string, unknown>>> {
        const { data, error } = await supabase
            .from('decentralized_files')
            .select('*')
            .eq('user_id', userId)
            .order('upload_timestamp', { ascending: false })
        if (error) throw error
        return data ?? []
    }
}

export const supabaseData = SupabaseDataService.getInstance()
