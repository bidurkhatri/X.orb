import { Hono } from 'hono'
import type { Env } from '../app'
import { ok, err } from '../lib/response'
import { getRegistry } from '../services/registry'
import { getReputationEngine, getEventBus } from '../services/pipeline'
import { getPaymentService } from '../services/payments'
import { formatUsdc } from '@xorb/agent-core'

export const cronRouter = new Hono<Env>()

/**
 * POST /v1/cron/decay — Apply reputation decay for inactive agents.
 *
 * This endpoint is designed to be called by Vercel Cron Jobs (daily).
 * It requires a CRON_SECRET header to prevent unauthorized access.
 *
 * Vercel cron config in vercel.json:
 *   { "crons": [{ "path": "/v1/cron/decay", "schedule": "0 0 * * *" }] }
 */
cronRouter.post('/decay', async (c) => {
  // Verify cron secret (Vercel sets CRON_SECRET env var)
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')

  if (!cronSecret) {
    return err(c, 'cron_secret_missing', 'CRON_SECRET not configured. Cron endpoints are disabled.', 500)
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return err(c, 'unauthorized', 'Unauthorized — invalid CRON_SECRET', 401)
  }

  const registry = await getRegistry()
  const reputation = getReputationEngine()
  const events = getEventBus()

  const allAgents = registry.getAllAgents()
  const now = Date.now()
  let decayed = 0
  let skipped = 0

  for (const agent of allAgents) {
    if (agent.status !== 'active') {
      skipped++
      continue
    }

    const inactiveDays = Math.floor((now - agent.lastActiveAt) / (24 * 60 * 60 * 1000))
    const decayEvent = reputation.applyDecay(agent.agentId, inactiveDays)

    if (decayEvent) {
      registry.updateReputation(agent.agentId, decayEvent.pointsDelta)
      decayed++

      await events.emit({
        type: 'reputation.changed',
        agentId: agent.agentId,
        data: {
          reason: 'decay',
          inactive_days: inactiveDays,
          points_delta: decayEvent.pointsDelta,
          new_score: decayEvent.newScore,
          new_tier: decayEvent.newTier,
        },
      })
    } else {
      skipped++
    }
  }

  return ok(c, {
    status: 'ok',
    processed: allAgents.length,
    decayed,
    skipped,
    timestamp: new Date().toISOString(),
  })
})

/**
 * POST /v1/cron/cleanup — Clean up expired agents.
 *
 * Marks expired agents and emits events.
 */
cronRouter.post('/cleanup', async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')

  if (!cronSecret) {
    return err(c, 'cron_secret_missing', 'CRON_SECRET not configured. Cron endpoints are disabled.', 500)
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return err(c, 'unauthorized', 'Unauthorized — invalid CRON_SECRET', 401)
  }

  const registry = await getRegistry()
  const events = getEventBus()
  const now = Date.now()
  let expired = 0

  for (const agent of registry.getAllAgents()) {
    if (agent.status === 'active' && agent.expiresAt > 0 && now > agent.expiresAt) {
      // canExecute will set status to expired
      registry.canExecute(agent.agentId)
      expired++

      await events.emit({
        type: 'agent.revoked',
        agentId: agent.agentId,
        data: { reason: 'expired', expires_at: new Date(agent.expiresAt).toISOString() },
      })
    }
  }

  return ok(c, { status: 'ok', expired, timestamp: new Date().toISOString() })
})

/**
 * POST /v1/cron/settle-batch — Settle pending payments (every 5 minutes).
 */
cronRouter.post('/settle-batch', async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')
  if (!cronSecret) return err(c, 'cron_secret_missing', 'CRON_SECRET not configured', 500)
  if (authHeader !== `Bearer ${cronSecret}`) return err(c, 'unauthorized', 'Unauthorized', 401)

  const payments = getPaymentService()
  if (!payments.isConfigured()) {
    return ok(c, { status: 'skipped', reason: 'Payment infrastructure not configured' })
  }

  try {
    const result = await payments.settleBatch()
    return ok(c, {
      status: 'ok',
      settled: result.count,
      total_fees_usdc: formatUsdc(result.totalFees),
      total_net_usdc: formatUsdc(result.totalNet),
      tx_hash: result.tx,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[Cron] settle-batch failed:', e)
    return err(c, 'settle_failed', e instanceof Error ? e.message : 'Unknown', 500)
  }
})

/**
 * POST /v1/cron/treasury-mature — Move matured fees to available balance (hourly).
 * Fees are pending for 72 hours after completion. This cron marks them as available.
 */
cronRouter.post('/treasury-mature', async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')
  if (!cronSecret) return err(c, 'cron_secret_missing', 'CRON_SECRET not configured', 500)
  if (authHeader !== `Bearer ${cronSecret}`) return err(c, 'unauthorized', 'Unauthorized', 401)

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

  // Count matured vs pending fees
  const now = new Date().toISOString()
  const { count: matured } = await sb.from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .lt('fee_matures_at', now)

  const { count: pending } = await sb.from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('fee_matures_at', now)

  return ok(c, {
    status: 'ok',
    matured_fees: matured || 0,
    pending_fees: pending || 0,
    timestamp: now,
  })
})

/**
 * POST /v1/cron/retry-refunds — Retry failed refunds (every 15 minutes).
 */
cronRouter.post('/retry-refunds', async (c) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = c.req.header('authorization')
  if (!cronSecret) return err(c, 'cron_secret_missing', 'CRON_SECRET not configured', 500)
  if (authHeader !== `Bearer ${cronSecret}`) return err(c, 'unauthorized', 'Unauthorized', 401)

  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
  const payments = getPaymentService()

  const { data: failed } = await sb.from('payments')
    .select('*')
    .eq('status', 'failed')
    .is('refund_tx_hash', null)
    .limit(10)

  let retried = 0
  let succeeded = 0

  for (const p of (failed || [])) {
    retried++
    try {
      if (payments.isConfigured()) {
        const { txHash } = await payments.refund(p.payer_address, BigInt(p.gross_amount))
        await sb.from('payments').update({
          status: 'refunded',
          refund_tx_hash: txHash,
          refund_reason: 'auto_retry',
          refunded_at: new Date().toISOString(),
        }).eq('action_id', p.action_id)
        succeeded++
      }
    } catch (err) {
      console.error(`[Cron] retry-refund failed for ${p.action_id}:`, err)
    }
  }

  return ok(c, { status: 'ok', retried, succeeded, timestamp: new Date().toISOString() })
})
