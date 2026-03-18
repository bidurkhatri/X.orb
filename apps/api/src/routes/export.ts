import { Hono } from 'hono'
import type { Env } from '../app'
import { ok, err } from '../lib/response'
import { getRegistry } from '../services/registry'
import { getEventBus, getSlashingService, getReputationEngine } from '../services/pipeline'

export const exportRouter = new Hono<Env>()

// GET /v1/export/agents — Export agents as CSV (B-4)
exportRouter.get('/agents', async (c) => {
  const registry = await getRegistry()
  const sponsorAddress = c.get('sponsorAddress')
  const agents = registry.getAllAgents()
    .filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())

  const headers = ['agent_id', 'name', 'role', 'status', 'reputation', 'reputation_tier', 'stake_bond', 'total_actions', 'created_at', 'expires_at']
  const rows = agents.map(a => [
    a.agentId, a.name, a.role, a.status, a.reputation, a.reputationTier,
    a.stakeBond, a.totalActionsExecuted,
    new Date(a.createdAt).toISOString(),
    a.expiresAt ? new Date(a.expiresAt).toISOString() : '',
  ])

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="xorb-agents-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})

// GET /v1/export/audit/:agentId — Export audit log as CSV (B-4)
exportRouter.get('/audit/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const registry = await getRegistry()
  const agent = registry.getAgent(agentId)
  if (!agent) return err(c, 'not_found', 'Agent not found', 404)

  const sponsorAddress = c.get('sponsorAddress')
  if (agent.sponsorAddress.toLowerCase() !== sponsorAddress.toLowerCase()) {
    return err(c, 'forbidden', 'Forbidden', 403)
  }

  const bus = getEventBus()
  const events = bus.getEvents({ agentId, limit: 5000 })

  const headers = ['event_id', 'type', 'timestamp', 'data']
  const rows = events.map(e => [
    e.id, e.type, e.timestamp, JSON.stringify(e.data).replace(/"/g, '""'),
  ])

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="xorb-audit-${agentId}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})
