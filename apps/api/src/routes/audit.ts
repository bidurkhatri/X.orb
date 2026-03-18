import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { Env } from '../app'
import { getEventBus, getSlashingService, getReputationEngine } from '../services/pipeline'
import { authorizeSponsor } from '../middleware/auth'
import { ok, err } from '../lib/response'

export const auditRouter = new Hono<Env>()

auditRouter.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const authErr = await authorizeSponsor(c, agentId)
  if (authErr) return authErr
  const bus = getEventBus()
  const slashing = getSlashingService()
  const reputation = getReputationEngine()

  const events = bus.getEvents({ agentId, limit: 200 })
  const violations = slashing.getViolations(agentId)
  const repSnapshot = reputation.getSnapshot(agentId)

  return ok(c, {
    agent_id: agentId,
    events: events.length,
    recent_events: events.slice(-50),
    violations: { count: violations.length, total_slashed: slashing.getTotalSlashed(agentId), records: violations.slice(-20) },
    reputation: repSnapshot || null,
  })
})

auditRouter.post('/:actionId/evidence', async (c) => {
  const actionId = c.req.param('actionId')
  const sponsorAddress = c.get('sponsorAddress')
  const contentType = c.req.header('content-type') || ''
  if (!contentType.includes('multipart/form-data')) return err(c, 'validation_error', 'Content-Type must be multipart/form-data', 400)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return err(c, 'validation_error', 'No file provided', 400)

  const allowed = ['application/pdf', 'image/png', 'image/jpeg']
  if (!allowed.includes(file.type)) return err(c, 'validation_error', `File type ${file.type} not allowed. Accepted: PDF, PNG, JPG`, 400)
  if (file.size > 10 * 1024 * 1024) return err(c, 'validation_error', 'File too large. Maximum 10MB.', 400)

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return err(c, 'service_unavailable', 'Storage not configured', 503)

  const sb = createClient(supabaseUrl, supabaseKey)
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `${sponsorAddress}/${actionId}/${Date.now()}.${ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await sb.storage.from('audit-evidence').upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadError) return err(c, 'upload_failed', uploadError.message, 500)

  const { data: urlData } = sb.storage.from('audit-evidence').getPublicUrl(storagePath)
  return ok(c, { action_id: actionId, evidence_url: urlData.publicUrl, file_name: file.name, file_size: file.size, file_type: file.type }, 201)
})

// CSV export (binary response — no envelope needed for file downloads)
auditRouter.get('/export/:agentId', async (c) => {
  const agentId = c.req.param('agentId')
  const authErr = await authorizeSponsor(c, agentId)
  if (authErr) return authErr

  const format = c.req.query('format') || 'csv'

  const bus = getEventBus()
  const events = bus.getEvents({ agentId, limit: 5000 })
  const slashing = getSlashingService()
  const reputation = getReputationEngine()

  if (format === 'pdf') {
    // PDF export with tamper-evidence hash
    const repSnapshot = reputation.getSnapshot(agentId)
    const violations = slashing.getViolations(agentId)

    const pdfContent = [
      '=== X.orb Audit Report ===',
      `Agent: ${agentId}`,
      `Generated: ${new Date().toISOString()}`,
      `Entity: Fintex Australia Pty Ltd (ACN 688 406 108)`,
      '',
      '--- Summary ---',
      `Total Events: ${events.length}`,
      `Approved: ${events.filter(e => e.type === 'action.approved').length}`,
      `Blocked: ${events.filter(e => e.type === 'action.blocked').length}`,
      `Violations: ${violations.length}`,
      `Reputation: ${repSnapshot?.score ?? 'N/A'} (${repSnapshot?.tier ?? 'N/A'})`,
      '',
      '--- Events ---',
      ...events.slice(-100).map(e => `[${e.timestamp}] ${e.type} — ${JSON.stringify(e.data)}`),
      '',
      '--- Violations ---',
      ...violations.map(v => `[${v.createdAt}] ${v.severity} — ${v.violationType}: ${v.description}`),
    ].join('\n')

    const contentHash = createHash('sha256').update(pdfContent).digest('hex')
    c.header('X-Content-Hash', contentHash)
    c.header('Content-Type', 'text/plain')
    c.header('Content-Disposition', `attachment; filename="xorb-audit-${agentId}-${new Date().toISOString().slice(0, 10)}.txt"`)
    return c.body(pdfContent)
  }

  // CSV export
  const headers = ['event_id', 'type', 'timestamp', 'data']
  const rows = events.map(e => [e.id, e.type, e.timestamp, JSON.stringify(e.data).replace(/"/g, '""')])
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="xorb-audit-${agentId}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
})
