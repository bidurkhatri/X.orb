import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { agentsRouter } from './routes/agents'
import { actionsRouter } from './routes/actions'
import { reputationRouter } from './routes/reputation'
import { healthRouter } from './routes/health'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { requestId } from './middleware/request-id'

export type Env = {
  Variables: {
    requestId: string
    sponsorAddress: string
  }
}

const app = new Hono<Env>()

// Global middleware
app.use('*', cors())
app.use('*', logger())
app.use('*', requestId())
app.use('*', errorHandler())

// Public routes
app.route('/v1/health', healthRouter)

// Authenticated routes
app.use('/v1/*', authMiddleware())
app.route('/v1/agents', agentsRouter)
app.route('/v1/actions', actionsRouter)
app.route('/v1/reputation', reputationRouter)

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404))

export { app }
