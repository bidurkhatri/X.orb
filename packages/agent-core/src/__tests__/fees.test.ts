import { describe, it, expect } from 'vitest'
import { calculateFee, formatUsdc, type FeeConfig } from '../fees'

const config: FeeConfig = {
  basisPoints: 30,
  minimumUsdc: 1000n,        // $0.001
  maximumUsdc: 50_000_000n,  // $50.00
  freeTierLimit: 500,
  highVolumeThreshold: 50_000,
  highVolumeBps: 15,
  exemptActions: ['health_check', 'agent_query'],
}

describe('Fee Engine', () => {
  it('30 bps on $100 action → $0.30 fee, $99.70 net', () => {
    const result = calculateFee('transfer', 100_000_000n, 501, config)
    expect(result.feeAmount).toBe(300_000n)    // $0.30
    expect(result.netAmount).toBe(99_700_000n) // $99.70
    expect(result.feeBasisPoints).toBe(30)
    expect(result.feeExempt).toBe(false)
  })

  it('enforces minimum fee: $0.10 action → $0.001 fee (minimum)', () => {
    const result = calculateFee('query', 100_000n, 501, config) // $0.10
    // 30 bps of $0.10 = $0.0003 = 300 micro, below minimum of 1000
    expect(result.feeAmount).toBe(1000n) // $0.001 minimum enforced
    expect(result.netAmount).toBe(99_000n)
  })

  it('enforces maximum fee cap: $50,000 action → $50 fee (cap)', () => {
    const result = calculateFee('large_transfer', 50_000_000_000n, 501, config) // $50,000
    // 30 bps of $50,000 = $150, above max of $50
    expect(result.feeAmount).toBe(50_000_000n) // $50 cap
    expect(result.netAmount).toBe(49_950_000_000n)
  })

  it('free tier: first 499 actions = zero fee', () => {
    const result = calculateFee('transfer', 1_000_000n, 250, config)
    expect(result.feeAmount).toBe(0n)
    expect(result.netAmount).toBe(1_000_000n)
    expect(result.feeExempt).toBe(true)
    expect(result.reason).toBe('free_tier')
    expect(result.freeActionsRemaining).toBe(249)
  })

  it('free tier boundary: action 499 = free, action 500 = fee', () => {
    const free = calculateFee('transfer', 1_000_000n, 499, config)
    expect(free.feeExempt).toBe(true)
    expect(free.reason).toBe('free_tier')

    const paid = calculateFee('transfer', 1_000_000n, 500, config)
    expect(paid.feeExempt).toBe(false)
    expect(paid.feeAmount).toBeGreaterThan(0n)
  })

  it('high-volume discount: 50K+ monthly gets 15 bps instead of 30', () => {
    const result = calculateFee('transfer', 100_000_000n, 50_001, config) // $100
    expect(result.feeBasisPoints).toBe(15)
    expect(result.feeAmount).toBe(150_000n) // $0.15 (15 bps of $100)
  })

  it('exempt action types: zero fee regardless of usage', () => {
    const result = calculateFee('health_check', 1_000_000n, 5_000, config)
    expect(result.feeAmount).toBe(0n)
    expect(result.feeExempt).toBe(true)
    expect(result.reason).toBe('exempt_action_type')
  })

  it('BigInt precision: no rounding errors on odd amount', () => {
    const result = calculateFee('transfer', 500_001n, 501, config) // $0.500001
    // 30 bps of 500001 = 500001 * 30 / 10000 = 15000030 / 10000 = 1500n (truncated)
    // But 1500 > minimum (1000), so fee = 1500
    expect(result.feeAmount).toBe(1500n)
    expect(result.netAmount).toBe(500_001n - 1500n)
    // Verify: gross = fee + net (no dust lost)
    expect(result.feeAmount + result.netAmount).toBe(result.grossAmount)
  })

  it('fee never exceeds gross amount (safety cap)', () => {
    // Edge case: very small amount where minimum fee > gross
    const result = calculateFee('transfer', 500n, 501, config) // $0.0005
    // Minimum fee ($0.001 = 1000) > gross (500), so safety cap: 500/10 = 50
    expect(result.feeAmount).toBe(50n)
    expect(result.netAmount).toBe(450n)
    expect(result.feeAmount + result.netAmount).toBe(result.grossAmount)
  })

  it('zero-amount action: handled gracefully', () => {
    const result = calculateFee('query', 0n, 501, config)
    expect(result.feeAmount).toBe(0n)
    expect(result.netAmount).toBe(0n)
    expect(result.feeExempt).toBe(true)
    expect(result.reason).toBe('zero_amount')
  })

  it('custom enterprise bps override', () => {
    const result = calculateFee('transfer', 100_000_000n, 1001, config, 10) // custom 10 bps
    expect(result.feeBasisPoints).toBe(10)
    expect(result.feeAmount).toBe(100_000n) // $0.10 (10 bps of $100)
  })

  it('formatUsdc formats correctly', () => {
    expect(formatUsdc(1_000_000n)).toBe('1.000000')
    expect(formatUsdc(0n)).toBe('0.000000')
    expect(formatUsdc(123_456_789n)).toBe('123.456789')
    expect(formatUsdc(1000n)).toBe('0.001000')
    expect(formatUsdc(50_000_000_000n)).toBe('50000.000000')
  })
})
