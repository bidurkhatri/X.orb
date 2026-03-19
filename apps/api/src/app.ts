import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { agentsRouter } from './routes/agents'
import { actionsRouter } from './routes/actions'
import { reputationRouter } from './routes/reputation'
import { healthRouter } from './routes/health'
import { webhooksRouter } from './routes/webhooks'
import { eventsRouter } from './routes/events'
import { auditRouter } from './routes/audit'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { requestId } from './middleware/request-id'
import { x402Middleware, getPricing } from './middleware/x402'
import { marketplaceRouter } from './routes/marketplace'
import { complianceRouter } from './routes/compliance'
import { cronRouter } from './routes/cron'
import { authRouter } from './routes/auth'
import { exportRouter } from './routes/export'
import { revenueRouter } from './routes/revenue'
import { settingsRouter } from './routes/settings'
import { burstRateLimitMiddleware } from './middleware/rate-limit'

export type Env = {
  Variables: {
    requestId: string
    sponsorAddress: string
    paymentContext?: {
      paymentId: string
      grossAmount: bigint
      feeAmount: bigint
      netAmount: bigint
      collectTxHash: string
      payerAddress: string
      freeActionsRemaining: number
      feeExempt: boolean
    }
  }
}

const app = new Hono<Env>()

// Global middleware
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://dashboard.xorb.xyz,http://localhost:5173,http://localhost:3000').split(',')
    if (!origin) return allowedOrigins[0] // Non-browser requests
    return allowedOrigins.includes(origin) ? origin : null
  },
  credentials: true,
}))
app.use('*', logger())
app.use('*', requestId())
app.use('*', errorHandler())
app.use('*', burstRateLimitMiddleware(10)) // 10 req/sec per key

// Public routes (before auth)
app.route('/v1/health', healthRouter)

// Pricing info (public)
app.get('/v1/pricing', (c) => c.json({ endpoints: getPricing(), free_tier: { limit: 500, period: 'monthly' } }))

// Authenticated routes: auth FIRST, then x402 payment processing
app.use('/v1/*', authMiddleware())
app.use('/v1/*', x402Middleware())
app.route('/v1/settings', settingsRouter)
app.route('/v1/agents', agentsRouter)
app.route('/v1/actions', actionsRouter)
app.route('/v1/reputation', reputationRouter)
app.route('/v1/webhooks', webhooksRouter)
app.route('/v1/events', eventsRouter)
app.route('/v1/audit', auditRouter)
app.route('/v1/marketplace', marketplaceRouter)
app.route('/v1/compliance', complianceRouter)
app.route('/v1/cron', cronRouter)
app.route('/v1/auth', authRouter)
app.route('/v1/export', exportRouter)
app.route('/v1/revenue', revenueRouter)
app.route('/v1/payments', revenueRouter)
app.route('/v1/billing', revenueRouter)

// 404
app.notFound((c) => c.json({ success: false, error: { code: 'not_found', message: `Not found: ${c.req.path}` } }, 404))

export { app }
