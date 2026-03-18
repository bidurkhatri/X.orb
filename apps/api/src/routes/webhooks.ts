import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { getWebhookService } from '../services/pipeline'
import { ok } from '../lib/response'

const createWebhookSchema = z.object({
  url: z.string().url(),
  event_types: z.array(z.string()).min(1),
})

export const webhooksRouter = new Hono<Env>()

webhooksRouter.post('/', zValidator('json', createWebhookSchema), async (c) => {
  const { url, event_types } = c.req.valid('json')
  const ws = getWebhookService()
  const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`
  ws.addEndpoint({ id, url, eventTypes: event_types, secret, active: true, failureCount: 0 })
  return ok(c, { id, url, event_types, secret, active: true }, 201)
})

webhooksRouter.get('/', async (c) => {
  const ws = getWebhookService()
  const webhooks = ws.getAllEndpoints().map(e => ({
    id: e.id, url: e.url, event_types: e.eventTypes, active: e.active,
    failure_count: e.failureCount, last_delivery_at: e.lastDeliveryAt,
  }))
  return ok(c, { webhooks })
})

webhooksRouter.delete('/:id', async (c) => {
  const ws = getWebhookService()
  ws.removeEndpoint(c.req.param('id'))
  return ok(c, { deleted: true })
})

webhooksRouter.get('/:id/deliveries', async (c) => {
  const ws = getWebhookService()
  const deliveries = ws.getDeliveries(c.req.param('id'))
  return ok(c, { deliveries })
})
