/**
 * X.orb API — Vercel Serverless Entry Point
 *
 * This file re-exports the modular Hono app from apps/api/.
 * All route logic, middleware, and services live in apps/api/src/.
 * This file exists solely because Vercel resolves /api → api/index.ts.
 */
import { handle } from 'hono/vercel'
import { app } from '../apps/api/src/app'

export default handle(app)
