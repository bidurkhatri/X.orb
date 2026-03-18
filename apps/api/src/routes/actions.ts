import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { runPipeline, runBatchPipeline } from '../services/pipeline'
import { authorizeSponsor } from '../middleware/auth'
import { ok } from '../lib/response'

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

actionsRouter.post('/execute', zValidator('json', executeActionSchema), async (c) => {
  const body = c.req.valid('json')
  const authErr = await authorizeSponsor(c, body.agent_id)
  if (authErr) return authErr
  const paymentCtx = c.get('paymentContext')
  const result = await runPipeline(body.agent_id, body.action, body.tool, body.params || {}, paymentCtx)

  if (result.payment) {
    c.header('X-Xorb-Payment-Status', result.payment.status)
    if (result.payment.fee_tx) c.header('X-Xorb-Fee-Tx', result.payment.fee_tx)
    if (result.payment.forward_tx) c.header('X-Xorb-Forward-Tx', result.payment.forward_tx)
    if (result.payment.refund_tx) c.header('X-Xorb-Refund-Tx', result.payment.refund_tx)
  }

  if (result.approved) {
    return ok(c, result)
  }
  return c.json({ success: false, data: result, error: { code: 'action_blocked', message: 'Action rejected by pipeline' } }, 403)
})

actionsRouter.post('/batch', zValidator('json', batchActionSchema), async (c) => {
  const { actions } = c.req.valid('json')
  for (const act of actions) {
    const authErr = await authorizeSponsor(c, act.agent_id)
    if (authErr) return authErr
  }
  const results = await runBatchPipeline(actions)
  const approved = results.filter(r => r.approved).length
  const blocked = results.filter(r => !r.approved).length
  return ok(c, { total: results.length, approved, blocked, results })
})
