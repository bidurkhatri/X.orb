import { createMiddleware } from 'hono/factory'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { Context } from 'hono'
import type { Env } from '../app'
import { getRegistry } from '../services/registry'

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

// Paths that don't require authentication
const PUBLIC_PATHS = ['/v1/health', '/v1/pricing', '/v1/auth', '/v1/agents/']
// Note: /v1/agents/:id/public is a public path — matched via the suffix check below

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.some(p => path.startsWith(p) && p !== '/v1/agents/')) return true
  // /v1/agents/:id/public is public
  if (path.match(/^\/v1\/agents\/[^/]+\/public$/)) return true
  return false
}

export function authMiddleware() {
  return createMiddleware<Env>(async (c, next) => {
    // Skip auth for public paths
    if (isPublicPath(c.req.path)) {
      return next()
    }

    const apiKey = c.req.header('x-api-key')
    if (!apiKey) {
      return c.json({ success: false, error: { code: 'missing_api_key', message: 'Missing x-api-key header' } }, 401)
    }

    if (!apiKey.startsWith('xorb_')) {
      return c.json({ success: false, error: { code: 'invalid_api_key', message: 'Invalid API key format. Keys must start with xorb_' } }, 401)
    }

    // Try Supabase validation first
    const sb = getSupabase()
    if (sb) {
      const keyHash = hashApiKey(apiKey)
      const { data: rawData, error } = await sb
        .from('api_keys')
        .select('owner_address, is_active, scopes, rate_limit_per_minute')
        .eq('key_hash', keyHash)
        .single()

      const data = rawData as { owner_address: string; is_active: boolean; scopes: string[]; rate_limit_per_minute: number } | null

      if (error || !data) {
        return c.json({ success: false, error: { code: 'invalid_api_key', message: 'Invalid API key' } }, 401)
      }

      if (!data.is_active) {
        return c.json({ success: false, error: { code: 'api_key_revoked', message: 'API key has been revoked' } }, 401)
      }

      // Update last_used_at (fire and forget)
      // @ts-expect-error — Supabase client not typed for our schema
      sb.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash).then()

      c.set('sponsorAddress', data.owner_address)
      return next()
    }

    // Fail fast in production if Supabase is not configured
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Supabase configuration missing in production. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.')
      return c.json({ success: false, error: { code: 'service_unavailable', message: 'Service configuration error. Contact support.' } }, 503)
    }

    // Dev mode fallback: accept any xorb_ key when Supabase is not configured
    console.warn('[Auth] WARNING: Using dev mode fallback — accepting any xorb_ key. NOT FOR PRODUCTION.')
    const devHash = hashApiKey(apiKey)
    c.set('sponsorAddress', `0x${devHash.slice(0, 40)}`)
    await next()
  })
}

/**
 * Verify the authenticated sponsor owns the specified agent.
 * Returns null if authorized, or a JSON error Response if not.
 */
export async function authorizeSponsor(c: Context<Env>, agentId: string): Promise<Response | null> {
  const registry = await getRegistry()
  const agent = registry.getAgent(agentId)
  if (!agent) {
    return c.json({ success: false, error: { code: 'not_found', message: 'Agent not found' } }, 404)
  }
  const sponsorAddress = c.get('sponsorAddress')
  if (agent.sponsorAddress.toLowerCase() !== sponsorAddress.toLowerCase()) {
    return c.json({ success: false, error: { code: 'forbidden', message: 'You do not own this agent' } }, 403)
  }
  return null
}
