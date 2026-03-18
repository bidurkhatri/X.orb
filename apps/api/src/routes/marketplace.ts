import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../app'
import { ok, err } from '../lib/response'
import { authorizeSponsor } from '../middleware/auth'
import {
  createListing,
  getListings,
  getListing,
  updateListingStatus,
  createEngagement,
  getEngagement,
  updateEngagement,
  type MarketplaceListing,
  type MarketplaceEngagement,
} from '../adapters/supabase-services'

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

export const marketplaceRouter = new Hono<Env>()

// POST /v1/marketplace/listings — List agent for hire
marketplaceRouter.post('/listings', zValidator('json', createListingSchema), async (c) => {
  const body = c.req.valid('json')
  const authErr = await authorizeSponsor(c, body.agent_id)
  if (authErr) return authErr

  const id = `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const listing: MarketplaceListing = {
    id,
    agent_id: body.agent_id,
    owner_address: c.get('sponsorAddress'),
    rate_usdc_per_hour: body.rate_usdc_per_hour,
    rate_usdc_per_action: body.rate_usdc_per_action,
    description: body.description,
    status: 'available',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await createListing(listing)
  return ok(c, listing, 201)
})

// GET /v1/marketplace/listings — Browse agents
marketplaceRouter.get('/listings', async (c) => {
  const listings = await getListings()
  return ok(c, { listings, count: listings.length })
})

// GET /v1/marketplace/listings/:id — Get listing
marketplaceRouter.get('/listings/:id', async (c) => {
  const listing = await getListing(c.req.param('id'))
  if (!listing) return err(c, 'not_found', 'Listing not found', 404)
  return ok(c, listing)
})

// POST /v1/marketplace/hire — Hire agent
marketplaceRouter.post('/hire', zValidator('json', hireSchema), async (c) => {
  const body = c.req.valid('json')
  const listing = await getListing(body.listing_id)
  if (!listing) return err(c, 'not_found', 'Listing not found', 404)
  if (listing.status !== 'available') return err(c, 'listing_unavailable', 'Listing not available', 409)

  const id = `eng_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const engagement: MarketplaceEngagement = {
    id,
    listing_id: body.listing_id,
    hirer_address: c.get('sponsorAddress'),
    escrow_amount_usdc: body.escrow_amount_usdc,
    status: 'active',
    started_at: new Date().toISOString(),
  }
  await createEngagement(engagement)
  await updateListingStatus(body.listing_id, 'hired')
  return ok(c, engagement, 201)
})

// POST /v1/marketplace/complete — Complete engagement
marketplaceRouter.post('/complete', async (c) => {
  const body = await c.req.json<{ engagement_id: string }>()
  const engagement = await getEngagement(body.engagement_id)
  if (!engagement) return err(c, 'not_found', 'Engagement not found', 404)
  await updateEngagement(body.engagement_id, { status: 'completed', ended_at: new Date().toISOString() })
  return ok(c, { ...engagement, status: 'completed' })
})

// POST /v1/marketplace/dispute — Open dispute
marketplaceRouter.post('/dispute', async (c) => {
  const body = await c.req.json<{ engagement_id: string; reason: string }>()
  const engagement = await getEngagement(body.engagement_id)
  if (!engagement) return err(c, 'not_found', 'Engagement not found', 404)
  await updateEngagement(body.engagement_id, { status: 'disputed' })
  return ok(c, { ...engagement, status: 'disputed' })
})

// POST /v1/marketplace/rate — Rate engagement
marketplaceRouter.post('/rate', async (c) => {
  const body = await c.req.json<{ engagement_id: string; rating: number; feedback?: string }>()
  const engagement = await getEngagement(body.engagement_id)
  if (!engagement) return err(c, 'not_found', 'Engagement not found', 404)
  if (engagement.status !== 'completed') return err(c, 'invalid_status', 'Can only rate completed engagements', 400)
  await updateEngagement(body.engagement_id, { rating: body.rating, feedback: body.feedback })
  return ok(c, { engagement_id: body.engagement_id, rating: body.rating, feedback: body.feedback })
})
