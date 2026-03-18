import { serve } from '@hono/node-server'
import { app } from './app'

const port = parseInt(process.env.PORT || '3000')

console.log(JSON.stringify({ level: 'info', service: 'xorb-api', event: 'startup', port, url: `http://localhost:${port}`, routes: 15 }))

serve({ fetch: app.fetch, port })
