import { Hono } from 'hono'
import type { Env } from '../app'
import { ok, err } from '../lib/response'
import { getPaymentService } from '../services/payments'
import { formatUsdc } from '@xorb/agent-core'

export const revenueRouter = new Hono<Env>()

// GET /v1/revenue/summary — Revenue overview (all sponsors can see platform-level data)
revenueRouter.get('/summary', async (c) => {
  const payments = getPaymentService()

  const [today, month, allTime] = await Promise.all([
    payments.getRevenueSummary('today'),
    payments.getRevenueSummary('month'),
    payments.getRevenueSummary('all'),
  ])

  const treasuryBalance = await payments.getTreasuryBalance()

  return ok(c, {
    today: {
      actions: today.actions,
      gross_volume_usdc: formatUsdc(today.gross_volume),
      fees_collected_usdc: formatUsdc(today.fees_collected),
      refunds_usdc: formatUsdc(today.refunds),
      net_revenue_usdc: formatUsdc(today.net_revenue),
    },
    this_month: {
      actions: month.actions,
      gross_volume_usdc: formatUsdc(month.gross_volume),
      fees_collected_usdc: formatUsdc(month.fees_collected),
      refunds_usdc: formatUsdc(month.refunds),
      net_revenue_usdc: formatUsdc(month.net_revenue),
    },
    all_time: {
      actions: allTime.actions,
      gross_volume_usdc: formatUsdc(allTime.gross_volume),
      fees_collected_usdc: formatUsdc(allTime.fees_collected),
      refunds_usdc: formatUsdc(allTime.refunds),
      net_revenue_usdc: formatUsdc(allTime.net_revenue),
    },
    treasury: {
      address: payments.getTreasuryAddress(),
      balance_usdc: formatUsdc(treasuryBalance),
      chain: process.env.XORB_CHAIN || 'eip155:137',
    },
  })
})

// GET /v1/payments — User's payment history
revenueRouter.get('/payments', async (c) => {
  const payments = getPaymentService()
  const sponsorAddress = c.get('sponsorAddress')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
  const cursor = c.req.query('cursor') || undefined

  const result = await payments.getPaymentsBySponsor(sponsorAddress, { limit, cursor })

  return c.json({
    success: true,
    data: result.data.map(p => ({
      id: p.id,
      action_id: p.action_id,
      agent_id: p.agent_id,
      gross_usdc: formatUsdc(BigInt(p.gross_amount)),
      fee_usdc: formatUsdc(BigInt(p.fee_amount)),
      net_usdc: formatUsdc(BigInt(p.net_amount)),
      fee_bps: p.fee_basis_points,
      status: p.status,
      collect_tx: p.collect_tx_hash,
      fee_tx: p.fee_tx_hash,
      forward_tx: p.forward_tx_hash,
      refund_tx: p.refund_tx_hash,
      chain: p.chain,
      created_at: p.created_at,
    })),
    pagination: { next_cursor: result.next_cursor, has_more: result.has_more },
  })
})

// GET /v1/payments/:id — Single payment detail
revenueRouter.get('/payments/:id', async (c) => {
  const payments = getPaymentService()
  const payment = await payments.getPayment(c.req.param('id'))
  if (!payment) return err(c, 'not_found', 'Payment not found', 404)

  const sponsorAddress = c.get('sponsorAddress')
  if (payment.sponsor_address.toLowerCase() !== sponsorAddress.toLowerCase()) {
    return err(c, 'forbidden', 'Forbidden', 403)
  }

  return ok(c, { payment })
})

// GET /v1/payments/:actionId/receipt — On-chain verifiable receipt (M-7b)
revenueRouter.get('/payments/:actionId/receipt', async (c) => {
  const payments = getPaymentService()
  const payment = await payments.getPayment(c.req.param('actionId'))
  if (!payment) return err(c, 'not_found', 'Payment not found', 404)

  const sponsorAddress = c.get('sponsorAddress')
  if (payment.sponsor_address.toLowerCase() !== sponsorAddress.toLowerCase()) {
    return err(c, 'forbidden', 'Forbidden', 403)
  }

  const chain = payment.chain
  const explorerBase = chain === 'eip155:8453'
    ? 'https://basescan.org/tx/'
    : 'https://polygonscan.com/tx/'

  return ok(c, {
    receipt_id: `rcpt_${payment.action_id}`,
    date: payment.created_at,
    platform: 'X.orb — Agent Trust Infrastructure',
    entity: 'Fintex Australia Pty Ltd (ACN 688 406 108)',
    chain,
    payer: payment.payer_address,
    recipient: payment.recipient_address,
    action_id: payment.action_id,
    agent_id: payment.agent_id,
    gross_amount: `${formatUsdc(BigInt(payment.gross_amount))} USDC`,
    platform_fee: `${formatUsdc(BigInt(payment.fee_amount))} USDC (${payment.fee_basis_points} bps)`,
    net_to_recipient: `${formatUsdc(BigInt(payment.net_amount))} USDC`,
    transactions: {
      collect: payment.collect_tx_hash ? {
        hash: payment.collect_tx_hash,
        explorer: `${explorerBase}${payment.collect_tx_hash}`,
      } : null,
      fee_split: payment.fee_tx_hash ? {
        hash: payment.fee_tx_hash,
        explorer: `${explorerBase}${payment.fee_tx_hash}`,
      } : null,
      forward: payment.forward_tx_hash ? {
        hash: payment.forward_tx_hash,
        explorer: `${explorerBase}${payment.forward_tx_hash}`,
      } : null,
      refund: payment.refund_tx_hash ? {
        hash: payment.refund_tx_hash,
        explorer: `${explorerBase}${payment.refund_tx_hash}`,
      } : null,
    },
    status: payment.status,
  })
})

