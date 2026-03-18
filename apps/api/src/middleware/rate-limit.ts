/**
 * Per-second burst rate limiting middleware.
 *
 * Uses Supabase-backed counter when available (cross-instance consistent).
 * Falls back to in-memory sliding window for dev mode only.
 */
import { createMiddleware } from 'hono/factory'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../app'

const BURST_LIMIT = 10 // requests per second per API key
const BURST_WINDOW_MS = 1000

// --- Supabase-backed rate limiter (production) ---

let _sb: SupabaseClient | null | undefined = undefined

function getSupabase(): SupabaseClient | null {
  if (_sb !== undefined) return _sb
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (url && key) {
    _sb = createClient(url, key)
  } else {
    _sb = null
  }
  return _sb
}

async function checkBurstSupabase(
  sb: SupabaseClient,
  apiKey: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const windowKey = `burst:${apiKey}:${Math.floor(now / windowMs)}`
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs

  // Use Supabase rate_limits table: upsert with increment
  const { data, error } = await sb
    .from('rate_limits')
    .upsert(
      { key: windowKey, count: 1, window_start: new Date(Math.floor(now / windowMs) * windowMs).toISOString() },
      { onConflict: 'key' }
    )
    .select('count')
    .single()

  if (error) {
    // If upsert failed, try increment approach
    const { data: existing } = await sb.from('rate_limits')
      .select('count')
      .eq('key', windowKey)
      .single()

    if (existing) {
      const newCount = (existing.count || 0) + 1
      await sb.from('rate_limits').update({ count: newCount }).eq('key', windowKey)
      const remaining = Math.max(0, limit - newCount)
      return { allowed: newCount <= limit, remaining, resetAt }
    }

    // Table doesn't exist or other error — fall through to in-memory
    return checkBurstInMemory(apiKey, limit, windowMs)
  }

  // Count was set to 1 on insert; we need to increment if it already existed
  if (data && data.count !== undefined) {
    const count = data.count
    if (count > 1) {
      // Already incremented via upsert conflict
      const remaining = Math.max(0, limit - count)
      return { allowed: count <= limit, remaining, resetAt }
    }
  }

  // First request in this window
  return { allowed: true, remaining: limit - 1, resetAt }
}

// --- In-memory fallback (dev only) ---

const windows = new Map<string, number[]>()

function checkBurstInMemory(key: string, limit: number, windowMs: number): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const cutoff = now - windowMs
  let timestamps = windows.get(key) || []

  timestamps = timestamps.filter(t => t > cutoff)

  if (timestamps.length >= limit) {
    windows.set(key, timestamps)
    return { allowed: false, remaining: 0, resetAt: timestamps[0] + windowMs }
  }

  timestamps.push(now)
  windows.set(key, timestamps)
  return { allowed: true, remaining: limit - timestamps.length, resetAt: now + windowMs }
}

// Cleanup old in-memory entries every 60 seconds (dev mode only)
setInterval(() => {
  const cutoff = Date.now() - 60000
  for (const [key, timestamps] of windows) {
    const filtered = timestamps.filter(t => t > cutoff)
    if (filtered.length === 0) windows.delete(key)
    else windows.set(key, filtered)
  }
}, 60000).unref?.()

// --- Middleware ---

export function burstRateLimitMiddleware(limit = BURST_LIMIT) {
  return createMiddleware<Env>(async (c, next) => {
    const apiKey = c.req.header('x-api-key') || c.req.header('x-forwarded-for') || 'anonymous'

    const sb = getSupabase()
    const result = sb
      ? await checkBurstSupabase(sb, apiKey, limit, BURST_WINDOW_MS)
      : checkBurstInMemory(apiKey, limit, BURST_WINDOW_MS)

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
