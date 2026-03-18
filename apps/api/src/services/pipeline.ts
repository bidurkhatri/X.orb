import {
  runPipeline as runCorePipeline,
  createGateRegistry,
  createGatePermissions,
  createGateRateLimit,
  createGateSpendLimit,
  createGateAudit,
  createGateCompliance,
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
import {
  checkAndIncrementRateLimit,
  insertPlatformEvent,
  insertReputationRecord,
  insertSlashingRecord,
  getReputationHistory,
  getSlashingRecords,
} from '../adapters/supabase-services'
import { anchorAuditHashOnChain, slashAgentOnChain } from './contracts'
import { getPaymentService } from './payments'

export interface PaymentContext {
  paymentId: string
  grossAmount: bigint
  feeAmount: bigint
  netAmount: bigint
  collectTxHash: string
  payerAddress: string
  freeActionsRemaining: number
  feeExempt: boolean
}

// Singleton services
let reputationEngine: ReputationEngine | null = null
let slashingService: SlashingService | null = null
let eventBus: EventBus | null = null
let webhookService: WebhookService | null = null

export function getReputationEngine(): ReputationEngine {
  if (!reputationEngine) reputationEngine = new ReputationEngine()
  return reputationEngine
}

/**
 * Hydrate the in-memory ReputationEngine for a specific agent from Supabase.
 * Called before pipeline runs to ensure cold-started instances have correct scores.
 */
async function hydrateReputationForAgent(agentId: string): Promise<void> {
  const engine = getReputationEngine()
  if (engine.getSnapshot(agentId)) return // already loaded

  const registry = await getRegistry()
  const agent = registry.getAgent(agentId)
  if (agent) {
    // Initialize from the registry's persisted reputation score
    engine.initAgent(agentId, agent.reputation)
  }
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
  paymentCtx?: PaymentContext,
): Promise<PipelineResult & { payment?: { status: string; fee_tx?: string; forward_tx?: string; refund_tx?: string } }> {
  const registry = await getRegistry()
  const reputation = getReputationEngine()
  const slashing = getSlashingService()
  const events = getEventBus()

  // Hydrate reputation from persisted registry data on cold start
  await hydrateReputationForAgent(agentId)

  const gates = [
    createGateRegistry(registry),
    createGatePermissions(),
    createGateRateLimit(checkAndIncrementRateLimit),
    createGateSpendLimit(),
    createGateAudit(),
    createGateCompliance(),
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
    await registry.recordAction(agentId)
    const repEvent = reputation.recordSuccess(agentId, result.action_id)
    result.reputation_delta = repEvent.pointsDelta
    await registry.updateReputation(agentId, repEvent.pointsDelta)

    // Persist reputation change to Supabase
    const agent = registry.getAgent(agentId)
    insertReputationRecord({
      agent_id: agentId,
      event_type: 'action.approved',
      delta: repEvent.pointsDelta,
      score_before: (agent?.reputation ?? 0) - repEvent.pointsDelta,
      score_after: agent?.reputation ?? 0,
      streak_count: (repEvent as any).streak ?? 0,
      tier_after: agent?.reputationTier,
      action_id: result.action_id,
    }).catch(e => console.error('[Pipeline] Reputation persist failed:', e))

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

    // Persist event to Supabase
    insertPlatformEvent({
      event_id: result.action_id,
      agent_id: agentId,
      event_type: 'action.approved',
      payload: { action, tool, latency_ms: result.latency_ms, reputation_delta: result.reputation_delta },
    }).catch(e => console.error('[Pipeline] Event persist failed:', e))

    // Anchor audit hash on-chain (non-blocking, gracefully skipped if contracts not configured)
    if (process.env.ENABLE_ONCHAIN_ANCHORING !== 'false') {
      anchorAuditHashOnChain({
        agentId,
        auditHash: result.audit_hash,
        actionId: result.action_id,
      }).catch(e => console.error('[Pipeline] On-chain anchoring failed (non-blocking):', e))
    }

    // Post-pipeline payment settlement: split fee to treasury, forward net to recipient
    if (paymentCtx && paymentCtx.grossAmount > 0n) {
      const payments = getPaymentService()
      try {
        if (payments.isConfigured() && !paymentCtx.feeExempt) {
          // Forward net amount back to the payer (sponsor) after fee deduction.
          // In marketplace escrow flows, this would be the escrow contract address instead.
          const recipientAddress = paymentCtx.payerAddress
          const { feeTxHash, forwardTxHash } = await payments.splitAndForward(
            recipientAddress,
            paymentCtx.grossAmount,
            paymentCtx.feeAmount,
          )
          await payments.updatePayment(paymentCtx.paymentId, {
            action_id: result.action_id,
            agent_id: agentId,
            status: 'completed',
            fee_tx_hash: feeTxHash,
            forward_tx_hash: forwardTxHash,
            completed_at: new Date().toISOString(),
            fee_matures_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          });
          (result as any).payment = { status: 'completed', fee_tx: feeTxHash, forward_tx: forwardTxHash }
        } else {
          // Dev mode or fee-exempt: just mark completed
          await payments.updatePayment(paymentCtx.paymentId, {
            action_id: result.action_id,
            agent_id: agentId,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[Pipeline] Payment settlement failed:', err)
        // Funds are still in facilitator wallet — safe to retry
      }
    }
  } else {
    // Failure path
    const failedGate = result.gates.find(g => !g.passed)
    const repEvent = reputation.recordFailure(agentId, result.action_id)
    result.reputation_delta = repEvent.pointsDelta
    await registry.updateReputation(agentId, repEvent.pointsDelta)

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

    // Persist reputation change
    const failedAgent = registry.getAgent(agentId)
    insertReputationRecord({
      agent_id: agentId,
      event_type: 'action.blocked',
      delta: repEvent.pointsDelta,
      score_before: (failedAgent?.reputation ?? 0) - repEvent.pointsDelta,
      score_after: failedAgent?.reputation ?? 0,
      streak_count: 0,
      tier_after: failedAgent?.reputationTier,
      action_id: result.action_id,
    }).catch(e => console.error('[Pipeline] Reputation persist failed:', e))

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

    // Persist event
    insertPlatformEvent({
      event_id: result.action_id,
      agent_id: agentId,
      event_type: 'action.blocked',
      payload: { action, tool, gate_failed: failedGate?.gate, reason: failedGate?.reason },
    }).catch(e => console.error('[Pipeline] Event persist failed:', e))

    // Post-pipeline refund: full gross amount returned to payer (M-8a)
    if (paymentCtx && paymentCtx.grossAmount > 0n) {
      const payments = getPaymentService()
      try {
        if (payments.isConfigured()) {
          const { txHash } = await payments.refund(paymentCtx.payerAddress, paymentCtx.grossAmount)
          await payments.updatePayment(paymentCtx.paymentId, {
            action_id: result.action_id,
            agent_id: agentId,
            status: 'refunded',
            refund_tx_hash: txHash,
            refund_reason: failedGate?.reason || 'Pipeline rejected',
            refunded_at: new Date().toISOString(),
          });
          (result as any).payment = { status: 'refunded', refund_tx: txHash }
        } else {
          await payments.updatePayment(paymentCtx.paymentId, {
            action_id: result.action_id,
            agent_id: agentId,
            status: 'refunded',
            refund_reason: failedGate?.reason || 'Pipeline rejected',
            refunded_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.error('[Pipeline] Refund failed:', err)
        // Critical: funds are in facilitator — alert admin for manual resolution
      }
    }
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