// POST /v1/payments/:actionId/refund — Manual refund (M-8b)
revenueRouter.post('/payments/:actionId/refund', async (c) => {
  const body = await c.req.json<{ reason: string }>()
  const payments = getPaymentService()
  const payment = await payments.getPayment(c.req.param('actionId'))
  if (!payment) return err(c, 'not_found', 'Payment not found', 404)

  if (payment.status !== 'completed') {
    return err(c, 'invalid_status', `Cannot refund payment with status: ${payment.status}`, 400)
  }

  // Check refund window (72 hours)
  if (payment.completed_at) {
    const completedAt = new Date(payment.completed_at).getTime()
    const refundWindowMs = 72 * 60 * 60 * 1000
    if (Date.now() - completedAt > refundWindowMs) {
      return err(c, 'refund_window_expired', 'Refund window expired (72 hours)', 400)
    }
  }

  // Execute on-chain refund
  if (payments.isConfigured()) {
    try {
      const grossAmount = BigInt(payment.gross_amount)
      const { txHash } = await payments.refund(payment.payer_address, grossAmount)
      await payments.updatePayment(payment.action_id, {
        status: 'refunded',
        refund_tx_hash: txHash,
        refund_reason: body.reason,
        refunded_at: new Date().toISOString(),
      })
      return ok(c, { status: 'refunded', refund_tx_hash: txHash })
    } catch (e) {
      return err(c, 'refund_failed', `Refund failed: ${e instanceof Error ? e.message : 'unknown'}`, 500)
    }
  }

  // Dev mode: mark as refunded without on-chain tx
  await payments.updatePayment(payment.action_id, {
    status: 'refunded',
    refund_reason: body.reason,
    refunded_at: new Date().toISOString(),
  })
  return ok(c, { status: 'refunded', refund_tx_hash: null })
})

// GET /v1/billing/usage — User's billing/usage info
revenueRouter.get('/billing/usage', async (c) => {
  const payments = getPaymentService()
  const sponsorAddress = c.get('sponsorAddress')
  const monthlyUsage = await payments.getMonthlyUsage(sponsorAddress)
  const freeTierLimit = 500

  let walletApproved = false
  let allowance = '0'
  if (payments.isConfigured()) {
    const allowanceBigInt = await payments.checkAllowance(sponsorAddress)
    walletApproved = allowanceBigInt > 0n
    allowance = formatUsdc(allowanceBigInt)
  }

  const tier = monthlyUsage < freeTierLimit ? 'free'
    : monthlyUsage >= 50_000 ? 'high_volume'
    : 'standard'

  const feeBps = tier === 'free' ? 0 : tier === 'high_volume' ? 15 : 30

  return ok(c, {
    sponsor_address: sponsorAddress,
    month: new Date().toISOString().slice(0, 7),
    actions_used: monthlyUsage,
    free_tier_limit: freeTierLimit,
    free_remaining: Math.max(0, freeTierLimit - monthlyUsage),
    current_fee_rate_bps: feeBps,
    tier,
    wallet_approved: walletApproved,
    wallet_allowance_usdc: allowance,
    facilitator_address: payments.getFacilitatorAddress(),
    chain: process.env.XORB_CHAIN || 'eip155:137',
  })
})

// GET /v1/billing/wallet-status — Wallet readiness check (M-9b)
revenueRouter.get('/billing/wallet-status', async (c) => {
  const payments = getPaymentService()
  const sponsorAddress = c.get('sponsorAddress')

  const setupRequired: string[] = []

  if (!payments.isConfigured()) {
    return ok(c, {
      sponsor_address: sponsorAddress,
      chain: process.env.XORB_CHAIN || 'eip155:137',
      payment_ready: false,
      setup_required: ['payment_infra_not_configured'],
    })
  }

  const balance = await payments.getBalance(sponsorAddress)
  const allowance = await payments.checkAllowance(sponsorAddress)

  if (balance === 0n) setupRequired.push('fund_wallet')
  if (allowance === 0n) setupRequired.push('approve_usdc')

  return ok(c, {
    sponsor_address: sponsorAddress,
    chain: process.env.XORB_CHAIN || 'eip155:137',
    usdc_balance: formatUsdc(balance),
    facilitator_allowance: allowance >= BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      ? 'unlimited'
      : formatUsdc(allowance),
    payment_ready: setupRequired.length === 0,
    setup_required: setupRequired,
    facilitator_address: payments.getFacilitatorAddress(),
  })
})

// PUT /v1/billing/spending-caps — Set daily/monthly spending caps (D-6)
revenueRouter.put('/billing/spending-caps', async (c) => {
  const body = await c.req.json<{ daily_spend_cap_usdc?: string; monthly_spend_cap_usdc?: string }>()
  const sponsorAddress = c.get('sponsorAddress')

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.daily_spend_cap_usdc !== undefined) {
    updates.daily_spend_cap_usdc = body.daily_spend_cap_usdc ? parseInt(body.daily_spend_cap_usdc) : null
  }
  if (body.monthly_spend_cap_usdc !== undefined) {
    updates.monthly_spend_cap_usdc = body.monthly_spend_cap_usdc ? parseInt(body.monthly_spend_cap_usdc) : null
  }

  await sb.from('sponsor_profiles')
    .upsert({ sponsor_address: sponsorAddress, ...updates }, { onConflict: 'sponsor_address' })

  return ok(c, { status: 'updated', ...updates })
})
