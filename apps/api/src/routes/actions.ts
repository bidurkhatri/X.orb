import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'
import { runPipeline } from '../services/pipeline'

const executeActionSchema = z.object({
  agent_id: z.string(),
  action: z.string(),
  tool: z.string(),
  params: z.record(z.unknown()).optional(),
})

export const actionsRouter = new Hono<Env>()

// POST /v1/actions/execute — Execute action through 8-gate pipeline
actionsRouter.post('/execute', zValidator('json', executeActionSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await runPipeline(body.agent_id, body.action, body.tool, body.params || {})
  const status = result.approved ? 200 : 403
  return c.json(result, status as any)
})

// GET /v1/actions/:id — Get action result (placeholder)
actionsRouter.get('/:id', async (c) => {
  return c.json({ error: 'Not yet implemented' }, 501)
})
