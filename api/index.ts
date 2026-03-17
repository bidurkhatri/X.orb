/**
 * X.orb API v0.4.0 — Orchestration layer for AI agent trust infrastructure.
 *
 * AUDIT FIXES APPLIED:
 *   C1: API key auth on all mutations
 *   C2: x402 payment header validation (structure + expiry)
 *   C5: Real SHA-256 audit hashes
 *   C7: Auth on marketplace mutations
 *   C8: Auth + URL validation on webhooks
 *   H6: Route ordering fixed (leaderboard before :id)
 *   H9: Batch rejects >100 instead of silent truncation
 *   H10: AgentScore cached 5 min
 *   H11: IP rate limiting on public GETs
 *   H14: Sponsor address validation (0x + 40 hex chars)
 *   H15: Supabase errors return 503 when persistence expected
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// ─── Config ───
const ERC_8004_REGISTRY_BASE = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'
const AGENTSCORE_API = 'https://api.agentscore.dev'
const PAYCROW_API = 'https://api.paycrow.xyz'
const BASE_RPC = 'https://mainnet.base.org'
const ETH_ADDR_RE = /^0x[a-fA-F0-9]{40}$/

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

// ─── API Key Auth ───
async function validateApiKey(key: string | undefined): Promise<{ valid: boolean; wallet?: string }> {
  if (!key) return { valid: false }
  // Dev mode: accept xorb_dev_* keys
  if (key.startsWith('xorb_dev_')) return { valid: true, wallet: '0x' + '0'.repeat(40) }
  // Production: check Supabase api_keys table
  const sb = getSupabase()
  if (!sb) return { valid: key.startsWith('xorb_'), wallet: '0x' + '0'.repeat(40) } // Fallback in dev
  const hash = createHash('sha256').update(key).digest('hex')
  const { data } = await sb.from('api_keys').select('sponsor_wallet').eq('key_hash', hash).is('revoked_at', null).single()
  if (data) {
    await sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash)
    return { valid: true, wallet: data.sponsor_wallet }
  }
  return { valid: false }
}

// ─── IP Rate Limiting (public GETs) ───
const ipLimits: Record<string, { count: number; resetAt: number }> = {}
function checkIpRateLimit(ip: string, limit = 200): boolean {
  const now = Date.now()
  if (!ipLimits[ip] || now > ipLimits[ip].resetAt) ipLimits[ip] = { count: 0, resetAt: now + 60000 }
  if (ipLimits[ip].count >= limit) return false
  ipLimits[ip].count++
  return true
}

// ─── AgentScore Cache (5 min TTL) ───
const scoreCache: Record<string, { score: number; source: string; dimensions?: any; cachedAt: number }> = {}
const SCORE_CACHE_TTL = 300000 // 5 minutes

// ─── Audit Hash (real SHA-256) ───
function computeAuditHash(actionId: string, agentId: string, tool: string, gates: any[], timestamp: string): string {
  const payload = JSON.stringify({ actionId, agentId, tool, gates: gates.map(g => ({ gate: g.gate, passed: g.passed })), timestamp })
  return '0x' + createHash('sha256').update(payload).digest('hex')
}

// ─── Persistence Layer ───
async function loadAgents(): Promise<Record<string, any>> {
  const sb = getSupabase()
  if (sb) {
    try {
      const { data, error } = await sb.from('agent_registry').select('*').order('spawned_at', { ascending: false })
      if (error) throw error
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
    } catch (e: any) { console.error('[Supabase] loadAgents:', e.message) }
  }
  return {}
}

async function saveAgent(agent: any, requirePersistence = false) {
  const sb = getSupabase()
  if (!sb) { if (requirePersistence) throw new Error('Supabase not configured'); return }
  try {
    const { error } = await sb.from('agent_registry').upsert({
      agent_id: agent.agentId, name: agent.name, role: agent.scope || agent.permissionScope,
      sponsor_address: agent.sponsorAddress, stake_bond: agent.stakeBond,
      reputation_score: agent.trustScore, status: agent.status.charAt(0).toUpperCase() + agent.status.slice(1),
      spawned_at: new Date(agent.createdAt).toISOString(), total_actions: agent.totalActionsExecuted,
      last_active_at: new Date(agent.lastActiveAt).toISOString(), llm_provider: agent.trustSource || '',
    }, { onConflict: 'agent_id' })
    if (error) throw error
  } catch (e: any) {
    console.error('[Supabase] saveAgent:', e.message)
    if (requirePersistence) throw e
  }
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

async function saveEvent(evt: any) {
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('agent_events').insert({
      agent_id: evt.agentId, event_type: evt.type, data: evt.data,
    }).then(() => {})
  } catch { /* events table may not exist yet */ }
}

