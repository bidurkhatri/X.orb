import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * We cannot import the singleton directly because EventBus reads localStorage
 * in its constructor. Instead we re-import the module fresh for each test suite
 * after stubbing globals.
 */

/* ─── localStorage stub ─── */
let storage: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => { storage[k] = v },
  removeItem: (k: string) => { delete storage[k] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
})

// Dynamic import so the constructor sees our stubbed localStorage
const { eventBus } = await import('./EventBus')
type EventType = Parameters<typeof eventBus.on>[0]

beforeEach(() => {
  storage = {}
  eventBus.clear()
})

/* ════════════════════════════════════════════ */

describe('EventBus', () => {
  /* ─── subscribe + emit ─── */

  it('delivers an event to a matching subscriber', () => {
    const handler = vi.fn()
    eventBus.on('agent:spawned', handler)

    const evt = eventBus.emit('agent:spawned', 'agent_1', 'TestAgent', { foo: 1 })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(evt)
    expect(evt.type).toBe('agent:spawned')
    expect(evt.source).toBe('agent_1')
    expect(evt.payload).toEqual({ foo: 1 })
  })

  it('does not deliver events of a different type', () => {
    const handler = vi.fn()
    eventBus.on('agent:spawned', handler)

    eventBus.emit('agent:paused', 'agent_1', 'TestAgent', {})

    expect(handler).not.toHaveBeenCalled()
  })

  /* ─── wildcard ─── */

  it('wildcard subscriber receives all events', () => {
    const handler = vi.fn()
    eventBus.on('*', handler)

    eventBus.emit('agent:spawned', 's1', 'A', {})
    eventBus.emit('tx:executed', 's2', 'B', {})

    expect(handler).toHaveBeenCalledTimes(2)
  })

  /* ─── prefix subscription ─── */

  it('onPrefix receives only events matching the prefix', () => {
    const handler = vi.fn()
    eventBus.onPrefix('agent:', handler)

    eventBus.emit('agent:spawned', 'a', 'A', {})
    eventBus.emit('agent:paused', 'a', 'A', {})
    eventBus.emit('tx:executed', 'b', 'B', {})

    expect(handler).toHaveBeenCalledTimes(2)
  })

  /* ─── unsubscribe ─── */

  it('unsubscribe stops further delivery', () => {
    const handler = vi.fn()
    const unsub = eventBus.on('agent:spawned', handler)

    eventBus.emit('agent:spawned', 'a', 'A', {})
    expect(handler).toHaveBeenCalledOnce()

    unsub()

    eventBus.emit('agent:spawned', 'a', 'A', {})
    expect(handler).toHaveBeenCalledOnce() // still 1
  })

  it('onPrefix unsubscribe stops delivery', () => {
    const handler = vi.fn()
    const unsub = eventBus.onPrefix('community:', handler)

    eventBus.emit('community:post_created', 'a', 'A', {})
    expect(handler).toHaveBeenCalledOnce()

    unsub()

    eventBus.emit('community:post_created', 'a', 'A', {})
    expect(handler).toHaveBeenCalledOnce()
  })

  /* ─── failing handlers ─── */

  it('a failing handler does not prevent other handlers from running', () => {
    const badHandler = vi.fn(() => { throw new Error('boom') })
    const goodHandler = vi.fn()

    eventBus.on('agent:spawned', badHandler)
    eventBus.on('agent:spawned', goodHandler)

    // Suppress expected console.error noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    eventBus.emit('agent:spawned', 'a', 'A', {})
    spy.mockRestore()

    expect(badHandler).toHaveBeenCalledOnce()
    expect(goodHandler).toHaveBeenCalledOnce()
  })

  it('a failing wildcard handler does not prevent other wildcard handlers', () => {
    const badHandler = vi.fn(() => { throw new Error('wildcard boom') })
    const goodHandler = vi.fn()

    eventBus.on('*', badHandler)
    eventBus.on('*', goodHandler)

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    eventBus.emit('agent:spawned', 'a', 'A', {})
    spy.mockRestore()

    expect(goodHandler).toHaveBeenCalledOnce()
  })

  /* ─── event log ─── */

  it('records emitted events in the log', () => {
    eventBus.emit('agent:spawned', 'a', 'A', { n: 1 })
    eventBus.emit('agent:paused', 'a', 'A', { n: 2 })

    const recent = eventBus.getRecentEvents(10)
    expect(recent).toHaveLength(2)
    expect(recent[0]!.type).toBe('agent:spawned')
    expect(recent[1]!.type).toBe('agent:paused')
  })

  it('getRecentEvents filters by type prefix', () => {
    eventBus.emit('agent:spawned', 'a', 'A', {})
    eventBus.emit('tx:executed', 'b', 'B', {})
    eventBus.emit('agent:paused', 'a', 'A', {})

    const agentEvents = eventBus.getRecentEvents(10, 'agent:')
    expect(agentEvents).toHaveLength(2)
    agentEvents.forEach(e => expect(e.type.startsWith('agent:')).toBe(true))
  })

  it('getAgentEvents returns only events from that source', () => {
    eventBus.emit('agent:spawned', 'agent_x', 'X', {})
    eventBus.emit('agent:spawned', 'agent_y', 'Y', {})
    eventBus.emit('agent:paused', 'agent_x', 'X', {})

    const xEvents = eventBus.getAgentEvents('agent_x')
    expect(xEvents).toHaveLength(2)
    xEvents.forEach(e => expect(e.source).toBe('agent_x'))
  })

  it('getRecentEvents respects the limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      eventBus.emit('agent:spawned', 'a', 'A', { i })
    }
    const limited = eventBus.getRecentEvents(3)
    expect(limited).toHaveLength(3)
    // Should return the last 3
    expect(limited[0]!.payload.i).toBe(7)
  })

  /* ─── max log size ─── */

  it('trims the log when it exceeds MAX_LOG_SIZE (500)', () => {
    // Emit 510 events
    for (let i = 0; i < 510; i++) {
      eventBus.emit('agent:spawned', 'a', 'A', { i })
    }

    const all = eventBus.getRecentEvents(1000)
    expect(all.length).toBeLessThanOrEqual(500)
    // Oldest surviving event should be i=10 (first 10 trimmed)
    expect(all[0]!.payload.i).toBe(10)
  })

  /* ─── persistence ─── */

  it('persists events to localStorage on emit', () => {
    eventBus.emit('agent:spawned', 'a', 'A', { x: 42 })

    const raw = storage['sylos_event_log']
    expect(raw).toBeDefined()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].payload.x).toBe(42)
  })

  it('clear empties the log and updates localStorage', () => {
    eventBus.emit('agent:spawned', 'a', 'A', {})
    expect(eventBus.getRecentEvents(10)).toHaveLength(1)

    eventBus.clear()

    expect(eventBus.getRecentEvents(10)).toHaveLength(0)
    expect(JSON.parse(storage['sylos_event_log']!)).toHaveLength(0)
  })

  /* ─── event shape ─── */

  it('emitted events have the correct shape', () => {
    const evt = eventBus.emit('system:notification', 'system', 'SylOS', { msg: 'hello' })

    expect(evt.id).toMatch(/^evt_/)
    expect(typeof evt.timestamp).toBe('number')
    expect(evt.type).toBe('system:notification')
    expect(evt.source).toBe('system')
    expect(evt.sourceName).toBe('SylOS')
    expect(evt.payload).toEqual({ msg: 'hello' })
  })
})
