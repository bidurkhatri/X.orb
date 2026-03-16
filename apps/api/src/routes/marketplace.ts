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

export const marketplaceRouter = new Hono<Env>()

// POST /v1/marketplace/listings — List agent for hire
marketplaceRouter.post('/listings', zValidator('json', createListingSchema), async (c) => {
  const body = c.req.valid('json')
  const id = `lst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return c.json({
    id,
    agent_id: body.agent_id,
    rate_usdc_per_hour: body.rate_usdc_per_hour,
    rate_usdc_per_action: body.rate_usdc_per_action,
    description: body.description,
    available: true,
    created_at: new Date().toISOString(),
  }, 201)
})

// GET /v1/marketplace/listings — Browse agents
marketplaceRouter.get('/listings', async (c) => {
  return c.json({ listings: [], count: 0 })
})

// GET /v1/marketplace/listings/:id — Get listing
marketplaceRouter.get('/listings/:id', async (c) => {
  return c.json({ error: 'Listing not found' }, 404)
})

// POST /v1/marketplace/hire — Hire agent
marketplaceRouter.post('/hire', zValidator('json', hireSchema), async (c) => {
  const body = c.req.valid('json')
  const id = `eng_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return c.json({
    engagement_id: id,
    listing_id: body.listing_id,
    escrow_amount_usdc: body.escrow_amount_usdc,
    status: 'active',
    started_at: new Date().toISOString(),
  }, 201)
})

// POST /v1/marketplace/complete — Complete engagement
marketplaceRouter.post('/complete', async (c) => {
  return c.json({ error: 'Not yet implemented' }, 501)
})

// POST /v1/marketplace/dispute — Open dispute
marketplaceRouter.post('/dispute', async (c) => {
  return c.json({ error: 'Not yet implemented' }, 501)
})

// POST /v1/marketplace/rate — Rate engagement
marketplaceRouter.post('/rate', async (c) => {
  return c.json({ error: 'Not yet implemented' }, 501)
})
