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
// Accepts an optional persistent rate limiter function for production use.
// Falls back to in-memory for tests/dev.
export type RateLimitChecker = (key: string, limit: number, windowMs: number) =>
  Promise<{ allowed: boolean; count: number; resetAt: number }>

export function createGateRateLimit(rateLimitFn?: RateLimitChecker) {
  // In-memory fallback for tests and dev
  const counters = new Map<string, { count: number; resetAt: number }>()

  const defaultChecker: RateLimitChecker = async (key, limit, windowMs) => {
    const now = Date.now()
    let counter = counters.get(key)
    if (!counter || now > counter.resetAt) {
      counter = { count: 0, resetAt: now + windowMs }
      counters.set(key, counter)
    }
    if (counter.count >= limit) {
      return { allowed: false, count: counter.count, resetAt: counter.resetAt }
    }
    counter.count++
    return { allowed: true, count: counter.count, resetAt: counter.resetAt }
  }

  const checker = rateLimitFn || defaultChecker

  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'rate_limit', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }

    const limit = ctx.agent.permissionScope.maxActionsPerHour
    const result = await checker(`agent:${ctx.agentId}`, limit, 3600000)

    if (!result.allowed) {
      const resetIn = Math.ceil((result.resetAt - Date.now()) / 60000)
      return {
        gate: 'rate_limit',
        passed: false,
        reason: `Rate limit exceeded: ${limit}/hr. Resets in ${resetIn}min`,
        latency_ms: Date.now() - start,
      }
    }

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

// Gate 5: Audit Integrity Check
// Verifies the agent hasn't accumulated too many unresolved violations.
// Configurable threshold; blocks actions for agents under active investigation.
export function createGateAudit(maxUnresolvedViolations = 5) {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'audit', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }
    // Check violation count (slash events recorded on the agent)
    if (ctx.agent.slashEvents >= maxUnresolvedViolations) {
      return {
        gate: 'audit',
        passed: false,
        reason: `Agent has ${ctx.agent.slashEvents} violations (threshold: ${maxUnresolvedViolations}). Action blocked pending review.`,
        latency_ms: Date.now() - start,
      }
    }
    return { gate: 'audit', passed: true, latency_ms: Date.now() - start }
  }
}

// Gate 6: Compliance Pre-check
// Validates the action context has required fields for audit trail completeness.
// Ensures every action passing through the pipeline is traceable.
export function createGateCompliance() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // Verify minimum traceability requirements
    if (!ctx.agentId || ctx.agentId.length < 5) {
      return { gate: 'compliance', passed: false, reason: 'Invalid agent ID for audit trail', latency_ms: Date.now() - start }
    }
    if (!ctx.action || ctx.action.length < 1) {
      return { gate: 'compliance', passed: false, reason: 'Action name required for audit trail', latency_ms: Date.now() - start }
    }
    if (!ctx.tool || ctx.tool.length < 1) {
      return { gate: 'compliance', passed: false, reason: 'Tool name required for audit trail', latency_ms: Date.now() - start }
    }
    return { gate: 'compliance', passed: true, latency_ms: Date.now() - start }
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
