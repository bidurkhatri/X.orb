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
  type PipelineContext,
  type PipelineResult,
} from '@xorb/agent-core'
import { getRegistry } from './registry'

export async function runPipeline(
  agentId: string,
  action: string,
  tool: string,
  params: unknown,
): Promise<PipelineResult> {
  const registry = await getRegistry()

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

  // Update agent stats
  if (result.approved) {
    registry.recordAction(agentId)
    registry.updateReputation(agentId, 1)
  } else {
    registry.updateReputation(agentId, -5)
  }

  return result
}
