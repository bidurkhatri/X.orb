import type { RegisteredAgent } from './types'

export type ViolationSeverity = 'minor' | 'moderate' | 'severe' | 'critical'

export interface ViolationRecord {
  id: string
  agentId: string
  severity: ViolationSeverity
  violationType: string
  description: string
  slashAmountUsdc: string      // 6-decimal USDC string
  slashPercentage: number
  reputationLost: number
  gateFailed?: string
  actionId?: string
  autoRevoked: boolean
  createdAt: string
}

export interface SlashResult {
  violation: ViolationRecord
  newBondAmount: string
  newReputationScore: number
  agentSuspended: boolean
  agentRevoked: boolean
}

// Slash percentages by severity
const SLASH_CONFIG: Record<ViolationSeverity, {
  bondPercent: number
  reputationLoss: number
  autoSuspend: boolean
  autoRevoke: boolean
}> = {
  minor: {
    bondPercent: 5,
    reputationLoss: 50,
    autoSuspend: false,
    autoRevoke: false,
  },
  moderate: {
    bondPercent: 20,
    reputationLoss: 200,
    autoSuspend: true,
    autoRevoke: false,
  },
  severe: {
    bondPercent: 50,
    reputationLoss: 500,
    autoSuspend: true,
    autoRevoke: false,
  },
  critical: {
    bondPercent: 100,
    reputationLoss: 1000,
    autoSuspend: false,
    autoRevoke: true,
  },
}

// Map gate failures to violation types
const GATE_VIOLATION_MAP: Record<string, { severity: ViolationSeverity; type: string }> = {
  rate_limit: { severity: 'minor', type: 'rate_limit_exceeded' },
  permissions: { severity: 'moderate', type: 'permission_violation' },
  spend_limit: { severity: 'severe', type: 'spend_limit_breach' },
  reputation: { severity: 'minor', type: 'reputation_gate_failure' },
}

export class SlashingService {
  private violations = new Map<string, ViolationRecord[]>()

  getViolations(agentId: string): ViolationRecord[] {
    return this.violations.get(agentId) || []
  }

  getViolationCount(agentId: string): number {
    return (this.violations.get(agentId) || []).length
  }

  getTotalSlashed(agentId: string): string {
    const records = this.violations.get(agentId) || []
    let total = BigInt(0)
    for (const r of records) {
      total += BigInt(r.slashAmountUsdc)
    }
    return total.toString()
  }

  /**
   * Slash an agent for a gate failure.
   */
  slashForGateFailure(
    agent: RegisteredAgent,
    gateFailed: string,
    actionId?: string
  ): SlashResult | null {
    const mapping = GATE_VIOLATION_MAP[gateFailed]
    if (!mapping) return null // not all gate failures trigger slashing

    return this.slash(agent, mapping.severity, mapping.type, `Gate failure: ${gateFailed}`, gateFailed, actionId)
  }

  /**
   * Slash an agent for a specific violation.
   */
  slash(
    agent: RegisteredAgent,
    severity: ViolationSeverity,
    violationType: string,
    description: string,
    gateFailed?: string,
    actionId?: string
  ): SlashResult {
    const config = SLASH_CONFIG[severity]
    const currentBond = BigInt(agent.stakeBond)
    const slashAmount = (currentBond * BigInt(config.bondPercent)) / BigInt(100)
    const newBond = currentBond - slashAmount

    const violation: ViolationRecord = {
      id: `viol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId: agent.agentId,
      severity,
      violationType,
      description,
      slashAmountUsdc: slashAmount.toString(),
      slashPercentage: config.bondPercent,
      reputationLost: config.reputationLoss,
      gateFailed,
      actionId,
      autoRevoked: config.autoRevoke,
      createdAt: new Date().toISOString(),
    }

    // Store violation
    const records = this.violations.get(agent.agentId) || []
    records.push(violation)
    this.violations.set(agent.agentId, records)

    // Update agent bond
    agent.stakeBond = newBond.toString()

    // Check for escalation: 3+ violations in 24h = auto-suspend
    const recentViolations = records.filter(r => {
      const age = Date.now() - new Date(r.createdAt).getTime()
      return age < 24 * 60 * 60 * 1000
    })
    const shouldSuspend = config.autoSuspend || recentViolations.length >= 3
    const shouldRevoke = config.autoRevoke

    if (shouldRevoke) {
      agent.status = 'revoked'
      agent.stakeBond = '0'
    } else if (shouldSuspend) {
      agent.status = 'paused'
    }

    const newReputation = Math.max(0, agent.reputation - config.reputationLoss)

    return {
      violation,
      newBondAmount: agent.stakeBond,
      newReputationScore: newReputation,
      agentSuspended: shouldSuspend && !shouldRevoke,
      agentRevoked: shouldRevoke,
    }
  }

  /**
   * Check if repeated violations should trigger escalation.
   */
  shouldEscalate(agentId: string): { escalate: boolean; reason?: string } {
    const records = this.violations.get(agentId) || []
    if (records.length === 0) return { escalate: false }

    // 5+ total violations = warn
    if (records.length >= 5 && records.length < 10) {
      return { escalate: true, reason: `${records.length} total violations — probation recommended` }
    }

    // 10+ total = permanent revocation recommended
    if (records.length >= 10) {
      return { escalate: true, reason: `${records.length} total violations — permanent revocation recommended` }
    }

    return { escalate: false }
  }
}
