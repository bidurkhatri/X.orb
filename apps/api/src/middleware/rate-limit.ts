/**
 * Per-second burst rate limiting middleware (A-27: M-15).
 * Uses a simple in-memory sliding window per API key.
 * For production, should be backed by Redis/Upstash for cross-instance consistency.
 */
import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

const BURST_LIMIT = 10 // requests per second per API key
const BURST_WINDOW_MS = 1000

// Simple sliding window counter
const windows = new Map<string, number[]>()

function checkBurst(key: string, limit: number, windowMs: number): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const cutoff = now - windowMs
  let timestamps = windows.get(key) || []

  // Remove expired entries
  timestamps = timestamps.filter(t => t > cutoff)

  if (timestamps.length >= limit) {
    windows.set(key, timestamps)
    return { allowed: false, remaining: 0, resetAt: timestamps[0] + windowMs }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return { allowed: true, remaining: limit - timestamps.length, resetAt: now + windowMs }
}

// Cleanup old entries every 60 seconds
setInterval(() => {
  const cutoff = Date.now() - 60000
  for (const [key, timestamps] of windows) {
    const filtered = timestamps.filter(t => t > cutoff)
    if (filtered.length === 0) windows.delete(key)
    else windows.set(key, filtered)
  }
}, 60000).unref?.()

export function burstRateLimitMiddleware(limit = BURST_LIMIT) {
  return createMiddleware<Env>(async (c, next) => {
    const apiKey = c.req.header('x-api-key') || c.req.header('x-forwarded-for') || 'anonymous'
    const result = checkBurst(apiKey, limit, BURST_WINDOW_MS)

    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString())
    c.header('X-RateLimit-Remaining', result.remaining.toString())
    c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString())

    if (!result.allowed) {
      c.header('Retry-After', '1')
      return c.json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded: ${limit} requests per second. Retry after 1 second.`,
        retry_after: 1,
      }, 429)
    }

    return next()
  })
}
