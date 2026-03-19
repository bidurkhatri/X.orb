import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../app'
import { ok, err } from '../lib/response'

const generateKeySchema = z.object({
  owner_address: z.string().min(10),
  label: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expires_days: z.number().min(1).max(365).optional(),
})

const rotateKeySchema = z.object({
  current_key: z.string().startsWith('xorb_'),
})

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export const authRouter = new Hono<Env>()

// POST /v1/auth/keys — Generate a new API key
authRouter.post('/keys', zValidator('json', generateKeySchema), async (c) => {
  const body = c.req.valid('json')
  const sb = getSupabase()

  // Generate a secure API key
  const rawKey = `xorb_sk_${randomBytes(24).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const expiresAt = body.expires_days
    ? new Date(Date.now() + body.expires_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  if (sb) {
    const { error } = await sb.from('api_keys').insert({
      key_hash: keyHash,
      owner_address: body.owner_address,
      label: body.label,
      scopes: body.scopes || ['agents:read', 'agents:write', 'actions:write', 'reputation:read', 'audit:read'],
      rate_limit_per_minute: 1000,
      is_active: true,
      expires_at: expiresAt,
    })

    if (error) {
      console.error('[Auth] Key creation failed:', error.message)
      return err(c, 'key_creation_failed', 'Failed to create API key. Please try again.', 500)
    }
  }

  // Return the key ONCE — it cannot be retrieved again
  return ok(c, {
    api_key: rawKey,
    key_prefix: rawKey.slice(0, 12) + '...',
    owner_address: body.owner_address,
    label: body.label,
    scopes: body.scopes || ['agents:read', 'agents:write', 'actions:write', 'reputation:read', 'audit:read'],
    expires_at: expiresAt,
    warning: 'Store this key securely. It cannot be retrieved again.',
  }, 201)
})

// POST /v1/auth/keys/rotate — Rotate an existing API key
authRouter.post('/keys/rotate', zValidator('json', rotateKeySchema), async (c) => {
  const { current_key } = c.req.valid('json')
  const sb = getSupabase()
  if (!sb) return err(c, 'service_unavailable', 'Key rotation requires Supabase', 503)

  const currentHash = createHash('sha256').update(current_key).digest('hex')

  // Verify current key exists and is active
  const { data: existing } = await sb
    .from('api_keys')
    .select('owner_address, label, scopes, rate_limit_per_minute')
    .eq('key_hash', currentHash)
    .eq('is_active', true)
    .single()

  if (!existing) {
    return err(c, 'not_found', 'Current key not found or already revoked', 404)
  }

  // Deactivate old key
  await sb.from('api_keys').update({ is_active: false }).eq('key_hash', currentHash)

  // Generate new key
  const newKey = `xorb_sk_${randomBytes(24).toString('hex')}`
  const newHash = createHash('sha256').update(newKey).digest('hex')

  await sb.from('api_keys').insert({
    key_hash: newHash,
    owner_address: existing.owner_address,
    label: existing.label,
    scopes: existing.scopes,
    rate_limit_per_minute: existing.rate_limit_per_minute,
    is_active: true,
  })

  return ok(c, {
    api_key: newKey,
    key_prefix: newKey.slice(0, 12) + '...',
    warning: 'Store this key securely. The previous key has been revoked.',
  }, 201)
})
