import { Hono } from 'hono'
import type { Env } from '../app'
import { ok, err } from '../lib/response'
import { getEventBus } from '../services/pipeline'
import { authorizeSponsor } from '../middleware/auth'
import { getRegistry } from '../services/registry'
import { getPlatformEvents } from '../adapters/supabase-services'

export const eventsRouter = new Hono<Env>()

// GET /v1/events — Get recent events (A-8: ownership-filtered)
eventsRouter.get('/', async (c) => {
  const agentId = c.req.query('agent_id')
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 500)
  const cursor = c.req.query('cursor') ? parseInt(c.req.query('cursor')!) : undefined
  const since = c.req.query('since')
  const eventType = c.req.query('type') || undefined

  if (agentId) {
    const authErr = await authorizeSponsor(c, agentId)
    if (authErr) return authErr
  }

  // Try persistent store first (Supabase)
  const persistedEvents = await getPlatformEvents({
    agentId: agentId || undefined,
    eventType,
    since: since || undefined,
    limit,
    cursor,
  })

  if (persistedEvents.length > 0) {
    // Filter to owned agents if no specific agent requested
    if (!agentId) {
      const registry = await getRegistry()
      const sponsorAddress = c.get('sponsorAddress')
      const ownedIds = new Set(
        registry.getAllAgents()
          .filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())
          .map(a => a.agentId)
      )
      const filtered = persistedEvents.filter(e => !e.agent_id || ownedIds.has(e.agent_id))
      const nextCursor = filtered.length === limit ? filtered[filtered.length - 1].id : undefined
      return c.json({
        success: true,
        data: filtered,
        pagination: { next_cursor: nextCursor?.toString(), has_more: filtered.length === limit },
      })
    }
    const nextCursor = persistedEvents.length === limit ? persistedEvents[persistedEvents.length - 1].id : undefined
    return c.json({
      success: true,
      data: persistedEvents,
      pagination: { next_cursor: nextCursor?.toString(), has_more: persistedEvents.length === limit },
    })
  }

  // Fallback: in-memory event bus (dev mode)
  const bus = getEventBus()
  let events = bus.getEvents({
    type: eventType as import('@xorb/agent-core').XorbEventType | undefined,
    agentId: agentId || undefined,
    limit,
    since: since || undefined,
  })

  if (!agentId) {
    const registry = await getRegistry()
    const sponsorAddress = c.get('sponsorAddress')
    const ownedIds = new Set(
      registry.getAllAgents()
        .filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())
        .map(a => a.agentId)
    )
    events = events.filter(e => !e.agentId || ownedIds.has(e.agentId))
  }

  return c.json({ success: true, data: events, pagination: { has_more: false } })
})

// GET /v1/events/stream — Single-query poll (A-9: no busy-wait)
// Instead of a while loop, do a single Supabase query.
// Client polls repeatedly with `since` parameter.
eventsRouter.get('/stream', async (c) => {
  const agentId = c.req.query('agent_id')
  if (agentId) {
    const authErr = await authorizeSponsor(c, agentId)
    if (authErr) return authErr
  }

  const since = c.req.query('since') || new Date(Date.now() - 60000).toISOString()
  const eventTypes = c.req.query('event_types')?.split(',')

  // Single query — no loop, no blocking
  const events = await getPlatformEvents({
    agentId: agentId || undefined,
    since,
    limit: 50,
  })

  let filtered = events
  if (eventTypes) {
    filtered = events.filter(e => eventTypes.includes(e.event_type))
  }

  // Filter to owned agents
  if (!agentId) {
    const registry = await getRegistry()
    const sponsorAddress = c.get('sponsorAddress')
    const ownedIds = new Set(
      registry.getAllAgents()
        .filter(a => a.sponsorAddress.toLowerCase() === sponsorAddress.toLowerCase())
        .map(a => a.agentId)
    )
    filtered = filtered.filter(e => !e.agent_id || ownedIds.has(e.agent_id))
  }

  return ok(c, {
    events: filtered,
    count: filtered.length,
    has_more: false,
    poll_again: true,
    poll_after: new Date().toISOString(), // client uses this as next `since`
  })
})
