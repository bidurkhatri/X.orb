import { createMiddleware } from 'hono/factory'
import { v4 as uuidv4 } from 'uuid'
import type { Env } from '../app'

export function requestId() {
  return createMiddleware<Env>(async (c, next) => {
    const id = c.req.header('x-request-id') || uuidv4()
    c.set('requestId', id)
    c.header('x-request-id', id)
    await next()
  })
}
