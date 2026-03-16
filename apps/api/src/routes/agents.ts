import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'

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
  caller_address: z.string().min(10),
  renew_days: z.number().min(1).max(365).optional(),
})

export const agentsRouter = new Hono<Env>()

// POST /v1/agents — Register a new agent
agentsRouter.post('/', zValidator('json', createAgentSchema), async (c) => {
  const body = c.req.valid('json')
  const registry = await getRegistry()

  const agent = await registry.spawnAgent({
    name: body.name,
    role: body.role,
    sponsorAddress: body.sponsor_address,
    stakeBond: body.stake_bond,
    expiryDays: body.expiry_days,
    description: body.description,
  })

  return c.json({ agent }, 201)
})

// GET /v1/agents — List agents
agentsRouter.get('/', async (c) => {
  const registry = await getRegistry()
  const sponsorAddress = c.req.query('sponsor')
  const status = c.req.query('status')

  let agents = registry.getAllAgents()
  if (sponsorAddress) {
    agents = agents.filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())
  }
  if (status) {
    agents = agents.filter(a => a.status === status)
  }

  return c.json({ agents, count: agents.length })
})

// GET /v1/agents/:id — Get agent details
agentsRouter.get('/:id', async (c) => {
  const registry = await getRegistry()
  const agent = registry.getAgent(c.req.param('id'))
  if (!agent) return c.json({ error: 'Agent not found' }, 404)
  return c.json({ agent })
})

// PATCH /v1/agents/:id — Update agent (pause/resume/renew)
agentsRouter.patch('/:id', zValidator('json', updateAgentSchema), async (c) => {
  const { action, caller_address, renew_days } = c.req.valid('json')
  const agentId = c.req.param('id')
  const registry = await getRegistry()

  let agent
  switch (action) {
    case 'pause':
      agent = await registry.pauseAgent(agentId, caller_address)
      break
    case 'resume':
      agent = await registry.resumeAgent(agentId, caller_address)
      break
    case 'renew':
      // TODO: implement renew in registry
      throw new Error('Renew not yet implemented')
    default:
      return c.json({ error: 'Invalid action' }, 400)
  }

  return c.json({ agent })
})

// DELETE /v1/agents/:id — Revoke agent
agentsRouter.delete('/:id', async (c) => {
  const callerAddress = c.req.header('x-caller-address')
  if (!callerAddress) return c.json({ error: 'Missing x-caller-address header' }, 400)

  const registry = await getRegistry()
  const agent = await registry.revokeAgent(c.req.param('id'), callerAddress)
  return c.json({ agent })
})
