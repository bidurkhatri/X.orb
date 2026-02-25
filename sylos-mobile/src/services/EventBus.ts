/**
 * Mobile EventBus — mirrors the desktop's EventBus.
 *
 * On mobile, events are persisted to AsyncStorage instead of localStorage.
 * The bus supports subscribe, emit, and replay of recent events.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventType, ActivityEvent } from '../types/agent';

type EventHandler = (event: ActivityEvent) => void;
type UnsubscribeFn = () => void;

const EVENT_LOG_KEY = 'sylos_event_log';
const MAX_LOG_SIZE = 200;

class MobileEventBus {
  private handlers: Map<EventType | '*', Set<EventHandler>> = new Map();
  private eventLog: ActivityEvent[] = [];
  private idCounter = 0;
  private loaded = false;

  async init(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(EVENT_LOG_KEY);
      if (raw) this.eventLog = JSON.parse(raw);
    } catch { /* empty */ }
    this.loaded = true;
  }

  on(type: EventType | '*', handler: EventHandler): UnsubscribeFn {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => { this.handlers.get(type)?.delete(handler); };
  }

  onPrefix(prefix: string, handler: EventHandler): UnsubscribeFn {
    const wrapped: EventHandler = (event) => {
      if (event.type.startsWith(prefix)) handler(event);
    };
    return this.on('*', wrapped);
  }

  emit(type: EventType, source: string, sourceName: string, payload: any): ActivityEvent {
    const event: ActivityEvent = {
      id: `evt_${Date.now()}_${this.idCounter++}`,
      type,
      source,
      sourceName,
      payload,
      timestamp: Date.now(),
    };

    this.eventLog.push(event);
    if (this.eventLog.length > MAX_LOG_SIZE) {
      this.eventLog = this.eventLog.slice(-MAX_LOG_SIZE);
    }
    this.saveLog();

    const specific = this.handlers.get(type);
    if (specific) {
      for (const handler of specific) {
        try { handler(event); } catch { /* swallow */ }
      }
    }
    const wildcard = this.handlers.get('*');
    if (wildcard) {
      for (const handler of wildcard) {
        try { handler(event); } catch { /* swallow */ }
      }
    }
    return event;
  }

  getRecentEvents(limit = 50, typePrefix?: string): ActivityEvent[] {
    let events = this.eventLog;
    if (typePrefix) events = events.filter(e => e.type.startsWith(typePrefix));
    return events.slice(-limit);
  }

  getAgentEvents(agentId: string, limit = 50): ActivityEvent[] {
    return this.eventLog.filter(e => e.source === agentId).slice(-limit);
  }

  /** Import events from desktop sync (merge without duplicates) */
  importEvents(events: ActivityEvent[]): void {
    const existingIds = new Set(this.eventLog.map(e => e.id));
    const newEvents = events.filter(e => !existingIds.has(e.id));
    this.eventLog.push(...newEvents);
    this.eventLog.sort((a, b) => a.timestamp - b.timestamp);
    if (this.eventLog.length > MAX_LOG_SIZE) {
      this.eventLog = this.eventLog.slice(-MAX_LOG_SIZE);
    }
    this.saveLog();
  }

  clear(): void {
    this.eventLog = [];
    this.saveLog();
  }

  private async saveLog(): Promise<void> {
    try {
      await AsyncStorage.setItem(EVENT_LOG_KEY, JSON.stringify(this.eventLog));
    } catch { /* quota exceeded */ }
  }
}

export const eventBus = new MobileEventBus();
