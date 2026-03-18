// Re-export from shared types to avoid duplication
export type { XorbEventType } from '@xorb/types'
import type { XorbEventType } from '@xorb/types'

export interface XorbEvent {
  id: string
  type: XorbEventType
  agentId: string
  data: Record<string, unknown>
  timestamp: string
}

type EventHandler = (event: XorbEvent) => void | Promise<void>

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()
  private allHandlers = new Set<EventHandler>()
  private eventLog: XorbEvent[] = []
  private maxLogSize = 10000

  /**
   * Subscribe to a specific event type.
   */
  on(eventType: XorbEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
    return () => this.handlers.get(eventType)?.delete(handler)
  }

  /**
   * Subscribe to all events.
   */
  onAll(handler: EventHandler): () => void {
    this.allHandlers.add(handler)
    return () => this.allHandlers.delete(handler)
  }

  /**
   * Emit an event. Fires all matching handlers.
   */
  async emit(event: Omit<XorbEvent, 'id' | 'timestamp'>): Promise<XorbEvent> {
    const fullEvent: XorbEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    }

    // Log event
    this.eventLog.push(fullEvent)
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.splice(0, this.eventLog.length - this.maxLogSize)
    }

    // Fire type-specific handlers
    const typeHandlers = this.handlers.get(event.type) || new Set()
    for (const handler of typeHandlers) {
      try {
        await handler(fullEvent)
      } catch (err) {
        console.error(`[EventBus] Handler error for ${event.type}:`, err)
      }
    }

    // Fire global handlers
    for (const handler of this.allHandlers) {
      try {
        await handler(fullEvent)
      } catch (err) {
        console.error(`[EventBus] Global handler error:`, err)
      }
    }

    return fullEvent
  }

  /**
   * Get recent events, optionally filtered by type or agent.
   */
  getEvents(opts?: {
    type?: XorbEventType
    agentId?: string
    limit?: number
    since?: string
  }): XorbEvent[] {
    let events = this.eventLog

    if (opts?.type) {
      events = events.filter(e => e.type === opts.type)
    }
    if (opts?.agentId) {
      events = events.filter(e => e.agentId === opts.agentId)
    }
    if (opts?.since) {
      const sinceTime = new Date(opts.since).getTime()
      events = events.filter(e => new Date(e.timestamp).getTime() > sinceTime)
    }

    return events.slice(-(opts?.limit || 100))
  }

  /**
   * Clear all handlers (useful for testing).
   */
  clear(): void {
    this.handlers.clear()
    this.allHandlers.clear()
  }
}
