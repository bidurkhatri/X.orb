import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { getWebhookService } from '../services/pipeline'

const createWebhookSchema = z.object({
  url: z.string().url(),
  event_types: z.array(z.string()).min(1),
})

export const webhooksRouter = new Hono<Env>()

// POST /v1/webhooks — Subscribe
webhooksRouter.post('/', zValidator('json', createWebhookSchema), async (c) => {
  const { url, event_types } = c.req.valid('json')
  const ws = getWebhookService()

  const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`

  ws.addEndpoint({
    id,
    url,
    eventTypes: event_types,
    secret,
    active: true,
    failureCount: 0,
  })

  return c.json({ id, url, event_types, secret, active: true }, 201)
})

// GET /v1/webhooks — List subscriptions
webhooksRouter.get('/', async (c) => {
  const ws = getWebhookService()
  const endpoints = ws.getAllEndpoints().map(e => ({
    id: e.id,
    url: e.url,
    event_types: e.eventTypes,
    active: e.active,
    failure_count: e.failureCount,
    last_delivery_at: e.lastDeliveryAt,
  }))
  return c.json({ webhooks: endpoints })
})

// DELETE /v1/webhooks/:id — Unsubscribe
webhooksRouter.delete('/:id', async (c) => {
  const ws = getWebhookService()
  ws.removeEndpoint(c.req.param('id'))
  return c.json({ deleted: true })
})

// GET /v1/webhooks/:id/deliveries — Delivery log
webhooksRouter.get('/:id/deliveries', async (c) => {
  const ws = getWebhookService()
  const deliveries = ws.getDeliveries(c.req.param('id'))
  return c.json({ deliveries })
})
