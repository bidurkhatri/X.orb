import { createMiddleware } from 'hono/factory'
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
}

// Free endpoints — never charge
const FREE_ENDPOINTS = [
  'GET /v1/health',
  'POST /v1/agents/pause',
  'POST /v1/agents/revoke',
  'GET /v1/agents',
  'GET /v1/events',
]

// Free tier tracking (in-memory for MVP, Supabase in production)
const freeUsage = new Map<string, { count: number; resetAt: number }>()
const FREE_TIER_LIMIT = 1000 // gate checks per month

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
      // No pricing rule = free
      return next()
    }

    const price = PRICING[pricingKey]

    // Check for x402 payment header
    const paymentHeader = c.req.header('x-payment')
    const paymentReceipt = c.req.header('x-payment-receipt')

    if (paymentHeader || paymentReceipt) {
      // Payment provided — validate it
      // TODO: Integrate with @x402/server for real validation
      // For now, accept any payment header as valid
      c.header('x-payment-status', 'accepted')
      c.header('x-payment-amount', price.usdc.toString())
      return next()
    }

    // No payment — check free tier
    const apiKey = c.req.header('x-api-key') || 'anonymous'
    const now = Date.now()
    let usage = freeUsage.get(apiKey)

    if (!usage || now > usage.resetAt) {
      // Reset monthly
      usage = { count: 0, resetAt: now + 30 * 24 * 60 * 60 * 1000 }
      freeUsage.set(apiKey, usage)
    }

    if (usage.count < FREE_TIER_LIMIT) {
      // Free tier — allow
      usage.count++
      c.header('x-free-tier-remaining', (FREE_TIER_LIMIT - usage.count).toString())
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
        accepts: [
          {
            network: 'eip155:8453',
            asset: 'USDC',
            amount: Math.round(price.usdc * 1_000_000).toString(),
          }
        ],
        payment_header: 'x-payment',
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
