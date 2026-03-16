import {
  runPipeline as runCorePipeline,
  createGateRegistry,
  createGatePermissions,
  createGateRateLimit,
  createGateSpendLimit,
  createGateAudit,
  createGateWebhook,
  createGateExecute,
  createGateReputation,
  ReputationEngine,
  SlashingService,
  EventBus,
  WebhookService,
  type PipelineContext,
  type PipelineResult,
} from '@xorb/agent-core'
import { getRegistry } from './registry'

// Singleton services
let reputationEngine: ReputationEngine | null = null
let slashingService: SlashingService | null = null
let eventBus: EventBus | null = null
let webhookService: WebhookService | null = null

export function getReputationEngine(): ReputationEngine {
  if (!reputationEngine) reputationEngine = new ReputationEngine()
  return reputationEngine
}

export function getSlashingService(): SlashingService {
  if (!slashingService) slashingService = new SlashingService()
  return slashingService
}

export function getEventBus(): EventBus {
  if (!eventBus) {
    eventBus = new EventBus()
    // Wire up webhook delivery on all events
    const ws = getWebhookService()
    eventBus.onAll(async (event) => {
      await ws.deliver(event)
    })
  }
  return eventBus
}

export function getWebhookService(): WebhookService {
  if (!webhookService) webhookService = new WebhookService()
  return webhookService
}

export async function runPipeline(
  agentId: string,
  action: string,
  tool: string,
  params: unknown,
): Promise<PipelineResult> {
  const registry = await getRegistry()
  const reputation = getReputationEngine()
  const slashing = getSlashingService()
  const events = getEventBus()

  const gates = [
    createGateRegistry(registry),
    createGatePermissions(),
    createGateRateLimit(),
    createGateSpendLimit(),
    createGateAudit(),
    createGateWebhook(),
    createGateExecute(),
    createGateReputation(registry),
  ]

  const ctx: PipelineContext = {
    agentId,
    action,
    tool,
    params,
    gateResults: [],
    startTime: Date.now(),
  }

  const result = await runCorePipeline(ctx, gates)

  if (result.approved) {
    // Success path
    registry.recordAction(agentId)
    const repEvent = reputation.recordSuccess(agentId, result.action_id)
    result.reputation_delta = repEvent.pointsDelta
    registry.updateReputation(agentId, repEvent.pointsDelta)

    await events.emit({
      type: 'action.approved',
      agentId,
      data: {
        action_id: result.action_id,
        action,
        tool,
        latency_ms: result.latency_ms,
        reputation_delta: result.reputation_delta,
      },
    })
  } else {
    // Failure path
    const failedGate = result.gates.find(g => !g.passed)
    const repEvent = reputation.recordFailure(agentId, result.action_id)
    result.reputation_delta = repEvent.pointsDelta
    registry.updateReputation(agentId, repEvent.pointsDelta)

    // Check if this failure warrants slashing
    const agent = registry.getAgent(agentId)
    if (agent && failedGate) {
      const slashResult = slashing.slashForGateFailure(agent, failedGate.gate, result.action_id)
      if (slashResult) {
        await events.emit({
          type: 'agent.slashed',
          agentId,
          data: {
            violation_id: slashResult.violation.id,
            severity: slashResult.violation.severity,
            slash_amount: slashResult.violation.slashAmountUsdc,
            gate_failed: failedGate.gate,
            new_bond: slashResult.newBondAmount,
            revoked: slashResult.agentRevoked,
          },
        })
      }
    }

    await events.emit({
      type: 'action.blocked',
      agentId,
      data: {
        action_id: result.action_id,
        action,
        tool,
        gate_failed: failedGate?.gate,
        reason: failedGate?.reason,
      },
    })
  }

  return result
}

/**
 * Batch execute multiple actions through the pipeline.
 */
export async function runBatchPipeline(
  actions: Array<{ agent_id: string; action: string; tool: string; params?: unknown }>
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = []
  for (const act of actions) {
    const result = await runPipeline(act.agent_id, act.action, act.tool, act.params || {})
    results.push(result)
  }
  return results
}
