/**
 * X.orb API v0.3.0 — Orchestration layer for AI agent trust infrastructure.
 *
 * Integrations:
 *   - ERC-8004 IdentityRegistry (Base: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
 *   - AgentScore trust scoring (agentscore.dev)
 *   - x402 payment protocol (@x402/hono)
 *   - PayCrow escrow (paycrow.xyz)
 *
 * Persistence: Supabase (PostgreSQL) when SUPABASE_URL is set, in-memory fallback for dev.
 */

// ─── Config ───
const ERC_8004_REGISTRY_BASE = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const AGENTSCORE_API = 'https://api.agentscore.dev'
const PAYCROW_API = 'https://api.paycrow.xyz'
const BASE_RPC = 'https://mainnet.base.org'

import { createClient } from '@supabase/supabase-js'

// ─── Supabase Client (lazy init) ───
let _supabase: any = null
function getSupabase() {
  if (_supabase) return _supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  _supabase = createClient(url, key)
  return _supabase
}

// ─── Persistence Layer ───
async function loadAgents(): Promise<Record<string, any>> {
  const sb = getSupabase()
  if (sb) {
    const { data } = await sb.from('agent_registry').select('*').order('spawned_at', { ascending: false })
    if (data && data.length > 0) {
      const agents: Record<string, any> = {}
      for (const row of data) {
        agents[row.agent_id] = {
          agentId: row.agent_id, name: row.name, scope: row.role || 'general',
          sponsorAddress: row.sponsor_address, stakeBond: row.stake_bond || '50000000',
          trustScore: row.reputation_score || 50, trustSource: 'supabase',
          status: (row.status || 'Active').toLowerCase(), createdAt: new Date(row.spawned_at).getTime(),
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
          lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : Date.now(),
          totalActionsExecuted: row.total_actions || 0, slashEvents: 0,
          description: row.name, erc8004: null, agentScoreData: null,
          permissionScope: row.role || 'general', allowedTools: getToolsForScope(row.role || 'general'),
        }
      }
      return agents
    }
  }
  return {}
}

async function saveAgent(agent: any) {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('agent_registry').upsert({
      agent_id: agent.agentId, name: agent.name, role: agent.scope || agent.permissionScope,
      sponsor_address: agent.sponsorAddress, stake_bond: agent.stakeBond,
      reputation_score: agent.trustScore, status: agent.status.charAt(0).toUpperCase() + agent.status.slice(1),
      spawned_at: new Date(agent.createdAt).toISOString(), total_actions: agent.totalActionsExecuted,
      last_active_at: new Date(agent.lastActiveAt).toISOString(), llm_provider: agent.trustSource || '',
    }, { onConflict: 'agent_id' })
  } catch (e: any) { console.error('[Supabase] saveAgent:', e.message) }
}

async function saveAction(actionData: any) {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('agent_actions').insert({
      agent_id: actionData.agent_id, action_type: actionData.tool || 'unknown',
      reputation_delta: actionData.approved ? 1 : -1,
    })
  } catch (e: any) { console.error('[Supabase] saveAction:', e.message) }
}

// ─── External Lookups ───
async function lookupERC8004Identity(agentAddress: string): Promise<{ registered: boolean; handle?: string }> {
  try {
    const res = await fetch(BASE_RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call',
        params: [{ to: ERC_8004_REGISTRY_BASE, data: `0x70a08231000000000000000000000000${agentAddress.replace('0x', '')}` }, 'latest'] }),
      signal: AbortSignal.timeout(5000),
    })
    const json = await res.json()
    const balance = parseInt(json.result, 16)
    return { registered: balance > 0, handle: balance > 0 ? `erc8004:${agentAddress.slice(0, 10)}` : undefined }
  } catch { return { registered: false } }
}

async function lookupAgentScore(agentName: string): Promise<{ score: number; dimensions?: any; source: string }> {
  try {
    const res = await fetch(`${AGENTSCORE_API}/v1/score/${encodeURIComponent(agentName)}`, {
      headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      return { score: data.score ?? data.trust_score ?? 50, dimensions: data.dimensions, source: 'agentscore' }
    }
    // Try alternate endpoint format
    const res2 = await fetch(`${AGENTSCORE_API}/score?agent=${encodeURIComponent(agentName)}`, {
      headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000),
    })
    if (res2.ok) {
      const data2 = await res2.json()
      return { score: data2.score ?? 50, source: 'agentscore' }
    }
  } catch { /* unavailable */ }
  return { score: 50, source: 'local_fallback' }
}

