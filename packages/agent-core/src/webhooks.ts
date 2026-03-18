import type { XorbEvent } from './events'

/**
 * Validate a webhook URL for SSRF protection.
 * Only allows HTTPS URLs to public IP ranges.
 */
export function validateWebhookUrl(urlString: string): { valid: boolean; reason?: string } {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }

  // Only allow HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: `Scheme "${parsed.protocol}" not allowed. Only HTTPS is permitted.` }
  }

  // Block IP-based hostnames (prevent private range / metadata access)
  const hostname = parsed.hostname
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number)
    // Block loopback (127.x.x.x)
    if (a === 127) return { valid: false, reason: 'Loopback addresses are blocked' }
    // Block private 10.x.x.x
    if (a === 10) return { valid: false, reason: 'Private network addresses are blocked' }
    // Block private 172.16-31.x.x
    if (a === 172 && b >= 16 && b <= 31) return { valid: false, reason: 'Private network addresses are blocked' }
    // Block private 192.168.x.x
    if (a === 192 && b === 168) return { valid: false, reason: 'Private network addresses are blocked' }
    // Block link-local 169.254.x.x (AWS metadata etc.)
    if (a === 169 && b === 254) return { valid: false, reason: 'Link-local addresses are blocked' }
    // Block 0.x.x.x
    if (a === 0) return { valid: false, reason: 'Invalid address range' }
  }

  // Block IPv6 loopback and private
  if (hostname === '[::1]' || hostname === '[::0]' || hostname.startsWith('[fc') || hostname.startsWith('[fd') || hostname.startsWith('[fe80')) {
    return { valid: false, reason: 'IPv6 private/loopback addresses are blocked' }
  }

  // Block localhost variants
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { valid: false, reason: 'Localhost is blocked' }
  }

  // Block common metadata endpoints
  if (hostname === 'metadata.google.internal' || hostname === 'metadata.google.com') {
    return { valid: false, reason: 'Cloud metadata endpoints are blocked' }
  }

  return { valid: true }
}

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
    const urlCheck = validateWebhookUrl(endpoint.url)
    if (!urlCheck.valid) {
      throw new Error(`Invalid webhook URL: ${urlCheck.reason}`)
    }
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
      // Fallback: use node:crypto HMAC when crypto.subtle is unavailable
      const { createHmac } = await import('node:crypto')
      return createHmac('sha256', secret).update(payload).digest('hex')
    }
  }
}
