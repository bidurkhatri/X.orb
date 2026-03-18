import { describe, it, expect } from 'vitest'
import { app } from '../app'

// Helper to make requests and unwrap the envelope
async function req(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  }
  const res = await app.request(path, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const raw = await res.json() as any
  // Unwrap envelope: if { success, data }, return data; otherwise return raw
  const data = raw.success !== undefined && raw.data !== undefined ? raw.data : raw
  return { status: res.status, data, raw }
}

function authHeaders(key = 'xorb_test_key_1234') {
  return { 'x-api-key': key }
}

describe('Health', () => {
  it('GET /v1/health returns 200 without auth', async () => {
    const { status, raw } = await req('GET', '/v1/health')
    expect(status).toBe(200)
    expect(raw.status).toBe('ok')
    expect(raw.version).toBeDefined()
  })

  it('GET /v1/health/deep returns basic health without auth', async () => {
    const { status, raw } = await req('GET', '/v1/health/deep')
    expect(status).toBe(200)
    expect(raw.status).toBe('ok')
  })

  it('GET /v1/health/deep returns checks with auth', async () => {
    const { status, raw } = await req('GET', '/v1/health/deep', { headers: authHeaders() })
    expect(status).toBe(200)
    expect(raw.checks).toBeDefined()
  })
})

describe('Auth Middleware', () => {
  it('returns 401 without API key', async () => {
    const { status, raw } = await req('GET', '/v1/agents')
    expect(status).toBe(401)
    expect(raw.success).toBe(false)
    expect(raw.error.code).toBe('missing_api_key')
  })

  it('returns 401 with invalid key format', async () => {
    const { status } = await req('GET', '/v1/agents', { headers: { 'x-api-key': 'bad_key' } })
    expect(status).toBe(401)
  })

  it('accepts xorb_ prefixed key in dev mode', async () => {
    const { status } = await req('GET', '/v1/agents', { headers: authHeaders() })
    expect(status).toBe(200)
  })
})

describe('Agents', () => {
  it('POST /v1/agents creates an agent', async () => {
    const { status, data } = await req('POST', '/v1/agents', {
      headers: authHeaders(),
      body: {
        name: 'TestBot',
        role: 'RESEARCHER',
        sponsor_address: '0x1234567890abcdef1234567890abcdef12345678',
        description: 'test agent',
      },
    })
    expect(status).toBe(201)
    expect(data.agent).toBeDefined()
    expect(data.agent.agentId).toMatch(/^agent_[0-9a-f]{32}$/)
    expect(data.agent.name).toBe('TestBot')
    expect(data.agent.sessionWalletAddress).toMatch(/^0x[0-9a-f]{40}$/)
  })

  it('POST /v1/agents rejects missing name', async () => {
    const { status } = await req('POST', '/v1/agents', {
      headers: authHeaders(),
      body: { role: 'RESEARCHER', sponsor_address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    expect(status).toBe(400)
  })
})

describe('Actions', () => {
  it('POST /v1/actions/execute runs pipeline', async () => {
    const key = 'xorb_action_test_key'
    const { createHash } = await import('node:crypto')
    const devHash = createHash('sha256').update(key).digest('hex')
    const sponsorAddress = `0x${devHash.slice(0, 40)}`

    const createRes = await req('POST', '/v1/agents', {
      headers: { 'x-api-key': key },
      body: { name: 'ActionBot', role: 'RESEARCHER', sponsor_address: sponsorAddress },
    })
    expect(createRes.status).toBe(201)
    const agentId = createRes.data.agent.agentId

    const { status, data } = await req('POST', '/v1/actions/execute', {
      headers: { 'x-api-key': key },
      body: { agent_id: agentId, action: 'query', tool: 'get_balance' },
    })
    expect(status).toBe(200)
    expect(data.approved).toBe(true)
    expect(data.audit_hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(data.gates.length).toBeGreaterThan(0)
  })

  it('rejects invalid pipeline context', async () => {
    const { status } = await req('POST', '/v1/actions/execute', {
      headers: authHeaders(),
      body: { agent_id: '', action: '', tool: '' },
    })
    expect(status).toBeGreaterThanOrEqual(400)
  })
})

describe('Ownership', () => {
  it('blocks cross-user agent access', async () => {
    const createRes = await req('POST', '/v1/agents', {
      headers: authHeaders('xorb_user_a_key'),
      body: { name: 'UserABot', role: 'MONITOR', sponsor_address: '0xaaaa567890abcdef1234567890abcdef12345678' },
    })
    const agentId = createRes.data.agent.agentId

    const { status } = await req('GET', `/v1/agents/${agentId}`, {
      headers: authHeaders('xorb_user_b_key'),
    })
    expect(status).toBe(403)
  })
})

describe('Cron', () => {
  it('rejects cron without CRON_SECRET', async () => {
    const { status } = await req('POST', '/v1/cron/decay', { headers: authHeaders() })
    expect(status).toBe(500)
  })
})

describe('Pricing', () => {
  it('GET /v1/pricing returns endpoint pricing', async () => {
    const { status, raw } = await req('GET', '/v1/pricing')
    expect(status).toBe(200)
    expect(raw.endpoints).toBeDefined()
    expect(raw.free_tier).toBeDefined()
    expect(raw.free_tier.limit).toBe(500)
  })
})

describe('Response Envelope', () => {
  it('success responses have { success: true, data }', async () => {
    const { raw } = await req('GET', '/v1/agents', { headers: authHeaders() })
    expect(raw.success).toBe(true)
    expect(raw.data).toBeDefined()
  })

  it('error responses have { success: false, error: { code, message } }', async () => {
    const { raw } = await req('GET', '/v1/agents/nonexistent', { headers: authHeaders() })
    expect(raw.success).toBe(false)
    expect(raw.error).toBeDefined()
    expect(raw.error.code).toBeDefined()
    expect(raw.error.message).toBeDefined()
  })
})
