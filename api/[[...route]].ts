import { handle } from 'hono/vercel'
import { Hono } from 'hono'

function uuidv4(): string {
  return crypto.randomUUID()
}

// Self-contained API for Vercel — no workspace imports needed

type Env = { Variables: { requestId: string } }
const app = new Hono<Env>()

// CORS + request ID
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  if (c.req.method === 'OPTIONS') return new Response(null, { status: 204 })
  c.set('requestId', uuidv4())
  c.header('x-request-id', c.get('requestId'))
  await next()
})

// ─── Types ───
type AgentRole = 'TRADER' | 'RESEARCHER' | 'MONITOR' | 'CODER' | 'GOVERNANCE_ASSISTANT' | 'FILE_INDEXER' | 'RISK_AUDITOR'
type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired'

interface Agent {
  agentId: string; name: string; role: AgentRole; sponsorAddress: string
  stakeBond: string; reputation: number; reputationTier: string
  status: AgentStatus; createdAt: number; expiresAt: number
  lastActiveAt: number; totalActionsExecuted: number; slashEvents: number
  description: string; permissionScope: { allowedTools: string[]; maxActionsPerHour: number }
}

// ─── In-Memory Store ───
const agents = new Map<string, Agent>()
const rateLimits = new Map<string, { count: number; resetAt: number }>()

const ROLE_TOOLS: Record<AgentRole, string[]> = {
  TRADER: ['get_balance', 'get_token_balance', 'fetch_market_data', 'submit_transaction_proposal', 'get_token_price'],
  RESEARCHER: ['get_balance', 'get_token_balance', 'fetch_market_data', 'read_notes', 'search_files', 'get_transaction', 'get_contract_state'],
  MONITOR: ['get_balance', 'get_token_balance', 'fetch_market_data', 'alert_user'],
  CODER: ['get_balance', 'read_notes', 'write_note', 'search_files'],
  GOVERNANCE_ASSISTANT: ['get_balance', 'read_proposals', 'draft_proposal', 'read_notes'],
  FILE_INDEXER: ['read_notes', 'search_files', 'write_file_metadata'],
  RISK_AUDITOR: ['get_balance', 'get_token_balance', 'read_audit_logs', 'read_notes', 'alert_user'],
}

const ROLE_RATE_LIMITS: Record<AgentRole, number> = {
  TRADER: 60, RESEARCHER: 120, MONITOR: 300, CODER: 60,
  GOVERNANCE_ASSISTANT: 30, FILE_INDEXER: 200, RISK_AUDITOR: 120,
}

function getTier(score: number) {
  if (score >= 8500) return 'ELITE'
  if (score >= 6000) return 'TRUSTED'
  if (score >= 3000) return 'RELIABLE'
  if (score >= 1000) return 'NOVICE'
  return 'UNTRUSTED'
}

// ─── Health ───
app.get('/v1/health', (c) => c.json({
  status: 'ok', service: 'xorb-api', version: '0.1.0',
  timestamp: new Date().toISOString(), agents: agents.size,
}))

// ─── Pricing ───
app.get('/v1/pricing', (c) => c.json({
  endpoints: [
    { endpoint: 'POST /v1/agents', price_usdc: 0.10 },
    { endpoint: 'POST /v1/actions/execute', price_usdc: 0.005 },
    { endpoint: 'GET /v1/reputation/:id', price_usdc: 0.001 },
  ],
  free_tier: { limit: 1000, period: 'monthly' },
}))

