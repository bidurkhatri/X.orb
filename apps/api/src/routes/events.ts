import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { Env } from '../app'
import { getEventBus } from '../services/pipeline'

export const eventsRouter = new Hono<Env>()

// GET /v1/events/stream — SSE event stream
eventsRouter.get('/stream', async (c) => {
  const agentId = c.req.query('agent_id')
  const eventTypes = c.req.query('event_types')?.split(',')

  return streamSSE(c, async (stream) => {
    const bus = getEventBus()

    const unsubscribe = bus.onAll(async (event) => {
      // Filter by agent
      if (agentId && event.agentId !== agentId) return
      // Filter by event types
      if (eventTypes && !eventTypes.includes(event.type)) return

      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
        id: event.id,
      })
    })

    // Keep alive ping every 30s
    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({ event: 'ping', data: new Date().toISOString() })
      } catch {
        clearInterval(keepAlive)
      }
    }, 30000)

    // Clean up on disconnect
    stream.onAbort(() => {
      unsubscribe()
      clearInterval(keepAlive)
    })

    // Keep stream open
    await new Promise(() => {})
  })
})

// GET /v1/events — Get recent events
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
