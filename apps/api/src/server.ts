import { serve } from '@hono/node-server'
import { app } from './app'

const port = parseInt(process.env.PORT || '3000')

console.log(`\n  X.orb API starting on http://localhost:${port}\n`)
console.log(`  Routes:`)
console.log(`    GET  /v1/health`)
console.log(`    GET  /v1/pricing`)
console.log(`    POST /v1/agents`)
console.log(`    GET  /v1/agents`)
console.log(`    GET  /v1/agents/:id`)
console.log(`    POST /v1/actions/execute`)
console.log(`    POST /v1/actions/batch`)
console.log(`    GET  /v1/reputation/:agentId`)
console.log(`    GET  /v1/reputation/leaderboard`)
console.log(`    POST /v1/webhooks`)
console.log(`    GET  /v1/events`)
console.log(`    GET  /v1/audit/:agentId`)
console.log(`    GET  /v1/compliance/:agentId`)
console.log(`    GET  /v1/marketplace/listings`)
console.log(``)

serve({ fetch: app.fetch, port })
