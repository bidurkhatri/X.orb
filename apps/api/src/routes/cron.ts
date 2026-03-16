import { Hono } from 'hono'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'
import { getReputationEngine, getEventBus } from '../services/pipeline'

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

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized — invalid CRON_SECRET' }, 401)
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

  return c.json({
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

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
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

  return c.json({ status: 'ok', expired, timestamp: new Date().toISOString() })
})
