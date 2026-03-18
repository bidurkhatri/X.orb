/**
 * Supabase-backed persistent services.
 * Replaces all in-memory Maps/singletons for Vercel Serverless compatibility.
 *
 * Covers: rate limits, marketplace, reputation history, platform events,
 * webhook subscriptions, platform config, payment nonces.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (url && key) {
      client = createClient(url, key)
    }
  }
  return client
}

// ============================================================
// Rate Limiting (replaces in-memory Map in gates.ts)
// ============================================================

export async function checkAndIncrementRateLimit(
  key: string,
  limit: number,
  windowMs: number = 3600000,
): Promise<{ allowed: boolean; count: number; resetAt: number }> {
  const sb = getSupabaseClient()
  if (!sb) {
    // Dev fallback: always allow
    return { allowed: true, count: 0, resetAt: Date.now() + windowMs }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowMs)

  // Upsert: if window expired, reset; otherwise increment
  const { data, error } = await sb.rpc('increment_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_ms: windowMs,
  })

  if (error) {
    // If RPC doesn't exist yet, fall back to manual query
    return await checkRateLimitManual(sb, key, limit, windowMs)
  }

  return data as { allowed: boolean; count: number; resetAt: number }
}

async function checkRateLimitManual(
  sb: SupabaseClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; count: number; resetAt: number }> {
  const now = new Date()

  // Try to get existing record
  const { data: existing } = await sb
    .from('rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .single()

  if (existing) {
    const windowStart = new Date(existing.window_start)
    const windowEnd = new Date(windowStart.getTime() + windowMs)

    if (now > windowEnd) {
      // Window expired, reset
      await sb.from('rate_limits').upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_duration_ms: windowMs,
        updated_at: now.toISOString(),
      }, { onConflict: 'key' })
      return { allowed: true, count: 1, resetAt: now.getTime() + windowMs }
    }

    if (existing.count >= limit) {
      return { allowed: false, count: existing.count, resetAt: windowEnd.getTime() }
    }

    // Increment
    await sb.from('rate_limits')
      .update({ count: existing.count + 1, updated_at: now.toISOString() })
      .eq('key', key)

    return { allowed: true, count: existing.count + 1, resetAt: windowEnd.getTime() }
  }

  // New record
  await sb.from('rate_limits').insert({
    key,
    count: 1,
    window_start: now.toISOString(),
    window_duration_ms: windowMs,
    updated_at: now.toISOString(),
  })

  return { allowed: true, count: 1, resetAt: now.getTime() + windowMs }
}

// ============================================================
// Marketplace Persistence
// ============================================================

export interface MarketplaceListing {
  id: string
  agent_id: string
  owner_address: string
  description: string
  rate_usdc_per_hour?: number
  rate_usdc_per_action?: number
  status: string
  created_at: string
  updated_at: string
}

export interface MarketplaceEngagement {
  id: string
  listing_id: string
  hirer_address: string
  escrow_amount_usdc: number
  status: string
  rating?: number
  feedback?: string
  started_at: string
  ended_at?: string
}

export async function createListing(listing: MarketplaceListing): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('marketplace_listings').insert(listing)
  if (error) console.error('[Marketplace] createListing failed:', error.message)
}

export async function getListings(): Promise<MarketplaceListing[]> {
  const sb = getSupabaseClient()
  if (!sb) return []
  const { data, error } = await sb
    .from('marketplace_listings')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Marketplace] getListings failed:', error.message); return [] }
  return (data || []) as MarketplaceListing[]
}

export async function getListing(id: string): Promise<MarketplaceListing | null> {
  const sb = getSupabaseClient()
  if (!sb) return null
  const { data, error } = await sb
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as MarketplaceListing
}

export async function updateListingStatus(id: string, status: string): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.from('marketplace_listings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function createEngagement(engagement: MarketplaceEngagement): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('marketplace_engagements').insert(engagement)
  if (error) console.error('[Marketplace] createEngagement failed:', error.message)
}

export async function getEngagement(id: string): Promise<MarketplaceEngagement | null> {
  const sb = getSupabaseClient()
  if (!sb) return null
  const { data } = await sb.from('marketplace_engagements').select('*').eq('id', id).single()
  return data as MarketplaceEngagement | null
}

export async function updateEngagement(id: string, updates: Partial<MarketplaceEngagement>): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.from('marketplace_engagements').update(updates).eq('id', id)
}

// ============================================================
// Reputation History Persistence
// ============================================================

export interface ReputationRecord {
  agent_id: string
  event_type: string
  delta: number
  score_before: number
  score_after: number
  streak_count: number
  tier_before?: string
  tier_after?: string
  action_id?: string
}

export async function insertReputationRecord(record: ReputationRecord): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('reputation_history').insert(record)
  if (error) console.error('[Reputation] insertRecord failed:', error.message)
}

export async function getReputationHistory(agentId: string, limit = 50): Promise<ReputationRecord[]> {
  const sb = getSupabaseClient()
  if (!sb) return []
  const { data } = await sb
    .from('reputation_history')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data || []) as ReputationRecord[]
}

// ============================================================
// Platform Events Persistence
// ============================================================

export interface PlatformEvent {
  event_id: string
  agent_id?: string
  event_type: string
  payload: unknown
}

export async function insertPlatformEvent(event: PlatformEvent): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('platform_events').insert(event)
  if (error) console.error('[Events] insertEvent failed:', error.message)
}

export async function getPlatformEvents(opts: {
  agentId?: string
  eventType?: string
  since?: string
  limit?: number
  cursor?: number  // last event ID for cursor-based pagination
}): Promise<Array<PlatformEvent & { id: number; created_at: string }>> {
  const sb = getSupabaseClient()
  if (!sb) return []

  let query = sb
    .from('platform_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit || 100)

  if (opts.agentId) query = query.eq('agent_id', opts.agentId)
  if (opts.eventType) query = query.eq('event_type', opts.eventType)
  if (opts.since) query = query.gte('created_at', opts.since)
  if (opts.cursor) query = query.lt('id', opts.cursor)

  const { data, error } = await query
  if (error) { console.error('[Events] getPlatformEvents failed:', error.message); return [] }
  return (data || []) as Array<PlatformEvent & { id: number; created_at: string }>
}

// ============================================================
// Webhook Subscriptions Persistence
// ============================================================

export async function createWebhookSubscription(sub: {
  id: string
  url: string
  event_types: string[]
  secret: string
  sponsor_address: string
  api_key_id?: string
}): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('webhook_endpoints').insert({
    id: sub.id,
    url: sub.url,
    event_types: sub.event_types,
    secret: sub.secret,
    sponsor_address: sub.sponsor_address,
    api_key_id: sub.api_key_id || null,
    is_active: true,
    failure_count: 0,
  })
  if (error) console.error('[Webhooks] createSubscription failed:', error.message)
}

export async function getWebhookSubscriptions(sponsorAddress?: string): Promise<any[]> {
  const sb = getSupabaseClient()
  if (!sb) return []
  let query = sb.from('webhook_endpoints').select('*').eq('is_active', true)
  if (sponsorAddress) query = query.eq('sponsor_address', sponsorAddress)
  const { data } = await query
  return data || []
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.from('webhook_endpoints').delete().eq('id', id)
}

export async function updateWebhookFailureCount(id: string, count: number, active: boolean): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.from('webhook_endpoints').update({
    failure_count: count,
    is_active: active,
    last_delivery_at: new Date().toISOString(),
  }).eq('id', id)
}

export async function insertWebhookDelivery(delivery: {
  webhook_id: string
  event_type: string
  payload: unknown
  response_status?: number
  response_body?: string
  success: boolean
}): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  await sb.from('webhook_deliveries').insert({
    ...delivery,
    delivered_at: new Date().toISOString(),
  })
}

// ============================================================
// Platform Config
// ============================================================

const configCache = new Map<string, { value: unknown; cachedAt: number }>()
const CONFIG_TTL_MS = 5 * 60 * 1000 // 5 min cache

export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  // Check cache
  const cached = configCache.get(key)
  if (cached && Date.now() - cached.cachedAt < CONFIG_TTL_MS) {
    return cached.value as T
  }

  const sb = getSupabaseClient()
  if (!sb) return defaultValue

  const { data } = await sb
    .from('platform_config')
    .select('value')
    .eq('key', key)
    .single()

  if (!data) return defaultValue

  const value = data.value as T
  configCache.set(key, { value, cachedAt: Date.now() })
  return value
}

// ============================================================
// Slashing Records Persistence
// ============================================================

export async function insertSlashingRecord(record: {
  agent_id: string
  violation_type: string
  severity: string
  bond_before: string
  bond_slashed: string
  bond_after: string
  action_taken: string
  action_id?: string
}): Promise<void> {
  const sb = getSupabaseClient()
  if (!sb) return
  const { error } = await sb.from('slash_records').insert({
    agent_id: record.agent_id,
    violation_type: record.violation_type,
    slash_amount: record.bond_slashed,
    reputation_penalty: 0,
    evidence: record.action_id || '',
    auto_revoked: record.action_taken === 'revoke',
  })
  if (error) console.error('[Slashing] insertRecord failed:', error.message)
}

export async function getSlashingRecords(agentId: string): Promise<any[]> {
  const sb = getSupabaseClient()
  if (!sb) return []
  const { data } = await sb
    .from('slash_records')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
  return data || []
}
