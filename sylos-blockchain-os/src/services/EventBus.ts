/**
 * SylOS EventBus — Central Nervous System
 *
 * This is the REAL backbone connecting all apps. When an agent acts,
 * every app that cares about that action gets notified instantly.
 *
 * Unlike the IpcBridge (agent-to-OS messaging), the EventBus is for
 * cross-app data flow: agent posts in Community, Reputation updates,
 * Marketplace changes, job postings — everything flows through here.
 *
 * All events are typed. All subscribers are notified synchronously.
 * Events are persisted to localStorage for replay on page refresh.
 */

/* ─── Event Types ─── */

export type EventType =
  // Agent lifecycle
  | 'agent:spawned'
  | 'agent:paused'
  | 'agent:resumed'
  | 'agent:revoked'
  | 'agent:reputation_changed'
  // Agent autonomous actions
  | 'agent:thought'              // Agent had an internal thought/plan
  | 'agent:tool_executed'        // Agent used a tool
  | 'agent:task_completed'       // Agent finished a task
  | 'agent:task_failed'
  // Community
  | 'community:post_created'
  | 'community:reply_created'
  | 'community:post_voted'
  // Marketplace
  | 'marketplace:listing_created'
  | 'marketplace:agent_hired'
  | 'marketplace:engagement_completed'
  // Hire Humans
  | 'jobs:job_posted'
  | 'jobs:application_received'
  | 'jobs:human_hired'
  | 'jobs:contract_completed'
  // Transactions
  | 'tx:proposal_created'
  | 'tx:approved'
  | 'tx:rejected'
  | 'tx:executed'
  // System
  | 'system:notification'
  | 'system:error'
  // IDE
  | 'ide:file_created'
  | 'ide:file_updated'
  // Apps
  | 'apps:submission'

export interface SylOSEvent<T = any> {
  id: string
  type: EventType
  source: string            // agentId or 'system' or 'user'
  sourceName: string        // display name
  payload: T
  timestamp: number
}

/* ─── Subscriber ─── */

type EventHandler<T = any> = (event: SylOSEvent<T>) => void
type UnsubscribeFn = () => void

/* ─── Event Log ─── */

const EVENT_LOG_KEY = 'sylos_event_log'
const MAX_LOG_SIZE = 500

/* ─── The Bus ─── */

class EventBus {
  private handlers: Map<EventType | '*', Set<EventHandler>> = new Map()
  private eventLog: SylOSEvent[] = []
  private idCounter = 0

  constructor() {
    this.loadLog()
  }

  /**
   * Subscribe to a specific event type, or '*' for all events.
   * Returns an unsubscribe function.
   */
  on<T = any>(type: EventType | '*', handler: EventHandler<T>): UnsubscribeFn {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler as EventHandler)
    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler)
    }
  }

  /**
   * Subscribe to events matching a prefix (e.g., 'agent:' matches all agent events).
   */
  onPrefix<T = any>(prefix: string, handler: EventHandler<T>): UnsubscribeFn {
    const wrappedHandler: EventHandler = (event) => {
      if (event.type.startsWith(prefix)) {
        handler(event)
      }
    }
    return this.on('*', wrappedHandler)
  }

  /**
   * Emit an event. All matching subscribers are notified.
   */
  emit<T = any>(type: EventType, source: string, sourceName: string, payload: T): SylOSEvent<T> {
    const event: SylOSEvent<T> = {
      id: `evt_${Date.now()}_${this.idCounter++}`,
      type,
      source,
      sourceName,
      payload,
      timestamp: Date.now(),
    }

    // Log it
    this.eventLog.push(event)
    if (this.eventLog.length > MAX_LOG_SIZE) {
      this.eventLog = this.eventLog.slice(-MAX_LOG_SIZE)
    }
    this.saveLog()

    // Notify specific handlers
    const specific = this.handlers.get(type)
    if (specific) {
      for (const handler of specific) {
        try { handler(event) } catch (err) { console.error(`[EventBus] Handler error for ${type}:`, err) }
      }
    }

    // Notify wildcard handlers
    const wildcard = this.handlers.get('*')
    if (wildcard) {
      for (const handler of wildcard) {
        try { handler(event) } catch (err) { console.error(`[EventBus] Wildcard handler error:`, err) }
      }
    }

    return event
  }

  /**
   * Get recent events, optionally filtered by type prefix.
   */
  getRecentEvents(limit = 50, typePrefix?: string): SylOSEvent[] {
    let events = this.eventLog
    if (typePrefix) {
      events = events.filter(e => e.type.startsWith(typePrefix))
    }
    return events.slice(-limit)
  }

  /**
   * Get events by source agent.
   */
  getAgentEvents(agentId: string, limit = 50): SylOSEvent[] {
    return this.eventLog.filter(e => e.source === agentId).slice(-limit)
  }

  /**
   * Clear the event log.
   */
  clear() {
    this.eventLog = []
    this.saveLog()
  }

  private loadLog() {
    try {
      const saved = localStorage.getItem(EVENT_LOG_KEY)
      if (saved) this.eventLog = JSON.parse(saved)
    } catch { /* */ }
  }

  private saveLog() {
    try {
      localStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.eventLog))
    } catch { /* quota exceeded — trim harder */ }
  }
}

/* ─── Singleton ─── */
export const eventBus = new EventBus()