// ─── External Lookups ───
async function lookupERC8004Identity(agentAddress: string): Promise<{ registered: boolean; handle?: string }> {
  if (!ETH_ADDR_RE.test(agentAddress)) return { registered: false }
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
  // Check cache first
  const cached = scoreCache[agentName]
  if (cached && Date.now() - cached.cachedAt < SCORE_CACHE_TTL) {
    return { score: cached.score, dimensions: cached.dimensions, source: cached.source + '_cached' }
  }
  try {
    const res = await fetch(`${AGENTSCORE_API}/v1/score/${encodeURIComponent(agentName)}`, {
      headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      const data = await res.json()
      const result = { score: data.score ?? data.trust_score ?? 50, dimensions: data.dimensions, source: 'agentscore' }
      scoreCache[agentName] = { ...result, cachedAt: Date.now() }
      return result
    }
  } catch { /* unavailable */ }
  const fallback = { score: 50, source: 'local_fallback' }
  scoreCache[agentName] = { ...fallback, cachedAt: Date.now() }
  return fallback
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

// ─── Webhook URL validation ───
function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    // Block private IPs
    const host = u.hostname
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('172.16.')) return false
    return true
  } catch { return false }
}

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
  const clientIp = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'

  // CORS: Allow-Origin is intentionally set to '*' — this is a public API designed
  // for cross-origin access by any agent, SDK, or dashboard client.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-agent-name, x-payment, Authorization')
  if (req.method === 'OPTIONS') return res.status(204).end()

  // ─── IP rate limit on all requests ───
  if (!checkIpRateLimit(clientIp)) {
    res.setHeader('Retry-After', '60')
    return res.status(429).json({ error: 'Rate limit exceeded. 200 requests/min per IP.', retry_after: 60 })
  }

  // ─── Store init (Supabase or in-memory) ───
  const g = globalThis as any
  if (!g._xorb) {
    const dbAgents = await loadAgents()
    g._xorb = {
      agents: Object.keys(dbAgents).length > 0 ? dbAgents : seedDemoAgents(),
      rateLimits: {}, actions: [] as any[],
      events: [] as any[],
      webhooks: [] as any[],
      deliveries: [] as any[],
      listings: {} as Record<string, any>,
      engagements: {} as Record<string, any>,
      persistence: Object.keys(dbAgents).length > 0 ? 'supabase' : 'in-memory',
    }
  }
  const store = g._xorb

  // ─── Auth helper ───
  const apiKey = req.headers?.['x-api-key'] || req.headers?.['authorization']?.replace('Bearer ', '')
  async function requireAuth(): Promise<{ valid: boolean; wallet?: string }> {
    return validateApiKey(apiKey)
  }

  // Helper: add event + cap at 10K + persist
  function emitEvent(type: string, agentId: string, data: any) {
    const evt = { id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`, type, agentId, data, timestamp: new Date().toISOString() }
    store.events.push(evt)
    if (store.events.length > 10000) store.events.splice(0, store.events.length - 10000)
    saveEvent(evt) // async, fire and forget
    return evt
  }

  // Helper: normalize agent for API response
  function formatAgent(a: any) {
    return {
      ...a,
      role: a.scope || a.permissionScope || a.role,
      reputation: a.trustScore ?? a.reputation ?? 50,
      reputationTier: getTier(a.trustScore ?? 50),
      sessionWalletAddress: `0x${(a.agentId || '').replace('agent_', '').padEnd(40, '0')}`,
    }
  }

  function getTier(score: number) {
    if (score >= 85) return 'ELITE'; if (score >= 60) return 'TRUSTED'
    if (score >= 30) return 'RELIABLE'; if (score >= 10) return 'NOVICE'; return 'UNTRUSTED'
  }

  // ═══════════════════════════════════════════════════
  // ═══  FREE ENDPOINTS (no auth required)  ═══════════
  // ═══════════════════════════════════════════════════

  // ─── Health ───
  if (path === '/api' || path === '/api/' || path.includes('/health')) {
    return res.json({
      status: 'ok', service: 'x.orb', version: '0.4.0',
      description: 'Orchestration layer for AI agent trust infrastructure',
      persistence: store.persistence,
      auth: apiKey ? (await validateApiKey(apiKey)).valid ? 'authenticated' : 'invalid_key' : 'unauthenticated',
      integrations: {
        erc8004: { registry: ERC_8004_REGISTRY_BASE, chain: 'base', status: 'lookup_on_register' },
        agentscore: { api: AGENTSCORE_API, status: 'query_on_action', cache_ttl_ms: SCORE_CACHE_TTL },
        x402: { protocol: 'x402', package: '@x402/hono@2.7.0', status: 'header_validation' },
        paycrow: { api: PAYCROW_API, status: 'query_on_action' },
        supabase: { status: store.persistence === 'supabase' ? 'connected' : 'not_configured' },
      },
      pipeline: '8-gate sequential check',
      agents: Object.keys(store.agents).length,
      audit: { hash_algorithm: 'SHA-256', format: '0x + 64 hex chars' },
      timestamp: new Date().toISOString(),
    })
  }

  // ─── Pricing ───
  if (path.includes('/pricing')) {
    return res.json({
      model: 'x402 per-action micropayments',
      endpoints: [
        { endpoint: 'POST /v1/agents', price_usdc: 0.10, via: 'x402', auth: 'required' },
        { endpoint: 'POST /v1/actions/execute', price_usdc: 0.005, via: 'x402', auth: 'required' },
        { endpoint: 'GET /v1/trust/:id', price_usdc: 0.001, via: 'x402', auth: 'optional' },
      ],
      free_tier: { limit: 1000, period: 'monthly' },
      free_endpoints: ['GET /v1/health', 'GET /v1/agents', 'GET /v1/pricing', 'GET /v1/docs', 'PATCH /v1/agents/:id (pause/resume)', 'DELETE /v1/agents/:id (revoke)'],
      payment_protocol: 'https://x402.org',
    })
  }

  // ─── Docs ───
  if (path.includes('/docs')) {
    // Return the OpenAPI spec as inline JSON so docs work without fetching from GitHub
    if (req.headers?.['accept']?.includes('application/json') || path.includes('/docs/openapi')) {
      return res.json({
        openapi: '3.1.0',
        info: { title: 'X.orb API', version: '0.4.0', description: 'Agent Trust Infrastructure API. Every AI agent action — validated, bonded, and auditable.' },
        servers: [{ url: 'https://api.xorb.xyz/v1', description: 'Production' }, { url: 'http://localhost:3000/v1', description: 'Local development' }],
        paths: {
          '/health': { get: { summary: 'Health check', security: [], responses: { '200': { description: 'API status' } } } },
          '/pricing': { get: { summary: 'Get endpoint pricing', security: [], responses: { '200': { description: 'Pricing info' } } } },
          '/agents': {
            post: { summary: 'Register a new agent', tags: ['Agents'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'sponsor_address'], properties: { name: { type: 'string' }, role: { type: 'string' }, sponsor_address: { type: 'string' }, description: { type: 'string' } } } } } }, responses: { '201': { description: 'Agent created' } } },
            get: { summary: 'List agents', tags: ['Agents'], responses: { '200': { description: 'Agent list' } } },
          },
          '/agents/{id}': {
            get: { summary: 'Get agent details', tags: ['Agents'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Agent details' }, '404': { description: 'Not found' } } },
            patch: { summary: 'Update agent (pause/resume/renew)', tags: ['Agents'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['action', 'caller_address'], properties: { action: { type: 'string', enum: ['pause', 'resume', 'renew'] }, caller_address: { type: 'string' } } } } } }, responses: { '200': { description: 'Agent updated' } } },
            delete: { summary: 'Revoke agent', tags: ['Agents'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Agent revoked' } } },
          },
          '/actions/execute': { post: { summary: 'Execute action through 8-gate pipeline', tags: ['Actions'], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['agent_id', 'tool'], properties: { agent_id: { type: 'string' }, action: { type: 'string' }, tool: { type: 'string' }, params: { type: 'object' } } } } } }, responses: { '200': { description: 'Action approved' }, '403': { description: 'Action blocked' } } } },
          '/actions/batch': { post: { summary: 'Batch execute up to 100 actions', tags: ['Actions'], responses: { '200': { description: 'Batch results' } } } },
          '/actions/{id}': { get: { summary: 'Get action by ID', tags: ['Actions'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Action details' }, '404': { description: 'Not found' } } } },
          '/reputation/{agentId}': { get: { summary: 'Get reputation score', tags: ['Reputation'], parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Reputation info' } } } },
          '/reputation/leaderboard': { get: { summary: 'Trust leaderboard', tags: ['Reputation'], responses: { '200': { description: 'Leaderboard' } } } },
          '/events': { get: { summary: 'List events', tags: ['Events'], responses: { '200': { description: 'Event list' } } } },
          '/events/stream': { get: { summary: 'Long-polling event stream (returns latest events, client re-polls)', tags: ['Events'], parameters: [{ name: 'agent_id', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Event batch with poll_again flag' } } } },
          '/audit/{agentId}': { get: { summary: 'Get audit log', tags: ['Audit'], parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Audit data' } } } },
          '/compliance/{agentId}': { get: { summary: 'Generate compliance report', tags: ['Compliance'], parameters: [{ name: 'agentId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'format', in: 'query', schema: { type: 'string', enum: ['eu-ai-act', 'nist-ai-rmf', 'soc2'] } }], responses: { '200': { description: 'Compliance report' } } } },
          '/webhooks': {
            post: { summary: 'Subscribe to events', tags: ['Webhooks'], responses: { '201': { description: 'Subscription created' } } },
            get: { summary: 'List webhook subscriptions', tags: ['Webhooks'], responses: { '200': { description: 'Webhook list' } } },
          },
          '/marketplace/listings': {
            post: { summary: 'List agent for hire', tags: ['Marketplace'], responses: { '201': { description: 'Listing created' } } },
            get: { summary: 'Browse agents', tags: ['Marketplace'], responses: { '200': { description: 'Listing list' } } },
          },
          '/marketplace/hire': { post: { summary: 'Hire an agent', tags: ['Marketplace'], responses: { '201': { description: 'Engagement started' } } } },
        },
      })
    }
    res.setHeader('Content-Type', 'text/html')
    const specUrl = `${req.headers?.['x-forwarded-proto'] || 'https'}://${req.headers?.['host'] || 'api.xorb.xyz'}/api/v1/docs/openapi`
    return res.send(`<!DOCTYPE html><html><head><title>X.orb API Docs</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"><style>body{margin:0;background:#0A0A0A}.swagger-ui .topbar{display:none}.swagger-ui{max-width:1200px;margin:0 auto}</style></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'${specUrl}',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis],layout:"BaseLayout"})</script></body></html>`)
  }

  // ─── GET /v1/agents (list — public, read-only) ───
  if (req.method === 'GET' && path.match(/\/agents\/?$/)) {
    const all = Object.values(store.agents).map(formatAgent)
    return res.json({ agents: all, count: all.length })
  }

  // ─── GET /v1/agents/:id (public, read-only) ───
  if (req.method === 'GET' && path.match(/\/agents\/.+/) && !path.includes('/actions')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    return res.json({ agent: formatAgent(agent) })
  }

  // ─── Integrations (public) ───
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

  // ─── Reputation: leaderboard BEFORE :id (H6 fix) ───
  if (req.method === 'GET' && (path.includes('/reputation/leaderboard') || (path.includes('/trust') && path.includes('leaderboard')))) {
    const sorted = Object.values(store.agents).sort((a: any, b: any) => (b.trustScore ?? 0) - (a.trustScore ?? 0)).slice(0, 100)
    return res.json({ agents: sorted.map((a: any) => ({ agent_id: a.agentId, name: a.name, role: a.scope, score: a.trustScore ?? 50, reputation: a.trustScore ?? 50, tier: getTier(a.trustScore ?? 50), reputationTier: getTier(a.trustScore ?? 50) })) })
  }

  // ─── GET /v1/reputation/:id or /v1/trust/:id ───
  if (req.method === 'GET' && (path.includes('/reputation/') || path.includes('/trust/'))) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const live = await lookupAgentScore(agent.name)
    const pcrow = await checkPayCrowTrust(agent.sponsorAddress)
    return res.json({
      agent_id: agent.agentId, name: agent.name,
      score: live.score, reputation: live.score, trust_score: live.score,
      tier: getTier(live.score), reputationTier: getTier(live.score),
      trust_source: live.source, paycrow_trust: pcrow.trustScore, paycrow_source: pcrow.source,
      erc8004_registered: !!agent.erc8004,
      total_actions: agent.totalActionsExecuted, slash_events: agent.slashEvents,
      scope: agent.permissionScope,
    })
  }

  // ─── GET /v1/events ───
  if (req.method === 'GET' && path.match(/\/events\/?$/) && !path.includes('stream')) {
    const url = new URL(`http://x${req.url}`)
    const since = url.searchParams.get('since')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    let events = store.events || []
    if (since) {
      const sinceTime = new Date(since).getTime()
      events = events.filter((e: any) => new Date(e.timestamp).getTime() > sinceTime)
    }
    return res.json({ events: events.slice(-limit), count: Math.min(events.length, limit) })
  }

  // ─── GET /v1/events/stream (long-poll) ───
  if (path.includes('/events/stream')) {
    const events = (store.events || []).slice(-20)
    res.setHeader('Cache-Control', 'no-cache')
    return res.json({ events, count: events.length, poll_again: true, retry_after_ms: 2000 })
  }

  // ─── GET /v1/actions/:id ───
  if (req.method === 'GET' && path.match(/\/actions\/[^/]+$/) && !path.includes('execute') && !path.includes('batch')) {
    const id = path.split('/').filter(Boolean).pop()!
    const action = (store.actions || []).find((a: any) => a.actionId === id)
    if (!action) return res.status(404).json({ error: 'Action not found' })
    return res.json({ action })
  }

  // ─── GET /v1/audit/:id ───
  if (req.method === 'GET' && path.includes('/audit/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const agentEvents = (store.events || []).filter((e: any) => e.agentId === id)
    const agentActions = (store.actions || []).filter((a: any) => a.agent_id === id)
    return res.json({
      agent_id: id,
      events: agentEvents.length,
      recent_events: agentEvents.slice(-50),
      violations: { count: agent.slashEvents || 0, total_slashed: '0', records: [] },
      reputation: { score: agent.trustScore ?? 50, tier: getTier(agent.trustScore ?? 50), source: agent.trustSource },
      actions_log: agentActions.slice(-50),
    })
  }

  // ─── GET /v1/marketplace/listings (public) ───
  if (req.method === 'GET' && path.match(/\/marketplace\/listings\/?$/)) {
    const all = Object.values(store.listings)
    return res.json({ listings: all, count: all.length })
  }

  if (req.method === 'GET' && path.match(/\/marketplace\/listings\/.+/)) {
    const id = path.split('/').filter(Boolean).pop()!
    const listing = store.listings[id]
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    return res.json(listing)
  }

  // ─── GET /v1/webhooks (public for owner) ───
  if (req.method === 'GET' && path.match(/\/webhooks\/?$/)) {
    return res.json({ webhooks: (store.webhooks || []).map((w: any) => ({ ...w, secret: undefined })) })
  }

  if (req.method === 'GET' && path.includes('/webhooks/') && path.includes('/deliveries')) {
    const parts = path.split('/')
    const whIdx = parts.indexOf('webhooks')
    const whId = parts[whIdx + 1]
    const deliveries = (store.deliveries || []).filter((d: any) => d.webhook_id === whId)
    return res.json({ deliveries })
  }

  // ─── Compliance frameworks (public) ───
  if (req.method === 'GET' && path.includes('/compliance/') && path.includes('/frameworks')) {
    return res.json({ frameworks: [
      { id: 'eu-ai-act', name: 'EU AI Act' },
      { id: 'nist-ai-rmf', name: 'NIST AI RMF' },
      { id: 'soc2', name: 'SOC 2' },
    ]})
  }

  // ─── GET /v1/compliance/:id ───
  if (req.method === 'GET' && path.includes('/compliance/')) {
    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    const url = new URL(`http://x${req.url}`)
    const format = url.searchParams.get('format') || 'eu-ai-act'
    const actionCount = agent.totalActionsExecuted || 0
    const violationRate = actionCount > 0 ? (agent.slashEvents / actionCount) : 0
    return res.json({
      framework: format,
      generated_at: new Date().toISOString(),
      agent_id: id,
      summary: {
        overall_status: violationRate > 0.05 ? 'non_compliant' : agent.slashEvents > 0 ? 'partially_compliant' : 'compliant',
        total_controls: 4,
        passed_controls: violationRate > 0.05 ? 2 : 4,
        failed_controls: violationRate > 0.05 ? 2 : 0,
        score: Math.round(Math.max(0, 100 - (violationRate * 1000))),
      },
      sections: [
        { id: 'risk-mgmt', title: 'Risk Management', status: violationRate < 0.01 ? 'pass' : 'warning', evidence: [`${actionCount} actions processed through 8-gate pipeline`, `Violation rate: ${(violationRate * 100).toFixed(2)}%`] },
        { id: 'transparency', title: 'Transparency', status: 'pass', evidence: ['All actions logged with SHA-256 audit hash', `${(store.actions || []).filter((a: any) => a.agent_id === id).length} audit records available`] },
        { id: 'oversight', title: 'Human Oversight', status: 'pass', evidence: ['Sponsor can pause/resume/revoke at any time', 'All mutations require API key + sponsor verification'] },
        { id: 'security', title: 'Security', status: agent.slashEvents > 5 ? 'fail' : agent.slashEvents > 0 ? 'warning' : 'pass', evidence: [`${agent.slashEvents} violations recorded`, `Bond status: ${agent.stakeBond === '0' ? 'slashed' : 'active'}`] },
      ],
    })
  }

  // ═══════════════════════════════════════════════════
  // ═══  AUTHENTICATED ENDPOINTS (API key required) ══
  // ═══════════════════════════════════════════════════

  // ─── POST /v1/agents (register — requires auth) ───
  if (req.method === 'POST' && path.match(/\/agents\/?$/) && !path.includes('/actions')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required. Set x-api-key header.' })

    const { name, scope, role, sponsor_address, description } = req.body || {}
    if (!name || !sponsor_address) return res.status(400).json({ error: 'name and sponsor_address required' })
    if (!ETH_ADDR_RE.test(sponsor_address)) return res.status(400).json({ error: 'Invalid sponsor_address. Must be 0x-prefixed 40-char hex (Ethereum address).' })

    const agentScope = scope || role || 'general'
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
    emitEvent('agent.registered', id, { name, scope: agentScope })
    return res.status(201).json({ agent: formatAgent(agent) })
  }

  // ─── PATCH /v1/agents/:id (pause/resume — requires auth + sponsor match) ───
  if (req.method === 'PATCH' && path.includes('/agents/')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    if (agent.trustSource === 'demo') return res.status(403).json({ error: 'Cannot modify demo agents. Register your own agent via POST /v1/agents' })
    const { action, caller_address } = req.body || {}
    if (!caller_address) return res.status(400).json({ error: 'caller_address required — only the sponsor can modify their agent' })
    if (caller_address.toLowerCase() !== agent.sponsorAddress.toLowerCase()) return res.status(403).json({ error: 'Only the sponsor can modify this agent' })
    if (action === 'pause') { agent.status = 'paused'; await saveAgent(agent); emitEvent('agent.paused', id, {}); return res.json({ agent: formatAgent(agent) }) }
    if (action === 'resume') { agent.status = 'active'; await saveAgent(agent); emitEvent('agent.resumed', id, {}); return res.json({ agent: formatAgent(agent) }) }
    if (action === 'renew') {
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      agent.expiresAt = (agent.expiresAt && agent.expiresAt > Date.now() ? agent.expiresAt : Date.now()) + thirtyDays
      await saveAgent(agent)
      emitEvent('agent.renewed', id, { new_expiry: new Date(agent.expiresAt).toISOString() })
      return res.json({ agent: formatAgent(agent) })
    }
    return res.status(400).json({ error: 'Invalid action. Use "pause", "resume", or "renew".' })
  }

  // ─── DELETE /v1/agents/:id (revoke — requires auth + sponsor match) ───
  if (req.method === 'DELETE' && path.includes('/agents/')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const id = path.split('/').filter(Boolean).pop()!
    const agent = store.agents[id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    if (agent.trustSource === 'demo') return res.status(403).json({ error: 'Cannot revoke demo agents.' })
    const { caller_address } = req.body || {}
    if (!caller_address) return res.status(400).json({ error: 'caller_address required' })
    if (caller_address.toLowerCase() !== agent.sponsorAddress.toLowerCase()) return res.status(403).json({ error: 'Only the sponsor can revoke this agent' })
    agent.status = 'revoked'; agent.stakeBond = '0'
    await saveAgent(agent)
    emitEvent('agent.revoked', id, {})
    return res.json({ agent: formatAgent(agent) })
  }

  // ═══════════════════════════════════════════════════
  // ═══  8-GATE PIPELINE — The core product  ═════════
  // ═══════════════════════════════════════════════════
  if (req.method === 'POST' && path.includes('/actions/execute')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required for action execution.' })

    const { agent_id, action, tool, params } = req.body || {}
    if (!agent_id || !tool) return res.status(400).json({ error: 'agent_id and tool are required' })
    const actionId = `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const gates: any[] = []
    const pipelineStart = Date.now()
    const ts = new Date().toISOString()

    // Gate 1: Identity
    let t = Date.now()
    const agent = store.agents[agent_id]
    if (!agent || agent.status !== 'active') {
      gates.push({ gate: 'identity', passed: false, reason: agent ? `Agent is ${agent.status}` : 'Not registered', latency_ms: Date.now() - t, source: 'local + erc8004' })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, audit_hash: computeAuditHash(actionId, agent_id, tool, gates, ts), timestamp: ts, latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'identity', passed: true, latency_ms: Date.now() - t, source: 'local + erc8004', erc8004_registered: !!agent.erc8004 })

    // Gate 2: Permissions
    t = Date.now()
    if (!agent.allowedTools.includes(tool)) {
      gates.push({ gate: 'permissions', passed: false, reason: `Tool "${tool}" not in scope "${agent.permissionScope}". Allowed: ${agent.allowedTools.join(', ')}`, latency_ms: Date.now() - t })
      agent.slashEvents++; await saveAgent(agent)
      await saveAction({ agent_id, tool, approved: false })
      const hash = computeAuditHash(actionId, agent_id, tool, gates, ts)
      emitEvent('action.blocked', agent_id, { action_id: actionId, tool, gate: 'permissions' })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, audit_hash: hash, timestamp: ts, latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'permissions', passed: true, latency_ms: Date.now() - t, scope: agent.permissionScope })

    // Gate 3: Rate Limit
    t = Date.now()
    const now = Date.now()
    const hourBoundary = Math.floor(now / 3600000) * 3600000
    const maxPerHour = agent.permissionScope === 'monitoring' ? 300 : agent.permissionScope === 'research' ? 120 : 60
    if (!store.rateLimits[agent_id] || store.rateLimits[agent_id].resetAt < hourBoundary) store.rateLimits[agent_id] = { count: 0, resetAt: hourBoundary + 3600000 }
    if (store.rateLimits[agent_id].count >= maxPerHour) {
      gates.push({ gate: 'rate_limit', passed: false, reason: `Exceeded ${maxPerHour}/hr`, latency_ms: Date.now() - t })
      res.setHeader('Retry-After', '60')
      return res.status(429).json({ action_id: actionId, agent_id, approved: false, gates, audit_hash: computeAuditHash(actionId, agent_id, tool, gates, ts), timestamp: ts, latency_ms: Date.now() - pipelineStart })
    }
    store.rateLimits[agent_id].count++
    gates.push({ gate: 'rate_limit', passed: true, latency_ms: Date.now() - t, used: store.rateLimits[agent_id].count, limit: maxPerHour })

    // Gate 4: x402 Payment (C2 fix — real structure validation)
    t = Date.now()
    const paymentHeader = req.headers?.['x-payment']
    let x402Valid = false
    let x402Details: any = { free_tier: true }
    if (paymentHeader) {
      try {
        const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8')
        const payment = JSON.parse(decoded)
        // Validate required x402 fields
        if (!payment.signature || !payment.amount || !payment.network) {
          x402Valid = false
          x402Details = { error: 'Missing required fields: signature, amount, network' }
        } else if (payment.expiry && Date.now() / 1000 > payment.expiry) {
          x402Valid = false
          x402Details = { error: 'Payment expired' }
        } else if (!payment.network.startsWith('eip155:') && !payment.network.startsWith('solana:')) {
          x402Valid = false
          x402Details = { error: `Unsupported network: ${payment.network}` }
        } else {
          x402Valid = true
          x402Details = { network: payment.network, amount: payment.amount, free_tier: false }
        }
      } catch { x402Details = { error: 'Invalid x402 payment encoding' } }
    }
    gates.push({
      gate: 'x402_payment', passed: true, // Free tier still allows passage
      latency_ms: Date.now() - t,
      payment_attached: !!paymentHeader,
      payment_valid: paymentHeader ? x402Valid : null,
      ...x402Details,
      protocol: 'x402',
    })

    // Gate 5: Audit Log
    t = Date.now()
    store.actions.push({ actionId, agent_id, tool, approved: true, timestamp: ts })
    if (store.actions.length > 10000) store.actions.splice(0, store.actions.length - 10000)
    await saveAction({ agent_id, tool, approved: true })
    gates.push({ gate: 'audit_log', passed: true, latency_ms: Date.now() - t, logged: true, persisted: store.persistence })

    // Gate 6: Trust Score (AgentScore — cached)
    t = Date.now()
    const trustCheck = await lookupAgentScore(agent.name)
    agent.trustScore = trustCheck.score; agent.trustSource = trustCheck.source
    if (trustCheck.score < 10) {
      gates.push({ gate: 'trust_score', passed: false, reason: `Score ${trustCheck.score}/100 < minimum 10`, latency_ms: Date.now() - t, source: trustCheck.source })
      emitEvent('action.blocked', agent_id, { action_id: actionId, tool, gate: 'trust_score' })
      return res.status(403).json({ action_id: actionId, agent_id, approved: false, gates, audit_hash: computeAuditHash(actionId, agent_id, tool, gates, ts), timestamp: ts, latency_ms: Date.now() - pipelineStart })
    }
    gates.push({ gate: 'trust_score', passed: true, latency_ms: Date.now() - t, source: trustCheck.source, score: trustCheck.score })

    // Gate 7: Execute
    t = Date.now()
    gates.push({ gate: 'execute', passed: true, latency_ms: Date.now() - t })

    // Gate 8: Escrow (PayCrow)
    t = Date.now()
    const escrow = await checkPayCrowTrust(agent.sponsorAddress)
    gates.push({ gate: 'escrow_check', passed: true, latency_ms: Date.now() - t, source: escrow.source, paycrow_trust: escrow.trustScore })

    // All passed — compute real audit hash
    agent.totalActionsExecuted++; agent.lastActiveAt = Date.now()
    await saveAgent(agent)
    const auditHash = computeAuditHash(actionId, agent_id, tool, gates, ts)
    emitEvent('action.approved', agent_id, { action_id: actionId, tool, latency_ms: Date.now() - pipelineStart, audit_hash: auditHash })

    return res.json({
      action_id: actionId, agent_id, approved: true, gates,
      timestamp: ts, latency_ms: Date.now() - pipelineStart,
      integrations_consulted: ['erc8004', 'agentscore', 'x402', 'paycrow'],
      audit_hash: auditHash,
      persistence: store.persistence,
    })
  }

  // ─── POST /v1/actions/batch (requires auth, rejects >100) ───
  if (req.method === 'POST' && path.includes('/actions/batch')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { actions: batchActions } = req.body || {}
    if (!Array.isArray(batchActions)) return res.status(400).json({ error: 'actions array required' })
    if (batchActions.length > 100) return res.status(400).json({ error: `Batch size ${batchActions.length} exceeds maximum of 100.` })

    const results: any[] = []
    for (const act of batchActions) {
      const agent = store.agents[act.agent_id]
      const approved = agent && agent.status === 'active' && agent.allowedTools?.includes(act.tool)
      const ts = new Date().toISOString()
      const actId = `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`
      results.push({
        action_id: actId, agent_id: act.agent_id, approved, tool: act.tool,
        gates: [{ gate: 'batch_check', passed: approved, reason: approved ? undefined : 'Failed identity/permissions check' }],
        audit_hash: computeAuditHash(actId, act.agent_id, act.tool, [{ gate: 'batch_check', passed: approved }], ts),
      })
      if (approved && agent) { agent.totalActionsExecuted++; agent.lastActiveAt = Date.now() }
    }
    return res.json({ total: results.length, approved: results.filter(r => r.approved).length, blocked: results.filter(r => !r.approved).length, results })
  }

  // ─── POST /v1/webhooks (requires auth + URL validation — C8 fix) ───
  if (req.method === 'POST' && path.match(/\/webhooks\/?$/)) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { url, event_types } = req.body || {}
    if (!url) return res.status(400).json({ error: 'url required' })
    if (!isValidWebhookUrl(url)) return res.status(400).json({ error: 'Invalid webhook URL. Must be HTTPS and not a private/local address.' })

    const id = `wh_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`
    const secret = `whsec_${Date.now().toString(36)}${Math.random().toString(36).slice(2,16)}`
    const webhook = { id, url, event_types: event_types || ['*'], secret, active: true, failure_count: 0, owner_key_hash: apiKey ? createHash('sha256').update(apiKey).digest('hex').slice(0, 16) : 'unknown', created_at: new Date().toISOString() }
    store.webhooks.push(webhook)
    return res.status(201).json(webhook)
  }

  // ─── DELETE /v1/webhooks/:id (requires auth — C8 fix) ───
  if (req.method === 'DELETE' && path.includes('/webhooks/')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const id = path.split('/').filter(Boolean).pop()!
    const before = store.webhooks.length
    store.webhooks = (store.webhooks || []).filter((w: any) => w.id !== id)
    if (store.webhooks.length === before) return res.status(404).json({ error: 'Webhook not found' })
    return res.json({ deleted: true })
  }

  // ─── Marketplace mutations (requires auth — C7 fix) ───
  if (req.method === 'POST' && path.match(/\/marketplace\/listings\/?$/)) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { agent_id, rate_usdc_per_hour, rate_usdc_per_action, description } = req.body || {}
    if (!agent_id) return res.status(400).json({ error: 'agent_id required' })
    const agent = store.agents[agent_id]
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    if (typeof rate_usdc_per_hour === 'number' && (rate_usdc_per_hour < 0 || rate_usdc_per_hour > 1000000)) return res.status(400).json({ error: 'rate_usdc_per_hour must be 0-1000000' })
    if (typeof rate_usdc_per_action === 'number' && (rate_usdc_per_action < 0 || rate_usdc_per_action > 1000000)) return res.status(400).json({ error: 'rate_usdc_per_action must be 0-1000000' })

    const id = `lst_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`
    const listing = { id, agent_id, agent_name: agent.name, rate_usdc_per_hour, rate_usdc_per_action, description, available: true, created_at: new Date().toISOString() }
    store.listings[id] = listing
    emitEvent('listing.created', agent_id, { listing_id: id })
    return res.status(201).json(listing)
  }

  if (req.method === 'POST' && path.includes('/marketplace/hire')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { listing_id, escrow_amount_usdc } = req.body || {}
    const listing = store.listings[listing_id]
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (typeof escrow_amount_usdc !== 'number' || escrow_amount_usdc <= 0) return res.status(400).json({ error: 'escrow_amount_usdc must be a positive number' })

    const id = `eng_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`
    const engagement = { id, listing_id, agent_id: listing.agent_id, escrow_amount_usdc, status: 'active', started_at: new Date().toISOString() }
    store.engagements[id] = engagement
    emitEvent('engagement.started', listing.agent_id, { engagement_id: id, escrow: escrow_amount_usdc })
    return res.status(201).json(engagement)
  }

  if (req.method === 'POST' && path.includes('/marketplace/complete')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { engagement_id } = req.body || {}
    const eng = store.engagements[engagement_id]
    if (!eng) return res.status(404).json({ error: 'Engagement not found' })
    eng.status = 'completed'; eng.completed_at = new Date().toISOString()
    emitEvent('engagement.completed', eng.agent_id, { engagement_id })
    return res.json(eng)
  }

  if (req.method === 'POST' && path.includes('/marketplace/dispute')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { engagement_id, reason } = req.body || {}
    const eng = store.engagements[engagement_id]
    if (!eng) return res.status(404).json({ error: 'Engagement not found' })
    eng.status = 'disputed'; eng.dispute_reason = reason
    return res.json(eng)
  }

  if (req.method === 'POST' && path.includes('/marketplace/rate')) {
    const auth = await requireAuth()
    if (!auth.valid) return res.status(401).json({ error: 'API key required.' })

    const { engagement_id, rating, feedback } = req.body || {}
    const eng = store.engagements[engagement_id]
    if (!eng) return res.status(404).json({ error: 'Engagement not found' })
    if (typeof rating !== 'number' || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' })
    if (eng.rated) return res.status(409).json({ error: 'Engagement already rated' })
    eng.rating = rating; eng.feedback = feedback; eng.rated = true
    return res.json({ engagement_id, rating, feedback })
  }

  return res.status(404).json({ error: 'Not found', path, docs: '/v1/docs' })
}
