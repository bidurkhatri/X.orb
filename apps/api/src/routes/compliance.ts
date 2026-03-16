import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Env } from '../app'
import { ComplianceReporter, type AuditData, type ComplianceFramework } from '@xorb/agent-core'
import { getRegistry } from '../services/registry'
import { getReputationEngine, getSlashingService, getEventBus } from '../services/pipeline'

const complianceQuerySchema = z.object({
  format: z.enum(['eu-ai-act', 'nist-ai-rmf', 'soc2']).default('eu-ai-act'),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const complianceRouter = new Hono<Env>()
const reporter = new ComplianceReporter()

// GET /v1/compliance/:agentId — Generate compliance report
complianceRouter.get('/:agentId', zValidator('query', complianceQuerySchema), async (c) => {
  const agentId = c.req.param('agentId')
  const { format, from, to } = c.req.valid('query')

  const registry = await getRegistry()
  const agent = registry.getAgent(agentId)
  if (!agent) return c.json({ error: 'Agent not found' }, 404)

  const reputation = getReputationEngine()
  const slashing = getSlashingService()
  const events = getEventBus()

  const repSnap = reputation.getSnapshot(agentId)
  const violations = slashing.getViolations(agentId)
  const agentEvents = events.getEvents({ agentId })

  const auditData: AuditData = {
    agentId,
    totalActions: agent.totalActionsExecuted,
    approvedActions: agentEvents.filter(e => e.type === 'action.approved').length,
    blockedActions: agentEvents.filter(e => e.type === 'action.blocked').length,
    violations: violations.map(v => ({
      severity: v.severity,
      type: v.violationType,
      timestamp: v.createdAt,
    })),
    reputationScore: repSnap?.score ?? agent.reputation,
    reputationTier: repSnap?.tier ?? agent.reputationTier,
    bondAmount: agent.stakeBond,
    totalSlashed: slashing.getTotalSlashed(agentId),
    humanOverrideCount: agentEvents.filter(e =>
      e.type === 'agent.paused' || e.type === 'agent.resumed' || e.type === 'agent.revoked'
    ).length,
    auditHashesAnchored: agentEvents.filter(e => e.type === 'action.verified').length,
  }

  const periodFrom = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const periodTo = to || new Date().toISOString()

  const report = reporter.generateReport(format as ComplianceFramework, auditData, periodFrom, periodTo)
  return c.json(report)
})

// GET /v1/compliance/:agentId/frameworks — List available frameworks
complianceRouter.get('/:agentId/frameworks', async (c) => {
  return c.json({
    frameworks: [
      { id: 'eu-ai-act', name: 'EU AI Act', description: 'European Union Artificial Intelligence Act compliance' },
      { id: 'nist-ai-rmf', name: 'NIST AI RMF', description: 'NIST AI Risk Management Framework' },
      { id: 'soc2', name: 'SOC 2', description: 'Service Organization Control Type 2' },
    ],
  })
})
