/**
 * X.orb API — Vercel Serverless Entry Point
 *
 * Re-exports the modular Hono app from apps/api/src/app.ts.
 * Vercel routes /api → this file via vercel.json rewrites.
 */
import { handle } from 'hono/vercel'

// Import the Hono app from the modular API package
// Vercel bundles this with esbuild which follows TypeScript imports
import { app } from '../apps/api/src/app'

// Vercel serverless handler
export default handle(app)

// Also export GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD for Vercel edge compatibility
const handler = handle(app)
export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
export const HEAD = handler
