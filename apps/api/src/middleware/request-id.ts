import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

export function requestId() {
  return createMiddleware<Env>(async (c, next) => {
    const id = c.req.header('x-request-id') || crypto.randomUUID()
    c.set('requestId', id)
    c.header('x-request-id', id)
    await next()
  })
}
