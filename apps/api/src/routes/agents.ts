import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'
import { authorizeSponsor } from '../middleware/auth'
import { ok, err } from '../lib/response'
import { registerAgentOnChain } from '../services/contracts'

const createAgentSchema = z.object({
  name: z.string().min(2).max(64),
  role: z.enum(['TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR']),
  sponsor_address: z.string().min(10),
  stake_bond: z.string().optional(),
  expiry_days: z.number().min(0).max(365).optional(),
  description: z.string().max(256).optional(),
})

const updateAgentSchema = z.object({
  action: z.enum(['pause', 'resume', 'renew']),
  renew_days: z.number().min(1).max(365).optional(),
})

export const agentsRouter = new Hono<Env>()

agentsRouter.post('/', zValidator('json', createAgentSchema), async (c) => {
  const body = c.req.valid('json')
  const registry = await getRegistry()
  const agent = await registry.spawnAgent({
    name: body.name, role: body.role, sponsorAddress: body.sponsor_address,
    stakeBond: body.stake_bond, expiryDays: body.expiry_days, description: body.description,
  })

  // Non-blocking: register agent on-chain if contracts are configured
  const roleIndex = ['TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR'].indexOf(body.role)
  registerAgentOnChain({
    name: agent.name,
    role: roleIndex >= 0 ? roleIndex : 0,
    stakeBond: agent.stakeBond,
    permissionHash: JSON.stringify(agent.permissionScope),
    expiresAt: agent.expiresAt ? Math.floor(agent.expiresAt / 1000) : 0,
    sessionWallet: agent.sessionWalletAddress,
  }).catch(e => console.error(JSON.stringify({ level: 'error', service: 'agents', event: 'onchain_registration_failed', error: String(e) })))

  return ok(c, { agent }, 201)
})

agentsRouter.get('/', async (c) => {
  const registry = await getRegistry()
  const callerAddress = c.get('sponsorAddress')
  const searchTerm = c.req.query('search')
  const statusFilter = c.req.query('status')
  const limitParam = Math.min(parseInt(c.req.query('limit') || '100'), 500)

  let agents = registry.getAllAgents()
    .filter(a => a.sponsorAddress.toLowerCase() === callerAddress.toLowerCase())
  if (statusFilter) agents = agents.filter(a => a.status === statusFilter)
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    agents = agents.filter(a =>
      a.name.toLowerCase().includes(term) || a.agentId.toLowerCase().includes(term) || a.role.toLowerCase().includes(term)
    )
  }
  const pageAgents = agents.slice(0, limitParam)
  return c.json({ success: true, data: pageAgents, pagination: { has_more: agents.length > limitParam }, total: agents.length })
})

agentsRouter.get('/:id', async (c) => {
  const authErr = await authorizeSponsor(c, c.req.param('id'))
  if (authErr) return authErr
  const registry = await getRegistry()
  const agent = registry.getAgent(c.req.param('id'))
  if (!agent) return err(c, 'not_found', 'Agent not found', 404)
  return ok(c, { agent })
})

agentsRouter.get('/:id/public', async (c) => {
  const registry = await getRegistry()
  const agent = registry.getAgent(c.req.param('id'))
  if (!agent) return err(c, 'not_found', 'Agent not found', 404)
  return ok(c, {
    agent_id: agent.agentId, name: agent.name, role: agent.role,
    reputation: agent.reputation, reputation_tier: agent.reputationTier,
    status: agent.status, total_actions: agent.totalActionsExecuted,
    registered_at: new Date(agent.createdAt).toISOString(),
  })
})

agentsRouter.patch('/:id', zValidator('json', updateAgentSchema), async (c) => {
  const { action, renew_days } = c.req.valid('json')
  const agentId = c.req.param('id')
  const callerAddress = c.get('sponsorAddress')
  const registry = await getRegistry()

  let agent
  switch (action) {
    case 'pause': agent = await registry.pauseAgent(agentId, callerAddress); break
    case 'resume': agent = await registry.resumeAgent(agentId, callerAddress); break
    case 'renew': {
      const a = registry.getAgent(agentId)
      if (!a) return err(c, 'not_found', 'Agent not found', 404)
      if (a.sponsorAddress.toLowerCase() !== callerAddress.toLowerCase())
        return err(c, 'forbidden', 'Only the sponsor can renew this agent', 403)
      const days = (renew_days || 30) * 24 * 60 * 60 * 1000
      a.expiresAt = (a.expiresAt && a.expiresAt > Date.now() ? a.expiresAt : Date.now()) + days
      if (a.status === 'expired') a.status = 'active'
      agent = a; break
    }
    default: return err(c, 'validation_error', 'Invalid action', 400)
  }
  return ok(c, { agent })
})

agentsRouter.delete('/:id', async (c) => {
  const callerAddress = c.get('sponsorAddress')
  const registry = await getRegistry()
  const agent = await registry.revokeAgent(c.req.param('id'), callerAddress)
  return ok(c, { agent })
})
