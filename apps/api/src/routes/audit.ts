import { Hono } from 'hono'
import type { Env } from '../app'
import { getEventBus, getSlashingService, getReputationEngine } from '../services/pipeline'

export const auditRouter = new Hono<Env>()

// GET /v1/audit/:agentId — Get audit log for an agent
auditRouter.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const bus = getEventBus()
  const slashing = getSlashingService()
  const reputation = getReputationEngine()

  const events = bus.getEvents({ agentId, limit: 200 })
  const violations = slashing.getViolations(agentId)
  const repSnapshot = reputation.getSnapshot(agentId)

  return c.json({
    agent_id: agentId,
    events: events.length,
    recent_events: events.slice(-50),
    violations: {
      count: violations.length,
      total_slashed: slashing.getTotalSlashed(agentId),
      records: violations.slice(-20),
    },
    reputation: repSnapshot || null,
  })
})
