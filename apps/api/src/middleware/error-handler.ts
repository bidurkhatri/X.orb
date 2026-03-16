import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

export function errorHandler() {
  return createMiddleware<Env>(async (c, next) => {
    try {
      await next()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      const status = message.includes('not found') ? 404
        : message.includes('sponsor') || message.includes('Only') ? 403
        : message.includes('Invalid') || message.includes('must be') ? 400
        : 500
      return c.json({
        error: message,
        request_id: c.get('requestId'),
      }, status as any)
    }
  })
}
