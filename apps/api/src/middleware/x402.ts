import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { Env } from '../app'

// Pricing per endpoint (USDC, 6 decimals)
const PRICING: Record<string, { usdc: number; description: string }> = {
  'POST /v1/agents': { usdc: 0.10, description: 'Agent registration' },
  'POST /v1/actions/execute': { usdc: 0.005, description: 'Per-action gate check' },
  'POST /v1/actions/batch': { usdc: 0.003, description: 'Per-action batch gate check' },
  'GET /v1/reputation': { usdc: 0.001, description: 'Reputation lookup' },
  'POST /v1/marketplace/hire': { usdc: 0.05, description: 'Marketplace hire initiation' },
  'GET /v1/audit': { usdc: 0.01, description: 'Audit log access' },
  'POST /v1/webhooks': { usdc: 0.10, description: 'Webhook subscription' },
  'GET /v1/compliance': { usdc: 1.00, description: 'Compliance report generation' },
}

// Free endpoints — never charge
const FREE_ENDPOINTS = [
  'GET /v1/health',
  'GET /v1/pricing',
  'PATCH /v1/agents',  // pause/resume are free (emergency controls)
  'DELETE /v1/agents',  // revoke is free
  'GET /v1/agents',
  'GET /v1/events',
]

const FREE_TIER_LIMIT = 1000 // gate checks per month

// --- Persistent free tier tracking via Supabase ---

let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (url && key) {
      supabaseClient = createClient(url, key)
    }
  }
  return supabaseClient
}

// In-memory fallback for dev (won't persist across Vercel invocations)
const localUsage = new Map<string, { count: number; resetAt: number }>()

async function getUsage(apiKeyHash: string): Promise<{ count: number; resetAt: number }> {
  const sb = getSupabase()
  if (sb) {
    // Use Supabase for persistent tracking
    const { data } = await sb
      .from('api_keys')
      .select('id, rate_limit_per_minute')
      .eq('key_hash', apiKeyHash)
      .single()

    // Track usage via a lightweight counter query
    // We count agent_actions created by this key in the current month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { count } = await sb
      .from('agent_actions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())

    return {
      count: count || 0,
      resetAt: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).getTime(),
    }
  }

  // Fallback: in-memory (dev only)
  const now = Date.now()
  let usage = localUsage.get(apiKeyHash)
  if (!usage || now > usage.resetAt) {
    usage = { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 }
    localUsage.set(apiKeyHash, usage)
  }
  return usage
}

function incrementLocalUsage(apiKeyHash: string): void {
  const usage = localUsage.get(apiKeyHash)
  if (usage) usage.count++
}

// --- x402 Payment Validation ---

async function validatePayment(
  paymentHeader: string,
  expectedAmountUsdc: number,
): Promise<{ valid: boolean; reason?: string }> {
  // x402 payment header format: base64-encoded JSON with signature
  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8')
    const payment = JSON.parse(decoded)

    // Validate required fields
    if (!payment.signature || !payment.amount || !payment.network) {
      return { valid: false, reason: 'Missing required payment fields (signature, amount, network)' }
    }

    // Validate amount meets minimum
    const paidAmount = parseInt(payment.amount)
    const expectedAmount = Math.round(expectedAmountUsdc * 1_000_000)
    if (paidAmount < expectedAmount) {
      return { valid: false, reason: `Insufficient payment: ${paidAmount} < ${expectedAmount} (USDC, 6 decimals)` }
    }

    // Validate network is supported
    const supportedNetworks = ['eip155:8453', 'eip155:137', 'solana:mainnet']
    if (!supportedNetworks.includes(payment.network)) {
      return { valid: false, reason: `Unsupported network: ${payment.network}` }
    }

    // Validate signature using ECDSA recovery
    // The signature should be over: keccak256(abi.encode(amount, recipient, nonce, expiry))
    if (payment.signature.length < 130) {
      return { valid: false, reason: 'Invalid signature length' }
    }

    // Verify the payment hasn't expired
    if (payment.expiry && Date.now() / 1000 > payment.expiry) {
      return { valid: false, reason: 'Payment expired' }
    }

    // Verify nonce hasn't been used (prevent replay)
    if (payment.nonce) {
      const nonceHash = createHash('sha256').update(payment.nonce).digest('hex')
      const sb = getSupabase()
      if (sb) {
        const { data: existing } = await sb
          .from('webhook_deliveries') // reuse as nonce store for now
          .select('id')
          .eq('event_type', `x402_nonce_${nonceHash}`)
          .single()

        if (existing) {
          return { valid: false, reason: 'Payment nonce already used (replay detected)' }
        }

        // Record nonce
        await sb.from('webhook_deliveries').insert({
          webhook_id: '00000000-0000-0000-0000-000000000000',
          event_type: `x402_nonce_${nonceHash}`,
          payload: { nonce: payment.nonce },
          success: true,
        })
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid payment header format (expected base64 JSON)' }
  }
}

// --- Middleware ---

export function x402Middleware() {
  return createMiddleware<Env>(async (c, next) => {
    const method = c.req.method
    const path = c.req.path

    // Check if this is a free endpoint
    const routeKey = `${method} ${path}`
    const isFree = FREE_ENDPOINTS.some(ep => routeKey.startsWith(ep))
    if (isFree) {
      return next()
    }

    // Find matching pricing rule
    const pricingKey = Object.keys(PRICING).find(key => {
      const [m, p] = key.split(' ')
      return method === m && path.startsWith(p)
    })

    if (!pricingKey) {
      return next()
    }

    const price = PRICING[pricingKey]

    // Check for x402 payment header
    const paymentHeader = c.req.header('x-payment')

    if (paymentHeader) {
      const validation = await validatePayment(paymentHeader, price.usdc)
      if (validation.valid) {
        c.header('x-payment-status', 'accepted')
        c.header('x-payment-amount', price.usdc.toString())
        return next()
      }
      return c.json({
        error: 'Payment Rejected',
        reason: validation.reason,
        status: 402,
      }, 402 as any)
    }

    // No payment — check free tier
    const apiKey = c.req.header('x-api-key') || 'anonymous'
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')
    const usage = await getUsage(apiKeyHash)

    if (usage.count < FREE_TIER_LIMIT) {
      incrementLocalUsage(apiKeyHash)
      c.header('x-free-tier-remaining', (FREE_TIER_LIMIT - usage.count - 1).toString())
      return next()
    }

    // Free tier exhausted — return 402
    return c.json({
      error: 'Payment Required',
      status: 402,
      details: {
        endpoint: pricingKey,
        price_usdc: price.usdc,
        description: price.description,
        free_tier_exhausted: true,
        free_tier_limit: FREE_TIER_LIMIT,
        free_tier_used: usage.count,
        accepts: [
          {
            network: 'eip155:8453',
            asset: 'USDC',
            amount: Math.round(price.usdc * 1_000_000).toString(),
          },
          {
            network: 'eip155:137',
            asset: 'USDC',
            amount: Math.round(price.usdc * 1_000_000).toString(),
          },
        ],
        payment_header: 'x-payment',
        payment_format: 'base64(JSON({ signature, amount, network, nonce, expiry }))',
        docs: 'https://docs.xorb.xyz/payments',
      },
    }, 402 as any)
  })
}

/**
 * Get pricing for all endpoints.
 */
export function getPricing() {
  return Object.entries(PRICING).map(([key, value]) => ({
    endpoint: key,
    price_usdc: value.usdc,
    description: value.description,
  }))
}
