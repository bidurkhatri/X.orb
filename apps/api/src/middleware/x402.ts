/**
 * x402 Payment Middleware — Xorb as USDC payment facilitator.
 *
 * Flow:
 * 1. If sandbox → skip payment
 * 2. If free endpoint → skip payment
 * 3. If x402 header present → validate sig, collect USDC, calculate fee, attach to context
 * 4. If no header + free tier remaining → allow (zero payment)
 * 5. If no header + free tier exhausted → 402 Payment Required
 *
 * Post-pipeline settlement (split or refund) is handled in pipeline.ts.
 */
import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { ethers } from 'ethers'
import type { Env } from '../app'
import { calculateFee, type FeeConfig } from '@xorb/agent-core'
import { getPaymentService } from '../services/payments'

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

const FREE_ENDPOINTS = [
  'GET /v1/health', 'GET /v1/pricing',
  'PATCH /v1/agents', 'DELETE /v1/agents', 'GET /v1/agents', 'GET /v1/events',
  'GET /v1/revenue', 'GET /v1/payments', 'GET /v1/billing', 'GET /v1/export',
  'PUT /v1/settings', 'GET /v1/settings',
]

// --- Supabase for usage tracking ---

let supabaseClient: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (url && key) supabaseClient = createClient(url, key)
  }
  return supabaseClient
}

async function getMonthlyUsage(sponsorAddress: string): Promise<number> {
  const sb = getSupabase()
  if (!sb) return 0
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count } = await sb.from('agent_actions')
    .select('*', { count: 'exact', head: true })
    .eq('sponsor_address', sponsorAddress)
    .gte('created_at', monthStart.toISOString())
  return count || 0
}

// --- Payment header validation ---

interface ParsedPayment {
  amount: string
  recipient: string
  nonce: string
  expiry: number
  signature: string
  payer: string
  network: string
}

function parsePaymentHeader(header: string): ParsedPayment | null {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8')
    const p = JSON.parse(decoded)
    if (!p.signature || !p.amount || !p.network) return null
    return {
      amount: p.amount,
      recipient: p.recipient || ethers.ZeroAddress,
      nonce: p.nonce || '',
      expiry: p.expiry || 0,
      signature: p.signature,
      payer: p.payer || '',
      network: p.network,
    }
  } catch {
    return null
  }
}

function verifySignature(payment: ParsedPayment): { valid: boolean; signer?: string; reason?: string } {
  try {
    const messageHash = ethers.solidityPackedKeccak256(
      ['uint256', 'address', 'string', 'uint256'],
      [payment.amount, payment.recipient, payment.nonce, payment.expiry]
    )
    const signer = ethers.verifyMessage(ethers.getBytes(messageHash), payment.signature)
    if (!signer) return { valid: false, reason: 'ECDSA recovery failed' }
    if (payment.payer && signer.toLowerCase() !== payment.payer.toLowerCase()) {
      return { valid: false, reason: `Signer ${signer} does not match payer ${payment.payer}` }
    }
    return { valid: true, signer }
  } catch {
    return { valid: false, reason: 'Invalid ECDSA signature' }
  }
}

async function checkNonce(nonce: string): Promise<{ valid: boolean; nonceHash: string }> {
  const nonceHash = createHash('sha256').update(nonce).digest('hex')
  const sb = getSupabase()
  if (!sb) return { valid: true, nonceHash }
  // @ts-expect-error — Supabase client not typed for payment_nonces schema
  const { error } = await sb.from('payment_nonces').insert({
    nonce_hash: nonceHash, payer_address: 'pending', amount: 0,
  })
  if (error?.code === '23505') return { valid: false, nonceHash }
  return { valid: true, nonceHash }
}

// Default fee config
const DEFAULT_FEE_CONFIG: FeeConfig = {
  basisPoints: 30, minimumUsdc: 1000n, maximumUsdc: 50_000_000n,
  highVolumeThreshold: 50_000, highVolumeBps: 15,
  exemptActions: ['health_check', 'agent_query', 'reputation_query'],
}

