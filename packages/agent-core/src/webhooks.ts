import type { XorbEvent } from './events'

export interface WebhookEndpoint {
  id: string
  url: string
  eventTypes: string[]
  secret: string
  active: boolean
  failureCount: number
  lastDeliveryAt?: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  eventType: string
  payload: unknown
  responseStatus?: number
  responseBody?: string
  success: boolean
  deliveredAt: string
}

// Max consecutive failures before disabling
const MAX_FAILURES = 5

export class WebhookService {
  private endpoints = new Map<string, WebhookEndpoint>()
  private deliveries: WebhookDelivery[] = []
  private deliverFn: (url: string, payload: string, signature: string) => Promise<{ status: number; body: string }>

  constructor(
    deliverFn?: (url: string, payload: string, signature: string) => Promise<{ status: number; body: string }>
  ) {
    // Default deliver function uses fetch
    this.deliverFn = deliverFn || (async (url, payload, signature) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Xorb-Signature': signature,
          'X-Xorb-Timestamp': new Date().toISOString(),
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      })
      const body = await res.text()
      return { status: res.status, body }
    })
  }

  addEndpoint(endpoint: WebhookEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint)
  }

  removeEndpoint(id: string): void {
    this.endpoints.delete(id)
  }

  getEndpoint(id: string): WebhookEndpoint | undefined {
    return this.endpoints.get(id)
  }

  getAllEndpoints(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values())
  }

  getDeliveries(webhookId: string, limit = 50): WebhookDelivery[] {
    return this.deliveries
      .filter(d => d.webhookId === webhookId)
      .slice(-limit)
  }

  /**
   * Deliver an event to all matching webhook endpoints.
   */
  async deliver(event: XorbEvent): Promise<WebhookDelivery[]> {
    const results: WebhookDelivery[] = []

    for (const endpoint of this.endpoints.values()) {
      if (!endpoint.active) continue
      if (!endpoint.eventTypes.includes(event.type) && !endpoint.eventTypes.includes('*')) continue

      const payload = JSON.stringify({
        id: event.id,
        type: event.type,
        created_at: event.timestamp,
        data: event.data,
      })

      const signature = await this.sign(payload, endpoint.secret)

      const delivery: WebhookDelivery = {
        id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        webhookId: endpoint.id,
        eventType: event.type,
        payload: JSON.parse(payload),
        success: false,
        deliveredAt: new Date().toISOString(),
      }

      try {
        const response = await this.deliverFn(endpoint.url, payload, signature)
        delivery.responseStatus = response.status
        delivery.responseBody = response.body.slice(0, 1000) // cap stored body
        delivery.success = response.status >= 200 && response.status < 300

        if (delivery.success) {
          endpoint.failureCount = 0
        } else {
          endpoint.failureCount++
        }
      } catch (err) {
        delivery.responseBody = err instanceof Error ? err.message : 'Delivery failed'
        endpoint.failureCount++
      }

      endpoint.lastDeliveryAt = delivery.deliveredAt

      // Auto-disable after too many failures
      if (endpoint.failureCount >= MAX_FAILURES) {
        endpoint.active = false
      }

      this.deliveries.push(delivery)
      results.push(delivery)
    }

    // Trim delivery log
    if (this.deliveries.length > 10000) {
      this.deliveries.splice(0, this.deliveries.length - 10000)
    }

    return results
  }

  /**
   * HMAC-SHA256 signature for webhook payload.
   */
  private async sign(payload: string, secret: string): Promise<string> {
    // Use Web Crypto API (works in Node 18+, Deno, browsers, Vercel Edge)
    try {
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      // Fallback: simple hash if crypto.subtle unavailable
      let hash = 0
      const str = secret + payload
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
      }
      return `fallback_${Math.abs(hash).toString(16)}`
    }
  }
}
