import { Hono } from 'hono'
import type { Env } from '../app'
import { getEventBus } from '../services/pipeline'

export const eventsRouter = new Hono<Env>()

// GET /v1/events — Get recent events (polling-based, Vercel compatible)
eventsRouter.get('/', async (c) => {
  const bus = getEventBus()
  const events = bus.getEvents({
    type: c.req.query('type') as any,
    agentId: c.req.query('agent_id'),
    limit: parseInt(c.req.query('limit') || '100'),
    since: c.req.query('since'),
  })
  return c.json({ events, count: events.length })
})

// GET /v1/events/stream — Long-poll for new events (Vercel compatible)
// NOTE: True SSE requires a persistent server (Railway/Fly.io).
// On Vercel Serverless, we use long-polling: hold the request for up to
// 25 seconds waiting for new events, then return whatever we have.
eventsRouter.get('/stream', async (c) => {
  const agentId = c.req.query('agent_id')
  const eventTypes = c.req.query('event_types')?.split(',')
  const since = c.req.query('since') || new Date(Date.now() - 60000).toISOString()
  const timeoutMs = Math.min(parseInt(c.req.query('timeout') || '25000'), 25000)

  const bus = getEventBus()
  const deadline = Date.now() + timeoutMs

  // Poll until we get events or timeout
  while (Date.now() < deadline) {
    let events = bus.getEvents({ since })

    if (agentId) {
      events = events.filter(e => e.agentId === agentId)
    }
    if (eventTypes) {
      events = events.filter(e => eventTypes.includes(e.type))
    }

    if (events.length > 0) {
      return c.json({
        events,
        count: events.length,
        has_more: false,
        poll_again: true,
      })
    }

    // Wait 500ms before checking again
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Timeout — return empty with poll instruction
  return c.json({
    events: [],
    count: 0,
    has_more: false,
    poll_again: true,
  })
})
