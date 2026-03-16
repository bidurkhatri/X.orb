import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'

const createListingSchema = z.object({
  agent_id: z.string(),
  rate_usdc_per_hour: z.number().optional(),
  rate_usdc_per_action: z.number().optional(),
  description: z.string().max(500),
})

const hireSchema = z.object({
  listing_id: z.string(),
  escrow_amount_usdc: z.number().min(1),
})

// In-memory store (replaced by Supabase in production)
interface Listing {
  id: string
  agent_id: string
  rate_usdc_per_hour?: number
  rate_usdc_per_action?: number
  description: string
  available: boolean
  created_at: string
}

interface Engagement {
  id: string
  listing_id: string
  escrow_amount_usdc: number
  status: string
  started_at: string
}

const listings = new Map<string, Listing>()
const engagements = new Map<string, Engagement>()

export const marketplaceRouter = new Hono<Env>()

// POST /v1/marketplace/listings — List agent for hire
marketplaceRouter.post('/listings', zValidator('json', createListingSchema), async (c) => {
  const body = c.req.valid('json')
  const id = `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const listing: Listing = {
    id,
    agent_id: body.agent_id,
    rate_usdc_per_hour: body.rate_usdc_per_hour,
    rate_usdc_per_action: body.rate_usdc_per_action,
    description: body.description,
    available: true,
    created_at: new Date().toISOString(),
  }
  listings.set(id, listing)
  return c.json(listing, 201)
})

// GET /v1/marketplace/listings — Browse agents
marketplaceRouter.get('/listings', async (c) => {
  const all = Array.from(listings.values())
  return c.json({ listings: all, count: all.length })
})

// GET /v1/marketplace/listings/:id — Get listing
marketplaceRouter.get('/listings/:id', async (c) => {
  const listing = listings.get(c.req.param('id'))
  if (!listing) return c.json({ error: 'Listing not found' }, 404)
  return c.json(listing)
})

// POST /v1/marketplace/hire — Hire agent
marketplaceRouter.post('/hire', zValidator('json', hireSchema), async (c) => {
  const body = c.req.valid('json')
  const listing = listings.get(body.listing_id)
  if (!listing) return c.json({ error: 'Listing not found' }, 404)
  if (!listing.available) return c.json({ error: 'Listing not available' }, 409)

  const id = `eng_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const engagement: Engagement = {
    id,
    listing_id: body.listing_id,
    escrow_amount_usdc: body.escrow_amount_usdc,
    status: 'active',
    started_at: new Date().toISOString(),
  }
  engagements.set(id, engagement)
  return c.json(engagement, 201)
})

// POST /v1/marketplace/complete — Complete engagement
marketplaceRouter.post('/complete', async (c) => {
  const body = await c.req.json<{ engagement_id: string }>()
  const engagement = engagements.get(body.engagement_id)
  if (!engagement) return c.json({ error: 'Engagement not found' }, 404)
  engagement.status = 'completed'
  return c.json(engagement)
})

// POST /v1/marketplace/dispute — Open dispute
marketplaceRouter.post('/dispute', async (c) => {
  const body = await c.req.json<{ engagement_id: string; reason: string }>()
  const engagement = engagements.get(body.engagement_id)
  if (!engagement) return c.json({ error: 'Engagement not found' }, 404)
  engagement.status = 'disputed'
  return c.json(engagement)
})

// POST /v1/marketplace/rate — Rate engagement
marketplaceRouter.post('/rate', async (c) => {
  const body = await c.req.json<{ engagement_id: string; rating: number; feedback?: string }>()
  const engagement = engagements.get(body.engagement_id)
  if (!engagement) return c.json({ error: 'Engagement not found' }, 404)
  if (engagement.status !== 'completed') return c.json({ error: 'Can only rate completed engagements' }, 400)
  return c.json({ engagement_id: body.engagement_id, rating: body.rating, feedback: body.feedback })
})
