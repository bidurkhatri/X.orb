import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../app'
import { ok } from '../lib/response'

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export const settingsRouter = new Hono<Env>()

// PUT /v1/settings/notifications — Save notification preferences
settingsRouter.put('/notifications', async (c) => {
  const prefs = await c.req.json().catch(() => ({}))
  const wallet = c.get('sponsorAddress')?.toLowerCase()
  const sb = getSupabase()

  if (wallet && sb) {
    await sb.from('sponsor_profiles').upsert({
      sponsor_address: wallet,
      notification_prefs: prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'sponsor_address' })
  }

  return ok(c, { saved: true, preferences: prefs })
})

// GET /v1/settings/notifications — Get notification preferences
settingsRouter.get('/notifications', async (c) => {
  const wallet = c.get('sponsorAddress')?.toLowerCase()
  const sb = getSupabase()
  let prefs = {
    slashing: true,
    reputation_warning: true,
    api_key_expiring: true,
    payment_receipt: true,
    free_tier_warning: true,
  }

  if (wallet && sb) {
    const { data } = await sb.from('sponsor_profiles')
      .select('notification_prefs')
      .eq('sponsor_address', wallet)
      .maybeSingle()
    if (data?.notification_prefs) prefs = data.notification_prefs
  }

  return ok(c, prefs)
})
