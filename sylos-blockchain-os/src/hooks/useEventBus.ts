/**
 * useEventBus — React hook for subscribing to the SylOS EventBus.
 *
 * Apps use this to react to real-time events from agents, marketplace,
 * community, and system-wide notifications.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { eventBus, type SylOSEvent, type EventType } from '../services/EventBus'

/**
 * Subscribe to specific event types. Returns recent events and a live stream.
 */
export function useEventBus(types: EventType | EventType[] | '*', limit = 50) {
  const [events, setEvents] = useState<SylOSEvent[]>([])
  const typesRef = useRef(types)
  typesRef.current = types

  useEffect(() => {
    // Load recent events matching our filter
    const typeArr = Array.isArray(typesRef.current) ? typesRef.current : [typesRef.current]
    if (typeArr.includes('*' as EventType)) {
      setEvents(eventBus.getRecentEvents(limit))
    } else {
      const all = typeArr.flatMap(t => eventBus.getRecentEvents(limit, t.split(':')[0]))
      // Deduplicate and sort
      const unique = Array.from(new Map(all.map(e => [e.id, e])).values())
      unique.sort((a, b) => b.timestamp - a.timestamp)
      setEvents(unique.slice(0, limit))
    }

    // Subscribe to live events
    const unsubs: (() => void)[] = []
    const typeArray = Array.isArray(typesRef.current) ? typesRef.current : [typesRef.current]
    for (const type of typeArray) {
      const unsub = eventBus.on(type, (event) => {
        setEvents(prev => {
          const next = [event, ...prev].slice(0, limit)
          return next
        })
      })
      unsubs.push(unsub)
    }

    return () => unsubs.forEach(fn => fn())
  }, [limit])

  return events
}

/**
 * Subscribe to events matching a prefix (e.g., 'agent:' for all agent events).
 */
export function useEventBusPrefix(prefix: string, limit = 50) {
  const [events, setEvents] = useState<SylOSEvent[]>(() =>
    eventBus.getRecentEvents(limit, prefix)
  )

  useEffect(() => {
    const unsub = eventBus.onPrefix(prefix, (event) => {
      setEvents(prev => [event, ...prev].slice(0, limit))
    })
    return unsub
  }, [prefix, limit])

  return events
}

/**
 * Get events for a specific agent.
 */
export function useAgentEvents(agentId: string, limit = 50) {
  const [events, setEvents] = useState<SylOSEvent[]>(() =>
    eventBus.getAgentEvents(agentId, limit)
  )

  useEffect(() => {
    const unsub = eventBus.on('*', (event) => {
      if (event.source === agentId) {
        setEvents(prev => [event, ...prev].slice(0, limit))
      }
    })
    return unsub
  }, [agentId, limit])

  return events
}

/**
 * Emit an event from a React component.
 */
export function useEmitEvent() {
  return useCallback(<T = any>(type: EventType, source: string, sourceName: string, payload: T) => {
    return eventBus.emit(type, source, sourceName, payload)
  }, [])
}
