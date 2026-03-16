import { Hono } from 'hono'

export const healthRouter = new Hono()

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'xorb-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})
