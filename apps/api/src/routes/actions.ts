import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { runPipeline, runBatchPipeline } from '../services/pipeline'

const executeActionSchema = z.object({
  agent_id: z.string(),
  action: z.string(),
  tool: z.string(),
  params: z.record(z.unknown()).optional(),
})

const batchActionSchema = z.object({
  actions: z.array(z.object({
    agent_id: z.string(),
    action: z.string(),
    tool: z.string(),
    params: z.record(z.unknown()).optional(),
  })).min(1).max(100),
})

export const actionsRouter = new Hono<Env>()

// POST /v1/actions/execute — Single action through 8-gate pipeline
actionsRouter.post('/execute', zValidator('json', executeActionSchema), async (c) => {
  const body = c.req.valid('json')
  const result = await runPipeline(body.agent_id, body.action, body.tool, body.params || {})
  const status = result.approved ? 200 : 403
  return c.json(result, status as any)
})

// POST /v1/actions/batch — Batch up to 100 actions
actionsRouter.post('/batch', zValidator('json', batchActionSchema), async (c) => {
  const { actions } = c.req.valid('json')
  const results = await runBatchPipeline(actions)

  const approved = results.filter(r => r.approved).length
  const blocked = results.filter(r => !r.approved).length

  return c.json({
    total: results.length,
    approved,
    blocked,
    results,
  })
})