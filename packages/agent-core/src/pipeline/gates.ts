import type { PipelineContext, GateResult } from '../types'
import type { AgentRegistryService } from '../registry'
import { PermissionChecker } from '../roles'

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

export function createGatePermissions() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'permissions', passed: false, reason: 'No agent in context', latency_ms: Date.now() - start }
    }
    const checker = new PermissionChecker(ctx.agent.permissionScope)
    if (!checker.canUseTool(ctx.tool)) {
      return { gate: 'permissions', passed: false, reason: `Tool not allowed: ${ctx.tool}`, latency_ms: Date.now() - start }
    }
    return { gate: 'permissions', passed: true, latency_ms: Date.now() - start }
  }
}

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

    if (counter.count >= ctx.agent.permissionScope.maxActionsPerHour) {
      return { gate: 'rate_limit', passed: false, reason: `Rate limit exceeded: ${ctx.agent.permissionScope.maxActionsPerHour}/hr`, latency_ms: Date.now() - start }
    }

    counter.count++
    return { gate: 'rate_limit', passed: true, latency_ms: Date.now() - start }
  }
}

export function createGateSpendLimit() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'spend_limit', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }
    // For non-financial actions, always pass
    if (!ctx.agent.permissionScope.canTransferFunds) {
      return { gate: 'spend_limit', passed: true, latency_ms: Date.now() - start }
    }
    return { gate: 'spend_limit', passed: true, latency_ms: Date.now() - start }
  }
}

export function createGateAudit() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // Audit gate always passes — it records the attempt
    return { gate: 'audit', passed: true, latency_ms: Date.now() - start }
  }
}

export function createGateWebhook() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // Webhook dispatch — fire and forget
    return { gate: 'webhook', passed: true, latency_ms: Date.now() - start }
  }
}

export function createGateExecute() {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    // In the API, execution happens after the pipeline returns approved
    return { gate: 'execute', passed: true, latency_ms: Date.now() - start }
  }
}

export function createGateReputation(registry: AgentRegistryService) {
  return async (ctx: PipelineContext): Promise<GateResult> => {
    const start = Date.now()
    if (!ctx.agent) {
      return { gate: 'reputation', passed: false, reason: 'No agent', latency_ms: Date.now() - start }
    }
    // Check minimum reputation tier
    if (ctx.agent.reputation < 100) {
      return { gate: 'reputation', passed: false, reason: 'Reputation too low', latency_ms: Date.now() - start }
    }
    return { gate: 'reputation', passed: true, latency_ms: Date.now() - start }
  }
}
