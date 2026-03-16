import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { Env } from '../app'

let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (url && key) {
      supabaseClient = createClient(url, key)
    }
  }
  return supabaseClient
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export function authMiddleware() {
  return createMiddleware<Env>(async (c, next) => {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) {
      return c.json({ error: 'Missing x-api-key header' }, 401)
    }

    if (!apiKey.startsWith('xorb_')) {
      return c.json({ error: 'Invalid API key format. Keys must start with xorb_' }, 401)
    }

    // Try Supabase validation first
    const sb = getSupabase()
    if (sb) {
      const keyHash = hashApiKey(apiKey)
      const { data, error } = await sb
        .from('api_keys')
        .select('owner_address, is_active, scopes, rate_limit_per_minute')
        .eq('key_hash', keyHash)
        .single()

      if (error || !data) {
        return c.json({ error: 'Invalid API key' }, 401)
      }

      if (!data.is_active) {
        return c.json({ error: 'API key has been revoked' }, 401)
      }

      // Update last_used_at (fire and forget)
      sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash).then()

      c.set('sponsorAddress', data.owner_address)
      return next()
    }

    // Dev mode fallback: accept any xorb_ key when Supabase is not configured
    // Extract a deterministic address from the key for dev consistency
    const devHash = hashApiKey(apiKey)
    c.set('sponsorAddress', `0x${devHash.slice(0, 40)}`)
    await next()
  })
}
