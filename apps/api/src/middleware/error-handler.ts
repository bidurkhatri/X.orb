import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

async function reportToSentry(dsn: string, error: Error, extra: Record<string, unknown>) {
  try {
    const url = new URL(dsn)
    const projectId = url.pathname.replace('/', '')
    const envelopeUrl = `https://${url.hostname}/api/${projectId}/envelope/`
    const header = JSON.stringify({ dsn, sent_at: new Date().toISOString() })
    const itemHeader = JSON.stringify({ type: 'event' })
    const payload = JSON.stringify({
      exception: { values: [{ type: error.name, value: error.message, stacktrace: { frames: [] } }] },
      extra,
      timestamp: Date.now() / 1000,
      platform: 'node',
    })
    await fetch(envelopeUrl, {
      method: 'POST',
      body: `${header}\n${itemHeader}\n${payload}`,
    }).catch(() => {})
  } catch {
    // Sentry reporting is best-effort
  }
}

export function errorHandler() {
  return createMiddleware<Env>(async (c, next) => {
    try {
      await next()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      const stack = err instanceof Error ? err.stack : undefined
      const status = message.includes('not found') ? 404
        : message.includes('sponsor') || message.includes('Only') ? 403
        : message.includes('Invalid') || message.includes('must be') ? 400
        : 500

      // Structured error logging
      const errorLog = {
        level: 'error',
        timestamp: new Date().toISOString(),
        request_id: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status,
        error: message,
        stack: status === 500 ? stack : undefined,
      }
      console.error(JSON.stringify(errorLog))

      // Report 5xx errors to Sentry if configured
      const sentryDsn = process.env.SENTRY_DSN
      if (sentryDsn && status === 500 && err instanceof Error) {
        reportToSentry(sentryDsn, err, { request_id: c.get('requestId'), method: c.req.method, path: c.req.path })
      }

      return c.json({
        error: message,
        request_id: c.get('requestId'),
      }, status as any)
    }
  })
}
