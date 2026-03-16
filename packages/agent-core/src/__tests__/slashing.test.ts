import { describe, it, expect, beforeEach } from 'vitest'
import { SlashingService } from '../slashing'
import type { RegisteredAgent } from '../types'

function makeAgent(overrides?: Partial<RegisteredAgent>): RegisteredAgent {
  return {
    agentId: 'agent_001',
    name: 'TestBot',
    role: 'TRADER',
    sponsorAddress: '0x1234567890abcdef',
    sessionWalletAddress: '0xsession',
    stakeBond: '50000000', // 50 USDC
    permissionScope: {
      allowedTools: ['get_balance'],
      allowedContracts: [],
      maxActionsPerHour: 60,
      canTransferFunds: true,
      maxFundsPerAction: '1000000',
      fileAccess: 'none',
    },
    reputation: 5000,
    reputationTier: 'RELIABLE',
    status: 'active',
    createdAt: Date.now(),
    expiresAt: 0,
    lastActiveAt: Date.now(),
    totalActionsExecuted: 100,
    slashEvents: 0,
    description: 'Test agent',
    ...overrides,
  }
}

describe('SlashingService', () => {
  let service: SlashingService

  beforeEach(() => {
    service = new SlashingService()
  })

  it('slashes 5% for minor violation', () => {
    const agent = makeAgent()
    const result = service.slash(agent, 'minor', 'test', 'Test violation')
    expect(result.violation.slashPercentage).toBe(5)
    expect(result.violation.slashAmountUsdc).toBe('2500000') // 5% of 50M
    expect(agent.stakeBond).toBe('47500000')
    expect(result.agentRevoked).toBe(false)
    expect(result.agentSuspended).toBe(false)
  })

  it('slashes 20% for moderate and suspends', () => {
    const agent = makeAgent()
    const result = service.slash(agent, 'moderate', 'test', 'Test')
    expect(result.violation.slashPercentage).toBe(20)
    expect(result.agentSuspended).toBe(true)
    expect(agent.status).toBe('paused')
  })

  it('slashes 100% for critical and revokes', () => {
    const agent = makeAgent()
    const result = service.slash(agent, 'critical', 'test', 'Test')
    expect(result.violation.slashPercentage).toBe(100)
    expect(result.agentRevoked).toBe(true)
    expect(agent.status).toBe('revoked')
    expect(agent.stakeBond).toBe('0')
  })

  it('slashForGateFailure maps rate_limit to minor', () => {
    const agent = makeAgent()
    const result = service.slashForGateFailure(agent, 'rate_limit')
    expect(result).not.toBeNull()
    expect(result!.violation.severity).toBe('minor')
  })

  it('slashForGateFailure maps permissions to moderate', () => {
    const agent = makeAgent()
    const result = service.slashForGateFailure(agent, 'permissions')
    expect(result).not.toBeNull()
    expect(result!.violation.severity).toBe('moderate')
  })

  it('returns null for unmapped gate failures', () => {
    const agent = makeAgent()
    const result = service.slashForGateFailure(agent, 'audit')
    expect(result).toBeNull()
  })

  it('tracks violation count', () => {
    const agent = makeAgent()
    service.slash(agent, 'minor', 'test', 'One')
    service.slash(agent, 'minor', 'test', 'Two')
    expect(service.getViolationCount('agent_001')).toBe(2)
  })

  it('tracks total slashed amount', () => {
    const agent = makeAgent({ stakeBond: '100000000' })
    service.slash(agent, 'minor', 'test', 'First') // 5% of 100M = 5M
    service.slash(agent, 'minor', 'test', 'Second') // 5% of 95M = 4.75M
    const total = service.getTotalSlashed('agent_001')
    expect(BigInt(total)).toBe(BigInt('9750000'))
  })

  it('shouldEscalate at 5+ violations', () => {
    const agent = makeAgent({ stakeBond: '1000000000' })
    for (let i = 0; i < 5; i++) {
      service.slash(agent, 'minor', 'test', `Violation ${i}`)
    }
    const result = service.shouldEscalate('agent_001')
    expect(result.escalate).toBe(true)
  })
})
