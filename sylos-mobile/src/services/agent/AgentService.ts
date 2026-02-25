/**
 * AgentService — reads agent data from Supabase, falls back to AsyncStorage.
 *
 * Data flow:
 * 1. Try Supabase (source of truth synced from desktop AgentRegistry)
 * 2. Cache in AsyncStorage for offline access
 * 3. If both unavailable, show empty state (no demo data)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  RegisteredAgent,
  TransactionProposal,
  CommunityPost,
  ActivityEvent,
} from '../../types/agent';

const REGISTRY_KEY = 'sylos_agent_registry';
const TX_QUEUE_KEY = 'sylos_tx_queue';
const COMMUNITY_KEY = 'sylos_community_posts';
const EVENT_LOG_KEY = 'sylos_event_log';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/* ─── Service ─── */

class AgentServiceClass {
  private agents: RegisteredAgent[] = [];
  private proposals: TransactionProposal[] = [];
  private posts: CommunityPost[] = [];
  private events: ActivityEvent[] = [];
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Try Supabase first, then fall back to AsyncStorage cache
    const supabaseLoaded = await this.loadFromSupabase();

    if (!supabaseLoaded) {
      await this.loadFromAsyncStorage();
    }

    this.initialized = true;
  }

  /* ─── Data Loading ─── */

  private async loadFromSupabase(): Promise<boolean> {
    if (!SUPABASE_URL || !SUPABASE_KEY) return false;

    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      const headers: Record<string, string> = { apikey: SUPABASE_KEY };
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

      // Fetch agents
      const agentRes = await fetch(
        `${SUPABASE_URL}/rest/v1/agent_registry?select=*&order=created_at.desc`,
        { headers }
      );
      if (agentRes.ok) {
        const rows = await agentRes.json();
        this.agents = rows.map((row: any) => this.rowToAgent(row));
        // Cache locally
        await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify({ version: 1, agents: this.agents, savedAt: Date.now() }));
      }

      // Fetch community posts
      const postRes = await fetch(
        `${SUPABASE_URL}/rest/v1/community_posts?select=*&order=created_at.desc&limit=100`,
        { headers }
      );
      if (postRes.ok) {
        const rows = await postRes.json();
        if (rows.length > 0) {
          this.posts = rows.map((row: any) => this.rowToPost(row));
          await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(this.posts));
        }
      }

      // Fetch recent agent actions as events
      const actionRes = await fetch(
        `${SUPABASE_URL}/rest/v1/agent_actions?select=*&order=created_at.desc&limit=50`,
        { headers }
      );
      if (actionRes.ok) {
        const rows = await actionRes.json();
        if (rows.length > 0) {
          this.events = rows.map((row: any) => this.rowToEvent(row));
          await AsyncStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.events));
        }
      }

      return this.agents.length > 0;
    } catch (error) {
      console.warn('Supabase fetch failed, falling back to cache:', error);
      return false;
    }
  }

  private async loadFromAsyncStorage(): Promise<void> {
    const agentRaw = await AsyncStorage.getItem(REGISTRY_KEY);
    if (agentRaw) {
      try {
        const parsed = JSON.parse(agentRaw);
        this.agents = parsed.agents || [];
      } catch { /* empty */ }
    }

    const txRaw = await AsyncStorage.getItem(TX_QUEUE_KEY);
    if (txRaw) {
      try { this.proposals = JSON.parse(txRaw); } catch { /* empty */ }
    }

    const postRaw = await AsyncStorage.getItem(COMMUNITY_KEY);
    if (postRaw) {
      try { this.posts = JSON.parse(postRaw); } catch { /* empty */ }
    }

    const eventRaw = await AsyncStorage.getItem(EVENT_LOG_KEY);
    if (eventRaw) {
      try { this.events = JSON.parse(eventRaw); } catch { /* empty */ }
    }
  }

  /* ─── Row Converters ─── */

  private rowToAgent(row: any): RegisteredAgent {
    return {
      agentId: row.agent_id,
      name: row.name,
      role: row.role,
      sponsorAddress: row.sponsor_address,
      sessionWalletAddress: row.session_wallet || '',
      stakeBond: row.stake_bond || '0',
      reputation: row.reputation_score ?? 5000,
      reputationTier: row.reputation_tier || 'RELIABLE',
      status: (row.status || 'Active').toLowerCase() as 'active' | 'paused' | 'revoked',
      createdAt: new Date(row.created_at).getTime(),
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : Date.now(),
      llmProvider: row.llm_provider ? { name: row.llm_provider, apiUrl: '', model: '' } : undefined,
      totalActionsExecuted: row.total_actions ?? 0,
      totalValueGenerated: '0',
      slashEvents: 0,
      description: row.permission_scope?.description || `${row.role} agent`,
    };
  }

  private rowToPost(row: any): CommunityPost {
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: row.author_name || 'Agent',
      authorRole: row.author_role,
      isAgent: row.is_agent ?? true,
      title: row.title,
      content: row.content,
      votes: row.votes ?? 0,
      replyCount: row.reply_count ?? 0,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  private rowToEvent(row: any): ActivityEvent {
    return {
      id: row.id,
      type: `agent:${row.action_type.toLowerCase()}`,
      source: row.agent_id,
      sourceName: row.tool_name || row.agent_id,
      payload: row.details || {},
      timestamp: new Date(row.created_at).getTime(),
    };
  }

  /* ─── Agents ─── */

  getAgents(): RegisteredAgent[] { return this.agents; }
  getActiveAgents(): RegisteredAgent[] { return this.agents.filter(a => a.status === 'active'); }

  getAgent(id: string): RegisteredAgent | undefined {
    return this.agents.find(a => a.agentId === id);
  }

  pauseAgent(id: string): RegisteredAgent | undefined {
    const agent = this.agents.find(a => a.agentId === id);
    if (agent && agent.status === 'active') {
      agent.status = 'paused';
      this.saveAgents();
      this.syncAgentStatus(id, 'Paused');
    }
    return agent;
  }

  resumeAgent(id: string): RegisteredAgent | undefined {
    const agent = this.agents.find(a => a.agentId === id);
    if (agent && agent.status === 'paused') {
      agent.status = 'active';
      agent.lastActiveAt = Date.now();
      this.saveAgents();
      this.syncAgentStatus(id, 'Active');
    }
    return agent;
  }

  revokeAgent(id: string): RegisteredAgent | undefined {
    const agent = this.agents.find(a => a.agentId === id);
    if (agent && agent.status !== 'revoked') {
      agent.status = 'revoked';
      agent.stakeBond = '0';
      this.saveAgents();
      this.syncAgentStatus(id, 'Revoked');
    }
    return agent;
  }

  /* ─── Transaction Proposals ─── */

  getProposals(): TransactionProposal[] { return this.proposals; }

  getPendingProposals(): TransactionProposal[] {
    return this.proposals.filter(p => p.status === 'pending');
  }

  approveProposal(id: string): void {
    const p = this.proposals.find(x => x.id === id);
    if (p) { p.status = 'approved'; this.saveProposals(); }
  }

  rejectProposal(id: string): void {
    const p = this.proposals.find(x => x.id === id);
    if (p) { p.status = 'rejected'; this.saveProposals(); }
  }

  /* ─── Community ─── */

  getPosts(): CommunityPost[] {
    return [...this.posts].sort((a, b) => b.createdAt - a.createdAt);
  }

  votePost(id: string, direction: 1 | -1): void {
    const post = this.posts.find(p => p.id === id);
    if (post) { post.votes += direction; this.savePosts(); }
  }

  /* ─── Events ─── */

  getRecentEvents(limit = 50): ActivityEvent[] {
    return this.events.slice(-limit).reverse();
  }

  /** Refresh data from Supabase */
  async refresh(): Promise<void> {
    this.initialized = false;
    await this.init();
  }

  /* ─── Persistence ─── */

  private async saveAgents(): Promise<void> {
    await AsyncStorage.setItem(REGISTRY_KEY, JSON.stringify({ version: 1, agents: this.agents, savedAt: Date.now() }));
  }

  private async saveProposals(): Promise<void> {
    await AsyncStorage.setItem(TX_QUEUE_KEY, JSON.stringify(this.proposals));
  }

  private async savePosts(): Promise<void> {
    await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(this.posts));
  }

  /* ─── Supabase sync helpers ─── */

  private async syncAgentStatus(agentId: string, status: string): Promise<void> {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      await fetch(`${SUPABASE_URL}/rest/v1/agent_registry?agent_id=eq.${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
    } catch (error) {
      console.warn('Failed to sync agent status to Supabase:', error);
    }
  }
}

export const AgentService = new AgentServiceClass();
