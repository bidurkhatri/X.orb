import { describe, it, expect } from 'vitest'
import { calculateFee, formatUsdc, type FeeConfig } from '../fees'

const config: FeeConfig = {
  basisPoints: 30,
  minimumUsdc: 1000n,        // $0.001
  maximumUsdc: 50_000_000n,  // $50.00
  highVolumeThreshold: 50_000,
  highVolumeBps: 15,
  exemptActions: ['health_check', 'agent_query'],
}

describe('Fee Engine', () => {
  it('30 bps on $100 action → $0.30 fee, $99.70 net', () => {
    const result = calculateFee('transfer', 100_000_000n, 1, config)
    expect(result.feeAmount).toBe(300_000n)    // $0.30
    expect(result.netAmount).toBe(99_700_000n) // $99.70
    expect(result.feeBasisPoints).toBe(30)
    expect(result.feeExempt).toBe(false)
  })

  it('enforces minimum fee: $0.10 action → $0.001 fee (minimum)', () => {
    const result = calculateFee('query', 100_000n, 1, config) // $0.10
    expect(result.feeAmount).toBe(1000n) // $0.001 minimum enforced
    expect(result.netAmount).toBe(99_000n)
  })

  it('enforces maximum fee cap: $50,000 action → $50 fee (cap)', () => {
    const result = calculateFee('large_transfer', 50_000_000_000n, 1, config) // $50,000
    expect(result.feeAmount).toBe(50_000_000n) // $50 cap
    expect(result.netAmount).toBe(49_950_000_000n)
  })

  it('every action is paid — no free tier', () => {
    const result = calculateFee('transfer', 1_000_000n, 0, config)
    expect(result.feeExempt).toBe(false)
    expect(result.feeAmount).toBeGreaterThan(0n)
  })

  it('first action is paid', () => {
    const result = calculateFee('transfer', 1_000_000n, 0, config)
    expect(result.feeExempt).toBe(false)
    expect(result.feeAmount).toBe(3000n) // 30 bps of $1
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
    const result = calculateFee('transfer', 500_001n, 1, config)
    expect(result.feeAmount).toBe(1500n)
    expect(result.netAmount).toBe(500_001n - 1500n)
    expect(result.feeAmount + result.netAmount).toBe(result.grossAmount)
  })

  it('fee never exceeds gross amount (safety cap)', () => {
    const result = calculateFee('transfer', 500n, 1, config) // $0.0005
    expect(result.feeAmount).toBe(50n)
    expect(result.netAmount).toBe(450n)
    expect(result.feeAmount + result.netAmount).toBe(result.grossAmount)
  })

  it('zero-amount action: handled gracefully', () => {
    const result = calculateFee('query', 0n, 1, config)
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
