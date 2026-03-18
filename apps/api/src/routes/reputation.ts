import { Hono } from 'hono'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'
import { ok, err } from '../lib/response'

export const reputationRouter = new Hono<Env>()

reputationRouter.get('/leaderboard', async (c) => {
  const registry = await getRegistry()
  const agents = registry.getAllAgents()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 100)
    .map(a => ({ agent_id: a.agentId, name: a.name, role: a.role, score: a.reputation, tier: a.reputationTier }))
  return ok(c, { agents })
})

reputationRouter.get('/:agentId', async (c) => {
  const registry = await getRegistry()
  const agent = registry.getAgent(c.req.param('agentId'))
  if (!agent) return err(c, 'not_found', 'Agent not found', 404)
  return ok(c, {
    agent_id: agent.agentId, score: agent.reputation, tier: agent.reputationTier,
    total_actions: agent.totalActionsExecuted, slash_events: agent.slashEvents,
  })
})
