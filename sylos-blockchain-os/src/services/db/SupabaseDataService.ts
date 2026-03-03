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

export interface CommunityPostRow {
    id: string
    channel_id: string
    author_id: string
    author_name: string
    author_role: string
    author_reputation: number
    title: string
    body: string
    upvotes: number
    downvotes: number
    voted_by: Record<string, 'up' | 'down'>
    reply_count: number
    pinned: boolean
    tags: string[]
    created_at: number
}

export interface CommunityReplyRow {
    id: string
    post_id: string
    author_id: string
    author_name: string
    author_role: string
    body: string
    upvotes: number
    downvotes: number
    voted_by: Record<string, 'up' | 'down'>
    created_at: number
}

/* ─── Service ─── */

class SupabaseDataService {
    private static instance: SupabaseDataService
    private _available: boolean | null = null
    private _availableCheckedAt: number = 0
    private static readonly AVAILABILITY_TTL_MS = 60_000 // Re-check every 60s

    static getInstance(): SupabaseDataService {
        if (!this.instance) this.instance = new SupabaseDataService()
        return this.instance
    }

    /** Quick check — is Supabase configured and reachable? Caches result for 60s. */
    async isAvailable(): Promise<boolean> {
        const now = Date.now()
        if (this._available !== null && (now - this._availableCheckedAt) < SupabaseDataService.AVAILABILITY_TTL_MS) {
            return this._available
        }
        try {
            const { error } = await supabase.from('civilization_stats').select('id').limit(1)
            this._available = !error
        } catch {
            this._available = false
        }
        this._availableCheckedAt = now
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

    /* ═══ Community Posts ═══ */

    async fetchCommunityPosts(channelId?: string, limit = 200): Promise<CommunityPostRow[]> {
        let query = supabase
            .from('community_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)
        if (channelId && channelId !== 'all') {
            query = query.eq('channel_id', channelId)
        }
        const { data, error } = await query
        if (error) throw error
        return data ?? []
    }

    async insertCommunityPost(post: CommunityPostRow): Promise<void> {
        await supabase.from('community_posts').upsert([post], { onConflict: 'id' })
    }

    async updatePostVotes(postId: string, upvotes: number, downvotes: number, votedBy: Record<string, 'up' | 'down'>): Promise<void> {
        await supabase.from('community_posts').update({
            upvotes,
            downvotes,
            voted_by: votedBy,
        }).eq('id', postId)
    }

    async updatePostReplyCount(postId: string, replyCount: number): Promise<void> {
        await supabase.from('community_posts').update({ reply_count: replyCount }).eq('id', postId)
    }

    /* ═══ Community Replies ═══ */

    async fetchCommunityReplies(postId: string): Promise<CommunityReplyRow[]> {
        const { data, error } = await supabase
            .from('community_replies')
            .select('*')
            .eq('post_id', postId)
            .order('created_at', { ascending: true })
        if (error) throw error
        return data ?? []
    }

    /** Batch fetch all replies for multiple posts in a single query (avoids N+1). */
    async fetchAllRepliesForPosts(postIds: string[]): Promise<Map<string, CommunityReplyRow[]>> {
        if (postIds.length === 0) return new Map()
        const { data, error } = await supabase
            .from('community_replies')
            .select('*')
            .in('post_id', postIds)
            .order('created_at', { ascending: true })
        if (error) throw error
        const grouped = new Map<string, CommunityReplyRow[]>()
        for (const row of (data ?? [])) {
            const existing = grouped.get(row.post_id) || []
            existing.push(row)
            grouped.set(row.post_id, existing)
        }
        return grouped
    }

    async insertCommunityReply(reply: CommunityReplyRow): Promise<void> {
        await supabase.from('community_replies').upsert([reply], { onConflict: 'id' })
    }

    async updateReplyVotes(replyId: string, upvotes: number, downvotes: number, votedBy: Record<string, 'up' | 'down'>): Promise<void> {
        await supabase.from('community_replies').update({
            upvotes,
            downvotes,
            voted_by: votedBy,
        }).eq('id', replyId)
    }
}

export const supabaseData = SupabaseDataService.getInstance()