// --- Middleware ---

export function x402Middleware() {
  return createMiddleware<Env>(async (c, next) => {
    // Sandbox mode
    if (c.req.header('x-xorb-sandbox') === 'true') {
      c.header('x-xorb-mode', 'sandbox')
      return next()
    }

    const method = c.req.method
    const path = c.req.path
    const routeKey = `${method} ${path}`

    // Free endpoints skip payment entirely
    if (FREE_ENDPOINTS.some(ep => routeKey.startsWith(ep))) return next()

    // Find matching pricing rule
    const pricingKey = Object.keys(PRICING).find(key => {
      const [m, p] = key.split(' ')
      return method === m && path.startsWith(p)
    })
    if (!pricingKey) return next()

    const price = PRICING[pricingKey]
    const sponsorAddress = c.get('sponsorAddress') || ''
    // x402 v2: accept both 'payment-signature' (primary, EIP-3009) and 'x-payment' (legacy)
    const paymentHeader = c.req.header('payment-signature') || c.req.header('x-payment')
    const payments = getPaymentService()

    // --- Path A: x402 payment header present ---
    if (paymentHeader) {
      const payment = parsePaymentHeader(paymentHeader)
      if (!payment) {
        return c.json({ error: 'Invalid payment header format' }, 402 as Parameters<typeof c.json>[1])
      }

      // Verify signature
      const sigResult = verifySignature(payment)
      if (!sigResult.valid) {
        return c.json({ error: 'Payment Rejected', reason: sigResult.reason }, 402 as Parameters<typeof c.json>[1])
      }

      // Check expiry
      if (payment.expiry && Date.now() / 1000 > payment.expiry) {
        return c.json({ error: 'Payment expired' }, 402 as Parameters<typeof c.json>[1])
      }

      // Check nonce
      const nonceResult = await checkNonce(payment.nonce)
      if (!nonceResult.valid) {
        return c.json({ error: 'Payment nonce already used (replay detected)' }, 402 as Parameters<typeof c.json>[1])
      }

      // Enforce spending caps from sponsor_profiles
      const sbCap = getSupabase()
      if (sbCap && sponsorAddress) {
        const profileResult = await sbCap.from('sponsor_profiles')
          .select('daily_spend_cap_usdc, monthly_spend_cap_usdc')
          .eq('sponsor_address', sponsorAddress.toLowerCase())
          .maybeSingle()
        const profile = profileResult.data as { daily_spend_cap_usdc: number | null, monthly_spend_cap_usdc: number | null } | null

        if (profile) {
          const today = new Date().toISOString().slice(0, 10)
          const month = new Date().toISOString().slice(0, 7)
          const dailyResult = await sbCap.from('payments')
            .select('gross_amount')
            .eq('sponsor_address', sponsorAddress.toLowerCase())
            .gte('created_at', `${today}T00:00:00Z`)
          const dailySpend = dailyResult.data
          const monthlyResult = await sbCap.from('payments')
            .select('gross_amount')
            .eq('sponsor_address', sponsorAddress.toLowerCase())
            .gte('created_at', `${month}-01T00:00:00Z`)
          const monthlySpend = monthlyResult.data

          const dailyTotal = (dailySpend || []).reduce((sum: number, p: { gross_amount: string }) => sum + (parseFloat(p.gross_amount) || 0), 0)
          const monthlyTotal = (monthlySpend || []).reduce((sum: number, p: { gross_amount: string }) => sum + (parseFloat(p.gross_amount) || 0), 0)

          if (profile.daily_spend_cap_usdc && dailyTotal + parseFloat(payment.amount) > profile.daily_spend_cap_usdc * 1_000_000) {
            return c.json({ success: false, error: { code: 'daily_cap_exceeded', message: 'Daily spending cap exceeded' } }, 402 as Parameters<typeof c.json>[1])
          }
          if (profile.monthly_spend_cap_usdc && monthlyTotal + parseFloat(payment.amount) > profile.monthly_spend_cap_usdc * 1_000_000) {
            return c.json({ success: false, error: { code: 'monthly_cap_exceeded', message: 'Monthly spending cap exceeded' } }, 402 as Parameters<typeof c.json>[1])
          }
        }
      }

      // Calculate fee
      const grossAmount = BigInt(payment.amount)
      const monthlyUsage = await getMonthlyUsage(sponsorAddress)
      const fee = calculateFee(pricingKey, grossAmount, monthlyUsage, DEFAULT_FEE_CONFIG)

      // Attempt on-chain collection (if configured)
      let collectTxHash = ''
      if (payments.isConfigured()) {
        try {
          const result = await payments.collectPayment(sigResult.signer!, grossAmount)
          collectTxHash = result.txHash
        } catch (err) {
          return c.json({
            error: 'Payment collection failed',
            reason: err instanceof Error ? err.message : 'On-chain transfer failed',
          }, 402 as Parameters<typeof c.json>[1])
        }
      }

      // Record payment as held
      await payments.recordPayment({
        action_id: `pending_${nonceResult.nonceHash.slice(0, 16)}`, // updated after pipeline
        agent_id: 'pending',
        sponsor_address: sponsorAddress,
        payer_address: sigResult.signer!,
        recipient_address: payment.recipient,
        gross_amount: grossAmount.toString(),
        fee_amount: fee.feeAmount.toString(),
        net_amount: fee.netAmount.toString(),
        fee_basis_points: fee.feeBasisPoints,
        fee_exempt: fee.feeExempt,
        fee_exempt_reason: fee.reason,
        collect_tx_hash: collectTxHash,
        status: 'held',
        chain: payment.network,
        nonce_hash: nonceResult.nonceHash,
      })

      // Attach payment context for pipeline to use
      c.set('paymentContext', {
        paymentId: nonceResult.nonceHash,
        grossAmount,
        feeAmount: fee.feeAmount,
        netAmount: fee.netAmount,
        collectTxHash,
        payerAddress: sigResult.signer!,
        freeActionsRemaining: 0,
        feeExempt: fee.feeExempt,
      })

      // Set fee headers (M-7a)
      c.header('X-Xorb-Payment-Status', 'held')
      c.header('X-Xorb-Gross-Amount', grossAmount.toString())
      c.header('X-Xorb-Fee-Amount', fee.feeAmount.toString())
      c.header('X-Xorb-Fee-Basis-Points', fee.feeBasisPoints.toString())
      c.header('X-Xorb-Net-Amount', fee.netAmount.toString())
      c.header('X-Xorb-Chain', payment.network)

      return next()
    }

    // --- Path B: No payment header — payment required (no free tier) ---
    const expectedAmount = Math.round(price.usdc * 1_000_000)
    return c.json({
      error: 'Payment Required',
      message: 'x402 payment required. Include payment header with USDC.',
      status: 402,
      details: {
        endpoint: pricingKey,
        price_usdc: price.usdc,
        description: price.description,
        facilitator_address: payments.getFacilitatorAddress(),
        accepts: [
          { network: 'eip155:137', asset: 'USDC', amount: expectedAmount.toString() },
          { network: 'eip155:8453', asset: 'USDC', amount: expectedAmount.toString() },
        ],
        payment_header: 'payment-signature',
        payment_header_legacy: 'x-payment',
        payment_format: 'base64(JSON({ signature, amount, network, nonce, expiry, payer }))',
        protocol: 'x402 v2 (EIP-3009 TransferWithAuthorization — no USDC pre-approval needed)',
        docs: 'https://docs.xorb.xyz/payments',
        example: 'https://docs.xorb.xyz/example-integrated-journey',
      },
    }, 402 as Parameters<typeof c.json>[1])
  })
}

export function getPricing() {
  return Object.entries(PRICING).map(([key, value]) => ({
    endpoint: key,
    price_usdc: value.usdc,
    description: value.description,
  }))
}
