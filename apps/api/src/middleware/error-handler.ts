import { createMiddleware } from 'hono/factory'
import type { Env } from '../app'

// Typed error classes for consistent HTTP status mapping
export class AuthError extends Error {
  readonly statusCode = 401
  constructor(message: string) { super(message); this.name = 'AuthError' }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403
  constructor(message: string) { super(message); this.name = 'ForbiddenError' }
}

export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(message: string) { super(message); this.name = 'NotFoundError' }
}

export class ValidationError extends Error {
  readonly statusCode = 400
  constructor(message: string) { super(message); this.name = 'ValidationError' }
}

export class RateLimitError extends Error {
  readonly statusCode = 429
  constructor(message: string) { super(message); this.name = 'RateLimitError' }
}

export class PaymentError extends Error {
  readonly statusCode = 402
  constructor(message: string) { super(message); this.name = 'PaymentError' }
}

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
    }).catch((e) => console.error('[Sentry] Report failed:', e.message))
  } catch {
    // Sentry reporting is best-effort
  }
}

function getStatusCode(err: unknown): number {
  // Use typed error classes instead of fuzzy string matching
  if (err instanceof AuthError) return 401
  if (err instanceof ForbiddenError) return 403
  if (err instanceof NotFoundError) return 404
  if (err instanceof ValidationError) return 400
  if (err instanceof RateLimitError) return 429
  if (err instanceof PaymentError) return 402
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode
  }
  return 500
}

export function errorHandler() {
  return createMiddleware<Env>(async (c, next) => {
    try {
      await next()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      const status = getStatusCode(err)

      // Structured error logging
      const errorLog = {
        level: 'error',
        timestamp: new Date().toISOString(),
        request_id: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status,
        error: message,
        // Never leak stack traces or internal details to clients
        stack: status === 500 && err instanceof Error ? err.stack : undefined,
      }
      console.error(JSON.stringify(errorLog))

      // Report 5xx errors to Sentry if configured
      const sentryDsn = process.env.SENTRY_DSN
      if (sentryDsn && status >= 500 && err instanceof Error) {
        reportToSentry(sentryDsn, err, { request_id: c.get('requestId'), method: c.req.method, path: c.req.path })
      }

      // Safe error message for clients: hide internal details on 500s
      const clientMessage = status === 500 ? 'Internal server error' : message

      const errorCode = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden'
        : status === 404 ? 'not_found' : status === 429 ? 'rate_limit_exceeded'
        : status === 400 ? 'validation_error' : 'internal_error'

      return c.json({
        success: false,
        error: { code: errorCode, message: clientMessage },
        request_id: c.get('requestId'),
      }, status as Parameters<typeof c.json>[1])
    }
  })
}