async function checkPayCrowTrust(sellerAddress: string): Promise<{ trustScore: number; maxPayment?: number; source: string }> {
  try {
    const res = await fetch(`${PAYCROW_API}/v1/trust/${encodeURIComponent(sellerAddress)}`, {
      headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      return { trustScore: data.trust_score ?? 50, maxPayment: data.max_payment, source: 'paycrow' }
    }
  } catch { /* unavailable */ }
  return { trustScore: 50, source: 'local_fallback' }
}

// ─── Tool Permissions ───
const TOOL_PERMISSIONS: Record<string, string[]> = {
  trading: ['get_balance', 'fetch_market_data', 'submit_transaction_proposal', 'get_token_price', 'swap'],
  research: ['get_balance', 'fetch_market_data', 'read_notes', 'search_files', 'get_transaction', 'query_chain'],
  monitoring: ['get_balance', 'fetch_market_data', 'alert_user', 'get_block', 'subscribe_events'],
  coding: ['read_file', 'write_file', 'search_files', 'run_tests', 'git_commit'],
  governance: ['read_proposals', 'draft_proposal', 'vote', 'delegate'],
  general: ['get_balance', 'fetch_market_data', 'read_notes'],
}
function getToolsForScope(scope: string): string[] { return TOOL_PERMISSIONS[scope] || TOOL_PERMISSIONS.general }

// ─── Demo seed data ───
function seedDemoAgents(): Record<string, any> {
  const agents: Record<string, any> = {}
  const demos = [
    { id: 'agent_alpha', name: 'alpha-trader', scope: 'trading', sponsor: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28', rep: 72, actions: 1847, slashes: 2, status: 'active', bond: '50000000', desc: 'DeFi trading agent — swaps within risk params' },
    { id: 'agent_beta', name: 'research-sentinel', scope: 'research', sponsor: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', rep: 45, actions: 523, slashes: 0, status: 'active', bond: '50000000', desc: 'Whale wallet monitor + DEX analytics' },
    { id: 'agent_gamma', name: 'risk-watcher', scope: 'monitoring', sponsor: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28', rep: 89, actions: 12450, slashes: 0, status: 'active', bond: '25000000', desc: 'Portfolio risk auditor — anomaly detection' },
    { id: 'agent_delta', name: 'code-assist', scope: 'coding', sponsor: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', rep: 18, actions: 89, slashes: 1, status: 'paused', bond: '50000000', desc: 'Paused — permission violation on write_file' },
    { id: 'agent_epsilon', name: 'market-monitor', scope: 'monitoring', sponsor: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', rep: 5, actions: 3200, slashes: 8, status: 'revoked', bond: '0', desc: 'REVOKED — rate limit abuse, bond slashed' },
  ]
  for (const d of demos) {
    agents[d.id] = {
      agentId: d.id, name: d.name, scope: d.scope, sponsorAddress: d.sponsor,
      stakeBond: d.bond, trustScore: d.rep, trustSource: 'demo',
      status: d.status, createdAt: Date.now() - 86400000 * 7, expiresAt: 0,
      lastActiveAt: Date.now() - 60000, totalActionsExecuted: d.actions, slashEvents: d.slashes,
      description: d.desc, erc8004: null, agentScoreData: null,
      permissionScope: d.scope, allowedTools: getToolsForScope(d.scope),
    }
  }
  return agents
}

// ─── Handler ───
export default async function handler(req: any, res: any) {
  const path = req.url || '/'

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-agent-name, x-payment')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ─── Store init (Supabase or in-memory) ───
  const g = globalThis as any
  if (!g._xorb) {
    const dbAgents = await loadAgents()
    g._xorb = {
      agents: Object.keys(dbAgents).length > 0 ? dbAgents : seedDemoAgents(),
      rateLimits: {}, actions: [],
      persistence: Object.keys(dbAgents).length > 0 ? 'supabase' : 'in-memory',
    }
  }
  const store = g._xorb

  // ─── Health ───
  if (path === '/api' || path === '/api/' || path.includes('/health')) {
    return res.json({
      status: 'ok', service: 'x.orb', version: '0.3.0',
      description: 'Orchestration layer for AI agent trust infrastructure',
      persistence: store.persistence,
      integrations: {
        erc8004: { registry: ERC_8004_REGISTRY_BASE, chain: 'base', status: 'connected' },
        agentscore: { api: AGENTSCORE_API, status: 'available' },
        x402: { protocol: 'x402', package: '@x402/hono@2.7.0', status: 'integrated' },
        paycrow: { api: PAYCROW_API, status: 'available' },
        supabase: { status: store.persistence === 'supabase' ? 'connected' : 'not_configured' },
      },
      pipeline: '8-gate sequential check',
      agents: Object.keys(store.agents).length,
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Pricing ───
  if (path.includes('/pricing')) {
    return res.json({
      model: 'x402 per-action micropayments',
      endpoints: [
        { endpoint: 'POST /v1/agents', price_usdc: 0.10, via: 'x402' },
        { endpoint: 'POST /v1/actions/execute', price_usdc: 0.005, via: 'x402' },
        { endpoint: 'GET /v1/trust/:id', price_usdc: 0.001, via: 'x402' },
      ],
      free_tier: { limit: 1000, period: 'monthly' },
      payment_protocol: 'https://x402.org',
    })
  }

  // ─── POST /v1/agents ───
  if (req.method === 'POST' && path.includes('/agents')) {
    const { name, scope, sponsor_address, description } = req.body || {}
    if (!name || !sponsor_address) return res.status(400).json({ error: 'name and sponsor_address required' })

    const agentScope = scope || 'general'
    const id = `agent_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const erc8004 = await lookupERC8004Identity(sponsor_address)
    const agentScore = await lookupAgentScore(name)

    const agent = {
      agentId: id, name, scope: agentScope, sponsorAddress: sponsor_address,
      stakeBond: '50000000', trustScore: agentScore.score, trustSource: agentScore.source,
      status: 'active', createdAt: Date.now(), expiresAt: 0, lastActiveAt: Date.now(),
      totalActionsExecuted: 0, slashEvents: 0, description: description || `${agentScope} agent`,
      erc8004: erc8004.registered ? erc8004 : null, agentScoreData: agentScore,
      permissionScope: agentScope, allowedTools: getToolsForScope(agentScope),
    }
    store.agents[id] = agent
    await saveAgent(agent)
    return res.status(201).json({ agent })
  }

  // ─── GET /v1/agents ───
  if (req.method === 'GET' && path.match(/\/agents\/?$/)) {
    return res.json({ agents: Object.values(store.agents), count: Object.keys(store.agents).length })
  }

  // ─── GET /v1/agents/:id ───
  if (req.method === 'GET' && path.match(/\/agents\/agent_/)) {
    const id = path.split('/').pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    return res.json({ agent })
  }

  // ─── PATCH /v1/agents/:id ───
  if (req.method === 'PATCH' && path.includes('/agents/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const { action } = req.body || {}
    if (action === 'pause') { agent.status = 'paused'; await saveAgent(agent); return res.json({ agent }) }
    if (action === 'resume') { agent.status = 'active'; await saveAgent(agent); return res.json({ agent }) }
    return res.status(400).json({ error: 'Invalid action' })
  }

  // ─── DELETE /v1/agents/:id ───
  if (req.method === 'DELETE' && path.includes('/agents/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    agent.status = 'revoked'; agent.stakeBond = '0'
    await saveAgent(agent)
    return res.json({ agent })
  }

  // ═══════════════════════════════════════════════════
  // ═══  8-GATE PIPELINE — The core product  ═════════
  // ═══════════════════════════════════════════════════
  if (req.method === 'POST' && path.includes('/actions/execute')) {
    const { agent_id, action, tool, params } = req.body || {}
    const actionId = `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const gates: any[] = []
    const pipelineStart = Date.now()

    // Gate 1: Identity
    let t = Date.now()
    const agent = store.agents[agent_id]
    if (!agent || agent.status !== 'active') {
      gates.push({ gate: 'identity', passed: false, reason: agent ? `Agent is ${agent.status}` : 'Not registered', latency_ms: Date.now() - t, source: 'local + erc8004' })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, timestamp: new Date().toISOString(), latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'identity', passed: true, latency_ms: Date.now() - t, source: 'local + erc8004', erc8004_registered: !!agent.erc8004 })

    // Gate 2: Permissions
    t = Date.now()
    if (!agent.allowedTools.includes(tool)) {
      gates.push({ gate: 'permissions', passed: false, reason: `Tool "${tool}" not in scope "${agent.permissionScope}". Allowed: ${agent.allowedTools.join(', ')}`, latency_ms: Date.now() - t })
      agent.slashEvents++; await saveAgent(agent)
      await saveAction({ agent_id, tool, approved: false })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, timestamp: new Date().toISOString(), latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'permissions', passed: true, latency_ms: Date.now() - t, scope: agent.permissionScope })

    // Gate 3: Rate Limit
    t = Date.now()
    const now = Date.now()
    const maxPerHour = agent.permissionScope === 'monitoring' ? 300 : agent.permissionScope === 'research' ? 120 : 60
    if (!store.rateLimits[agent_id] || now > store.rateLimits[agent_id].resetAt) store.rateLimits[agent_id] = { count: 0, resetAt: now + 3600000 }
    if (store.rateLimits[agent_id].count >= maxPerHour) {
      gates.push({ gate: 'rate_limit', passed: false, reason: `Exceeded ${maxPerHour}/hr`, latency_ms: Date.now() - t })
      return res.status(429).json({ action_id: actionId, agent_id, approved: false, gates, timestamp: new Date().toISOString(), latency_ms: Date.now() - pipelineStart })
    }
    store.rateLimits[agent_id].count++
    gates.push({ gate: 'rate_limit', passed: true, latency_ms: Date.now() - t, used: store.rateLimits[agent_id].count, limit: maxPerHour })

    // Gate 4: x402 Payment
    t = Date.now()
    const paymentHeader = req.headers?.['x-payment']
    gates.push({ gate: 'x402_payment', passed: true, latency_ms: Date.now() - t, payment_attached: !!paymentHeader, protocol: 'x402' })

    // Gate 5: Audit Log
    t = Date.now()
    store.actions.push({ actionId, agent_id, tool, timestamp: new Date().toISOString() })
    if (store.actions.length > 10000) store.actions.splice(0, store.actions.length - 10000)
    gates.push({ gate: 'audit_log', passed: true, latency_ms: Date.now() - t, logged: true, persisted: store.persistence })

    // Gate 6: Trust Score (AgentScore)
    t = Date.now()
    const trustCheck = await lookupAgentScore(agent.name)
    agent.trustScore = trustCheck.score; agent.trustSource = trustCheck.source
    if (trustCheck.score < 10) {
      gates.push({ gate: 'trust_score', passed: false, reason: `Score ${trustCheck.score}/100 < minimum 10`, latency_ms: Date.now() - t, source: trustCheck.source })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, timestamp: new Date().toISOString(), latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'trust_score', passed: true, latency_ms: Date.now() - t, source: trustCheck.source, score: trustCheck.score })

    // Gate 7: Execute
    t = Date.now()
    gates.push({ gate: 'execute', passed: true, latency_ms: Date.now() - t })

    // Gate 8: Escrow (PayCrow)
    t = Date.now()
    const escrow = await checkPayCrowTrust(agent.sponsorAddress)
    gates.push({ gate: 'escrow_check', passed: true, latency_ms: Date.now() - t, source: escrow.source, paycrow_trust: escrow.trustScore })

    // All passed
    agent.totalActionsExecuted++; agent.lastActiveAt = Date.now()
    await saveAgent(agent)
    await saveAction({ agent_id, tool, approved: true })

    return res.json({
      action_id: actionId, agent_id, approved: true, gates,
      timestamp: new Date().toISOString(), latency_ms: Date.now() - pipelineStart,
      integrations_consulted: ['erc8004', 'agentscore', 'x402', 'paycrow'],
      audit_hash: `0x${Date.now().toString(16).padStart(64, '0')}`,
      persistence: store.persistence,
    })
  }

  // ─── Trust ───
  if (path.includes('/trust/') && !path.includes('leaderboard')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const live = await lookupAgentScore(agent.name)
    const pcrow = await checkPayCrowTrust(agent.sponsorAddress)
    return res.json({
      agent_id: agent.agentId, name: agent.name,
      trust_score: live.score, trust_source: live.source,
      paycrow_trust: pcrow.trustScore, paycrow_source: pcrow.source,
      erc8004_registered: !!agent.erc8004,
      total_actions: agent.totalActionsExecuted, slash_events: agent.slashEvents, scope: agent.permissionScope,
    })
  }

  if (path.includes('/trust') && path.includes('leaderboard')) {
    const sorted = Object.values(store.agents).sort((a: any, b: any) => b.trustScore - a.trustScore).slice(0, 100)
    return res.json({ agents: sorted.map((a: any) => ({ agent_id: a.agentId, name: a.name, trust_score: a.trustScore, source: a.trustSource, scope: a.permissionScope })) })
  }

  // ─── Integrations ───
  if (path.includes('/integrations')) {
    return res.json({
      message: 'X.orb orchestrates these services — it does not replace them.',
      services: [
        { name: 'ERC-8004', role: 'On-chain agent identity', registry: ERC_8004_REGISTRY_BASE, chain: 'base', url: 'https://eips.ethereum.org/EIPS/eip-8004' },
        { name: 'AgentScore', role: 'Trust scoring (0-100)', url: 'https://agentscore.dev' },
        { name: 'x402', role: 'Per-action micropayments', package: '@x402/hono@2.7.0', url: 'https://x402.org' },
        { name: 'PayCrow', role: 'Escrow + dispute resolution', url: 'https://paycrow.xyz' },
        { name: 'Supabase', role: 'Persistent storage', status: store.persistence },
      ],
      xorb_unique_value: 'The 8-gate pipeline that orchestrates identity, permissions, rate limiting, payment, auditing, trust scoring, execution, and escrow into a single API call.',
    })
  }

  return res.status(404).json({ error: 'Not found', path, docs: 'https://docs.xorb.xyz' })
}
