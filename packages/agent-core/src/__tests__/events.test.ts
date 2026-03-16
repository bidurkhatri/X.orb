import { describe, it, expect, beforeEach } from 'vitest'
import { EventBus } from '../events'

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  it('emits and receives events by type', async () => {
    const received: string[] = []
    bus.on('agent.registered', (e) => { received.push(e.id) })

    await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
    expect(received).toHaveLength(1)
  })

  it('does not fire handler for different event type', async () => {
    const received: string[] = []
    bus.on('agent.paused', (e) => { received.push(e.id) })

    await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
    expect(received).toHaveLength(0)
  })

  it('onAll receives all events', async () => {
    const received: string[] = []
    bus.onAll((e) => { received.push(e.type) })

    await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
    await bus.emit({ type: 'action.approved', agentId: 'a1', data: {} })
    expect(received).toEqual(['agent.registered', 'action.approved'])
  })

  it('unsubscribe works', async () => {
    const received: string[] = []
    const unsub = bus.on('agent.slashed', (e) => { received.push(e.id) })

    await bus.emit({ type: 'agent.slashed', agentId: 'a1', data: {} })
    unsub()
    await bus.emit({ type: 'agent.slashed', agentId: 'a1', data: {} })

    expect(received).toHaveLength(1)
  })

  it('getEvents returns filtered results', async () => {
    await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
    await bus.emit({ type: 'action.approved', agentId: 'a2', data: {} })
    await bus.emit({ type: 'action.blocked', agentId: 'a1', data: {} })

    const a1Events = bus.getEvents({ agentId: 'a1' })
    expect(a1Events).toHaveLength(2)

    const approvedEvents = bus.getEvents({ type: 'action.approved' })
    expect(approvedEvents).toHaveLength(1)
  })

  it('assigns unique IDs and timestamps', async () => {
    const event = await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
    expect(event.id).toMatch(/^evt_/)
    expect(event.timestamp).toBeDefined()
  })

  it('handler errors do not break emission', async () => {
    bus.on('agent.registered', () => { throw new Error('boom') })
    bus.on('agent.registered', () => {}) // second handler should still fire

    // Should not throw
    await bus.emit({ type: 'agent.registered', agentId: 'a1', data: {} })
  })
})
