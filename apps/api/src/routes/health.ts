import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

export const healthRouter = new Hono()

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

// GET /v1/health — Public health check.
// CRITICAL: Do NOT expose auth status, contract config, env vars, or agent counts.
// This endpoint is public and will be scraped by competitors and auditors.
healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'xorb-api',
    version: '0.5.0',
    timestamp: new Date().toISOString(),
    pipeline: '8-gate sequential check',
    auth: 'required',
    documentation: 'https://docs.xorb.xyz',
  })
})

// GET /v1/health/deep — Authenticated deep health check.
// Requires a valid API key (verified against Supabase). Returns basic health if invalid.
healthRouter.get('/deep', async (c) => {
  const apiKey = c.req.header('x-api-key')
  const basicResponse = {
    status: 'ok',
    service: 'xorb-api',
    version: '0.5.0',
    timestamp: new Date().toISOString(),
  }

  // If no auth or invalid format, return basic health only
  if (!apiKey || !apiKey.startsWith('xorb_')) {
    return c.json(basicResponse)
  }

  // Validate the API key against Supabase before returning detailed info
  const sbConfig = getSupabaseConfig()
  if (sbConfig) {
    const sb = createClient(sbConfig.url, sbConfig.key)
    const keyHash = createHash('sha256').update(apiKey).digest('hex')
    const { data } = await sb.from('api_keys').select('is_active').eq('key_hash', keyHash).single()
    if (!data || !data.is_active) {
      return c.json(basicResponse)
    }
  }

  const checks: Record<string, { status: string; latency_ms?: number }> = {}

  // Check Supabase connectivity
  const sbStart = Date.now()
  if (sbConfig) {
    try {
      const sb = createClient(sbConfig.url, sbConfig.key)
      const { error } = await sb.from('agent_registry').select('agent_id', { count: 'exact', head: true })
      checks.persistence = {
        status: error ? 'degraded' : 'ok',
        latency_ms: Date.now() - sbStart,
      }
    } catch {
      checks.persistence = { status: 'down', latency_ms: Date.now() - sbStart }
    }
  } else {
    checks.persistence = { status: 'degraded' }
  }

  // Check payment infrastructure
  const paymentReady = !!(process.env.XORB_FACILITATOR_PRIVATE_KEY && process.env.XORB_TREASURY_ADDRESS)
  checks.payments = { status: paymentReady ? 'ok' : 'degraded' }

  // Check contracts
  const contractsReady = !!(process.env.AGENT_REGISTRY_ADDRESS || process.env.XORB_PAYMENT_SPLITTER_ADDRESS)
  checks.contracts = { status: contractsReady ? 'ok' : 'degraded' }

  const anyDown = Object.values(checks).some(c => c.status === 'down')
  const anyDegraded = Object.values(checks).some(c => c.status === 'degraded')
  const overallStatus = anyDown ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy'

  return c.json({
    status: overallStatus,
    service: 'xorb-api',
    version: '0.5.0',
    timestamp: new Date().toISOString(),
    checks,
  }, overallStatus === 'unhealthy' ? 503 : 200)
})
