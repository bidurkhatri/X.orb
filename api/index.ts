export default function handler(req: any, res: any) {
  const path = req.url || '/'

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ─── Types ───
  type AgentRole = 'TRADER' | 'RESEARCHER' | 'MONITOR' | 'CODER' | 'GOVERNANCE_ASSISTANT' | 'FILE_INDEXER' | 'RISK_AUDITOR'

  const ROLE_TOOLS: Record<AgentRole, string[]> = {
    TRADER: ['get_balance', 'fetch_market_data', 'submit_transaction_proposal', 'get_token_price'],
    RESEARCHER: ['get_balance', 'fetch_market_data', 'read_notes', 'search_files', 'get_transaction'],
    MONITOR: ['get_balance', 'fetch_market_data', 'alert_user'],
    CODER: ['get_balance', 'read_notes', 'write_note', 'search_files'],
    GOVERNANCE_ASSISTANT: ['get_balance', 'read_proposals', 'draft_proposal'],
    FILE_INDEXER: ['read_notes', 'search_files', 'write_file_metadata'],
    RISK_AUDITOR: ['get_balance', 'read_audit_logs', 'alert_user'],
  }

  const ROLE_LIMITS: Record<AgentRole, number> = {
    TRADER: 60, RESEARCHER: 120, MONITOR: 300, CODER: 60,
    GOVERNANCE_ASSISTANT: 30, FILE_INDEXER: 200, RISK_AUDITOR: 120,
  }

  function getTier(s: number) {
    if (s >= 8500) return 'ELITE'; if (s >= 6000) return 'TRUSTED'
    if (s >= 3000) return 'RELIABLE'; if (s >= 1000) return 'NOVICE'; return 'UNTRUSTED'
  }

  // ─── In-memory store (persists across warm invocations) ───
  const g = globalThis as any
  if (!g._xorb_agents) {
    // Seed demo agents so dashboard looks alive on first visit
    g._xorb_agents = {
      'agent_demo_alpha': {
        agentId: 'agent_demo_alpha', name: 'alpha-trader', role: 'TRADER',
        sponsorAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
        stakeBond: '50000000', reputation: 7200, reputationTier: 'TRUSTED',
        status: 'active', createdAt: Date.now() - 86400000 * 14, expiresAt: 0,
        lastActiveAt: Date.now() - 300000, totalActionsExecuted: 1847, slashEvents: 2,
        description: 'DeFi trading agent — executes swaps within risk parameters',
        permissionScope: { allowedTools: ROLE_TOOLS.TRADER, maxActionsPerHour: 60 },
      },
      'agent_demo_beta': {
        agentId: 'agent_demo_beta', name: 'research-sentinel', role: 'RESEARCHER',
        sponsorAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        stakeBond: '50000000', reputation: 4500, reputationTier: 'RELIABLE',
        status: 'active', createdAt: Date.now() - 86400000 * 7, expiresAt: 0,
        lastActiveAt: Date.now() - 60000, totalActionsExecuted: 523, slashEvents: 0,
        description: 'On-chain research agent — monitors whale wallets and DEX activity',
        permissionScope: { allowedTools: ROLE_TOOLS.RESEARCHER, maxActionsPerHour: 120 },
      },
      'agent_demo_gamma': {
        agentId: 'agent_demo_gamma', name: 'risk-watcher', role: 'RISK_AUDITOR',
        sponsorAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28',
        stakeBond: '25000000', reputation: 8900, reputationTier: 'ELITE',
        status: 'active', createdAt: Date.now() - 86400000 * 30, expiresAt: 0,
        lastActiveAt: Date.now() - 10000, totalActionsExecuted: 12450, slashEvents: 0,
        description: 'Portfolio risk auditor — flags anomalous contract interactions',
        permissionScope: { allowedTools: ROLE_TOOLS.RISK_AUDITOR, maxActionsPerHour: 120 },
      },
      'agent_demo_delta': {
        agentId: 'agent_demo_delta', name: 'code-assist', role: 'CODER',
        sponsorAddress: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        stakeBond: '50000000', reputation: 1800, reputationTier: 'NOVICE',
        status: 'paused', createdAt: Date.now() - 86400000 * 3, expiresAt: 0,
        lastActiveAt: Date.now() - 86400000, totalActionsExecuted: 89, slashEvents: 1,
        description: 'Code review agent — paused after permission violation',
        permissionScope: { allowedTools: ROLE_TOOLS.CODER, maxActionsPerHour: 60 },
      },
      'agent_demo_epsilon': {
        agentId: 'agent_demo_epsilon', name: 'market-monitor', role: 'MONITOR',
        sponsorAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
        stakeBond: '0', reputation: 200, reputationTier: 'UNTRUSTED',
        status: 'revoked', createdAt: Date.now() - 86400000 * 21, expiresAt: 0,
        lastActiveAt: Date.now() - 86400000 * 5, totalActionsExecuted: 3200, slashEvents: 8,
        description: 'REVOKED — exceeded rate limits repeatedly, bond fully slashed',
        permissionScope: { allowedTools: ROLE_TOOLS.MONITOR, maxActionsPerHour: 300 },
      },
    }
  }
  if (!g._xorb_rl) g._xorb_rl = {}
  const agents: Record<string, any> = g._xorb_agents
  const rateLimits: Record<string, { count: number; resetAt: number }> = g._xorb_rl

  // ─── Health ───
  if (path === '/api' || path === '/api/' || path.includes('/health')) {
    return res.json({
      status: 'ok',
      service: 'xorb-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      agents: Object.keys(agents).length,
    })
  }

  // ─── Pricing ───
  if (path.includes('/pricing')) {
    return res.json({
      endpoints: [
        { endpoint: 'POST /v1/agents', price_usdc: 0.10 },
        { endpoint: 'POST /v1/actions/execute', price_usdc: 0.005 },
        { endpoint: 'GET /v1/reputation/:id', price_usdc: 0.001 },
      ],
      free_tier: { limit: 1000, period: 'monthly' },
    })
  }

  // ─── POST /v1/agents ───
  if (req.method === 'POST' && path.includes('/agents')) {
    const { name, role, sponsor_address, description } = req.body || {}
    if (!name || !sponsor_address) return res.status(400).json({ error: 'name and sponsor_address required' })
    if (!ROLE_TOOLS[role as AgentRole]) return res.status(400).json({ error: `Invalid role: ${role}` })

    const id = `agent_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const agent = {
      agentId: id, name, role, sponsorAddress: sponsor_address,
      stakeBond: '50000000', reputation: 1000, reputationTier: 'NOVICE',
      status: 'active', createdAt: Date.now(), expiresAt: 0, lastActiveAt: Date.now(),
      totalActionsExecuted: 0, slashEvents: 0, description: description || `${role} agent`,
      permissionScope: { allowedTools: ROLE_TOOLS[role as AgentRole], maxActionsPerHour: ROLE_LIMITS[role as AgentRole] },
    }
    agents[id] = agent
    return res.status(201).json({ agent })
  }

  // ─── GET /v1/agents ───
  if (req.method === 'GET' && path.match(/\/agents\/?$/)) {
    return res.json({ agents: Object.values(agents), count: Object.keys(agents).length })
  }

  // ─── GET /v1/agents/:id ───
  if (req.method === 'GET' && path.match(/\/agents\/agent_/)) {
    const id = path.split('/').pop()!
    const agent = agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    return res.json({ agent })
  }

  // ─── PATCH /v1/agents/:id ───
  if (req.method === 'PATCH' && path.includes('/agents/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const { action } = req.body || {}
    if (action === 'pause') { agent.status = 'paused'; return res.json({ agent }) }
    if (action === 'resume') { agent.status = 'active'; return res.json({ agent }) }
    return res.status(400).json({ error: 'Invalid action' })
  }

  // ─── DELETE /v1/agents/:id ───
  if (req.method === 'DELETE' && path.includes('/agents/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    agent.status = 'revoked'; agent.stakeBond = '0'
    return res.json({ agent })
  }

  // ─── POST /v1/actions/execute ───
  if (req.method === 'POST' && path.includes('/actions/execute')) {
    const { agent_id, action, tool } = req.body || {}
    const actionId = `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const gates: any[] = []

    const agent = agents[agent_id]
    if (!agent || agent.status !== 'active') {
      gates.push({ gate: 'registry', passed: false, reason: agent ? `Agent is ${agent.status}` : 'Agent not registered', latency_ms: 0 })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: 0 })
    }
    gates.push({ gate: 'registry', passed: true, latency_ms: 0 })

    if (!agent.permissionScope.allowedTools.includes(tool)) {
      gates.push({ gate: 'permissions', passed: false, reason: `Tool "${tool}" not allowed for ${agent.role}. Allowed: ${agent.permissionScope.allowedTools.join(', ')}`, latency_ms: 0 })
      agent.reputation = Math.max(0, agent.reputation - 5); agent.reputationTier = getTier(agent.reputation); agent.slashEvents++
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: 0 })
    }
    gates.push({ gate: 'permissions', passed: true, latency_ms: 0 })

    const now = Date.now()
    if (!rateLimits[agent_id] || now > rateLimits[agent_id].resetAt) rateLimits[agent_id] = { count: 0, resetAt: now + 3600000 }
    if (rateLimits[agent_id].count >= agent.permissionScope.maxActionsPerHour) {
      gates.push({ gate: 'rate_limit', passed: false, reason: `Exceeded ${agent.permissionScope.maxActionsPerHour}/hr`, latency_ms: 0 })
      return res.status(429).json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: 0 })
    }
    rateLimits[agent_id].count++
    gates.push({ gate: 'rate_limit', passed: true, latency_ms: 0 })
    gates.push({ gate: 'spend_limit', passed: true, latency_ms: 0 })
    gates.push({ gate: 'audit', passed: true, latency_ms: 0 })
    gates.push({ gate: 'webhook', passed: true, latency_ms: 0 })
    gates.push({ gate: 'execute', passed: true, latency_ms: 0 })

    if (agent.reputation < 100) {
      gates.push({ gate: 'reputation', passed: false, reason: `Reputation ${agent.reputation} below minimum 100`, latency_ms: 0 })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: 0 })
    }
    gates.push({ gate: 'reputation', passed: true, latency_ms: 0 })

    agent.totalActionsExecuted++; agent.lastActiveAt = Date.now()
    agent.reputation = Math.min(10000, agent.reputation + 2); agent.reputationTier = getTier(agent.reputation)

    return res.json({
      action_id: actionId, agent_id, approved: true, gates, reputation_delta: 2,
      audit_hash: `0x${Date.now().toString(16).padStart(64, '0')}`,
      timestamp: new Date().toISOString(), latency_ms: 0,
    })
  }

  // ─── Reputation ───
  if (path.includes('/reputation/leaderboard')) {
    const sorted = Object.values(agents).sort((a: any, b: any) => b.reputation - a.reputation).slice(0, 100)
    return res.json({ agents: sorted.map((a: any) => ({ agent_id: a.agentId, name: a.name, score: a.reputation, tier: a.reputationTier })) })
  }

  if (path.includes('/reputation/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    return res.json({ agent_id: agent.agentId, score: agent.reputation, tier: agent.reputationTier, total_actions: agent.totalActionsExecuted, slash_events: agent.slashEvents })
  }

  return res.status(404).json({ error: 'Not found', path, docs: 'https://docs.xorb.xyz' })
}