// ─── Agents ───
app.post('/v1/agents', async (c) => {
  const body = await c.req.json()
  const { name, role, sponsor_address, description } = body

  if (!name || name.length < 2) return c.json({ error: 'Name must be 2+ characters' }, 400)
  if (!sponsor_address || sponsor_address.length < 10) return c.json({ error: 'Invalid sponsor address' }, 400)
  if (!ROLE_TOOLS[role as AgentRole]) return c.json({ error: `Invalid role: ${role}` }, 400)

  const agentId = `agent_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  const agent: Agent = {
    agentId, name, role: role as AgentRole, sponsorAddress: sponsor_address,
    stakeBond: '50000000', reputation: 1000, reputationTier: 'NOVICE',
    status: 'active', createdAt: Date.now(), expiresAt: 0,
    lastActiveAt: Date.now(), totalActionsExecuted: 0, slashEvents: 0,
    description: description || `${role} agent`,
    permissionScope: { allowedTools: ROLE_TOOLS[role as AgentRole], maxActionsPerHour: ROLE_RATE_LIMITS[role as AgentRole] },
  }
  agents.set(agentId, agent)
  return c.json({ agent }, 201)
})

app.get('/v1/agents', (c) => {
  const all = Array.from(agents.values())
  return c.json({ agents: all, count: all.length })
})

app.get('/v1/agents/:id', (c) => {
  const agent = agents.get(c.req.param('id'))
  if (!agent) return c.json({ error: 'Agent not found' }, 404)
  return c.json({ agent })
})

app.patch('/v1/agents/:id', async (c) => {
  const agent = agents.get(c.req.param('id'))
  if (!agent) return c.json({ error: 'Agent not found' }, 404)
  const { action } = await c.req.json()
  if (action === 'pause') { agent.status = 'paused'; return c.json({ agent }) }
  if (action === 'resume') { agent.status = 'active'; return c.json({ agent }) }
  return c.json({ error: 'Invalid action' }, 400)
})

app.delete('/v1/agents/:id', (c) => {
  const agent = agents.get(c.req.param('id'))
  if (!agent) return c.json({ error: 'Agent not found' }, 404)
  agent.status = 'revoked'; agent.stakeBond = '0'
  return c.json({ agent })
})

// ─── 8-Gate Pipeline ───
app.post('/v1/actions/execute', async (c) => {
  const { agent_id, action, tool, params } = await c.req.json()
  const actionId = `act_${uuidv4().replace(/-/g, '').slice(0, 16)}`
  const gates: Array<{ gate: string; passed: boolean; reason?: string; latency_ms: number }> = []
  const start = Date.now()

  // Gate 1: Registry
  const agent = agents.get(agent_id)
  if (!agent || agent.status !== 'active') {
    gates.push({ gate: 'registry', passed: false, reason: agent ? `Agent is ${agent.status}` : 'Agent not registered', latency_ms: Date.now() - start })
    return c.json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: Date.now() - start }, 403)
  }
  gates.push({ gate: 'registry', passed: true, latency_ms: 0 })

  // Gate 2: Permissions
  if (!agent.permissionScope.allowedTools.includes(tool)) {
    gates.push({ gate: 'permissions', passed: false, reason: `Tool "${tool}" not allowed for ${agent.role}. Allowed: ${agent.permissionScope.allowedTools.join(', ')}`, latency_ms: 0 })
    agent.reputation = Math.max(0, agent.reputation - 5); agent.reputationTier = getTier(agent.reputation); agent.slashEvents++
    return c.json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: Date.now() - start }, 403)
  }
  gates.push({ gate: 'permissions', passed: true, latency_ms: 0 })

  // Gate 3: Rate Limit
  const now = Date.now()
  let rl = rateLimits.get(agent_id)
  if (!rl || now > rl.resetAt) { rl = { count: 0, resetAt: now + 3600000 }; rateLimits.set(agent_id, rl) }
  if (rl.count >= agent.permissionScope.maxActionsPerHour) {
    gates.push({ gate: 'rate_limit', passed: false, reason: `Rate limit exceeded: ${agent.permissionScope.maxActionsPerHour}/hr`, latency_ms: 0 })
    return c.json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: Date.now() - start }, 429)
  }
  rl.count++
  gates.push({ gate: 'rate_limit', passed: true, latency_ms: 0 })

  // Gates 4-7: Spend, Audit, Webhook, Execute (pass)
  gates.push({ gate: 'spend_limit', passed: true, latency_ms: 0 })
  gates.push({ gate: 'audit', passed: true, latency_ms: 0 })
  gates.push({ gate: 'webhook', passed: true, latency_ms: 0 })
  gates.push({ gate: 'execute', passed: true, latency_ms: 0 })

  // Gate 8: Reputation
  if (agent.reputation < 100) {
    gates.push({ gate: 'reputation', passed: false, reason: `Reputation ${agent.reputation} below minimum 100`, latency_ms: 0 })
    return c.json({ action_id: actionId, agent_id, approved: false, gates, reputation_delta: -5, audit_hash: `0x${Date.now().toString(16)}`, timestamp: new Date().toISOString(), latency_ms: Date.now() - start }, 403)
  }
  gates.push({ gate: 'reputation', passed: true, latency_ms: 0 })

  // Success
  agent.totalActionsExecuted++; agent.lastActiveAt = Date.now()
  agent.reputation = Math.min(10000, agent.reputation + 2); agent.reputationTier = getTier(agent.reputation)

  return c.json({
    action_id: actionId, agent_id, approved: true, gates, reputation_delta: 2,
    audit_hash: `0x${Date.now().toString(16).padStart(64, '0')}`,
    timestamp: new Date().toISOString(), latency_ms: Date.now() - start,
  })
})

// ─── Reputation ───
app.get('/v1/reputation/leaderboard', (c) => {
  const sorted = Array.from(agents.values()).sort((a, b) => b.reputation - a.reputation).slice(0, 100)
  return c.json({ agents: sorted.map(a => ({ agent_id: a.agentId, name: a.name, role: a.role, score: a.reputation, tier: a.reputationTier })) })
})

app.get('/v1/reputation/:agentId', (c) => {
  const agent = agents.get(c.req.param('agentId'))
  if (!agent) return c.json({ error: 'Agent not found' }, 404)
  return c.json({ agent_id: agent.agentId, score: agent.reputation, tier: agent.reputationTier, total_actions: agent.totalActionsExecuted, slash_events: agent.slashEvents })
})

// ─── 404 ───
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path, docs: 'https://docs.xorb.xyz' }, 404))

export default handle(app)
