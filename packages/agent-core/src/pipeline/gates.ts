import type { PipelineContext, GateResult, RegisteredAgent } from '../types'
import type { AgentRegistryService } from '../registry'
import { PermissionChecker } from '../roles'

// Gate 1: Registry Check
export function createGateRegistry(registry: AgentRegistryService) {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    const check = registry.canExecute(ctx.agentId)
    if (!check.allowed) {
      return { gate: 'registry', passed: false, reason: check.reason, latency_ms: Date.now() - start }
    }
    ctx.agent = registry.getAgent(ctx.agentId)
    return { gate: 'registry', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 2: Permission Check
export function createGatePermissions() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'permissions', passed: false, reason: 'No agent in context', latency_ms: Date.now() - start }
    }
    const checker = new PermissionChecker(ctx.agent.permissionScope)
    if (!checker.canUseTool(ctx.tool)) {
      return {
        gate: 'permissions',
        passed: false,
        reason: `Tool "${ctx.tool}" not allowed for role ${ctx.agent.role}. Allowed: ${ctx.agent.permissionScope.allowedTools.join(', ')}`,
        latency_ms: Date.now() - start,
      }
    }
    return { gate: 'permissions', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 3: Rate Limit
export function createGateRateLimit() {
  const counters = new Map<string, { count: number; resetAt: number }>()

  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'rate_limit', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }

    const now = Date.now()
    let counter = counters.get(ctx.agentId)
    if (!counter || now > counter.resetAt) {
      counter = { count: 0, resetAt: now + 3600000 }
      counters.set(ctx.agentId, counter)
    }

    const limit = ctx.agent.permissionScope.maxActionsPerHour
    if (counter.count >= limit) {
      const resetIn = Math.ceil((counter.resetAt - now) / 60000)
      return {
        gate: 'rate_limit',
        passed: false,
        reason: `Rate limit exceeded: ${limit}/hr. Resets in ${resetIn}min`,
        latency_ms: Date.now() - start,
      }
    }

    counter.count++
    return { gate: 'rate_limit', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 4: Spend Limit
export function createGateSpendLimit() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'spend_limit', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }

    // Non-financial actions pass
    if (!ctx.agent.permissionScope.canTransferFunds) {
      return { gate: 'spend_limit', passed: true, latency_ms: Date.now() - start }
    }

    // Check if action includes a value transfer
    const params = ctx.params as Record<string, unknown> | undefined
    const actionValue = params?.value as string | undefined
    if (actionValue) {
      const maxFunds = BigInt(ctx.agent.permissionScope.maxFundsPerAction)
      if (BigInt(actionValue) > maxFunds) {
        return {
          gate: 'spend_limit',
          passed: false,
          reason: `Action value ${actionValue} exceeds limit ${ctx.agent.permissionScope.maxFundsPerAction}`,
          latency_ms: Date.now() - start,
        }
      }
    }

    return { gate: 'spend_limit', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 5: Audit Log
export function createGateAudit() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // Audit gate always passes — its purpose is to record the attempt.
    // The actual audit record is written after the pipeline completes.
    return { gate: 'audit', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 6: Webhook Dispatch
export function createGateWebhook() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // Webhook dispatch is fire-and-forget.
    // Actual delivery happens post-pipeline via the WebhookService.
    return { gate: 'webhook', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 7: Execute
export function createGateExecute() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // In the API model, execution happens after pipeline approval.
    // This gate validates the action is well-formed.
    if (!ctx.action || !ctx.tool) {
      return { gate: 'execute', passed: false, reason: 'Missing action or tool', latency_ms: Date.now() - start }
    }
    return { gate: 'execute', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 8: Reputation Check
export function createGateReputation(registry: AgentRegistryService) {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'reputation', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }

    // Minimum reputation thresholds by action risk
    const minScore = ctx.agent.permissionScope.canTransferFunds ? 500 : 100
    if (ctx.agent.reputation < minScore) {
      return {
        gate: 'reputation',
        passed: false,
        reason: `Reputation ${ctx.agent.reputation} below minimum ${minScore} for this action type`,
        latency_ms: Date.now() - start,
      }
    }

    return { gate: 'reputation', passed: true, latency_ms: Date.now() - start }
  }
}
