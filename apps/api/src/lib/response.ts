/**
 * Standard API response envelope.
 *
 * Every endpoint returns:
 *   { success: true, data: T, pagination?: { next_cursor, has_more } }
 *   { success: false, error: { code, message } }
 */
import type { Context } from 'hono'
import type { Env } from '../app'

export function ok<T>(c: Context<Env>, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status)
}

export function okPaginated<T>(c: Context<Env>, data: T[], pagination: { next_cursor?: string; has_more: boolean }) {
  return c.json({ success: true, data, pagination })
}

export function err(c: Context<Env>, code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 = 400) {
  return c.json({ success: false, error: { code, message } }, status)
}
