import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

export function authMiddleware() {
  return createMiddleware<Env>(async (c, next) => {
    const apiKey = c.req.header('x-api-key')
    if (!apiKey) {
      return c.json({ error: 'Missing x-api-key header' }, 401)
    }

    // TODO: Validate against api_keys table in Supabase
    // For now, accept any key that starts with 'xorb_'
    if (!apiKey.startsWith('xorb_')) {
      return c.json({ error: 'Invalid API key format' }, 401)
    }

    // Extract sponsor address from API key (placeholder)
    c.set('sponsorAddress', '0x0000000000000000000000000000000000000000')
    await next()
  })
}
