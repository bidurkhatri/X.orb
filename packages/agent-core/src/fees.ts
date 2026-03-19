/**
 * Fee Engine — Pure BigInt arithmetic for USDC fee calculations.
 * Zero floating point. Every cent accounted for.
 *
 * All amounts in USDC micro-units (6 decimals): 1_000_000 = $1.00
 *
 * No free tier. Every action requires x402 payment.
 */

export interface FeeCalculation {
  grossAmount: bigint        // What the payer sends
  feeAmount: bigint          // What X.orb keeps
  netAmount: bigint          // What the recipient gets
  feeBasisPoints: number     // The rate applied
  feeExempt: boolean         // Whether this action is fee-exempt
  reason?: string            // Why exempt (if applicable)
}

export interface FeeConfig {
  basisPoints: number          // Default: 30 (0.30%)
  minimumUsdc: bigint          // Default: 1000n ($0.001)
  maximumUsdc: bigint          // Default: 50_000_000n ($50.00)
  highVolumeThreshold: number  // Default: 50_000
  highVolumeBps: number        // Default: 15 (0.15%)
  exemptActions: string[]      // Actions that never pay fees
}

const DEFAULT_CONFIG: FeeConfig = {
  basisPoints: 30,
  minimumUsdc: 1000n,       // $0.001
  maximumUsdc: 50_000_000n, // $50.00
  highVolumeThreshold: 50_000,
  highVolumeBps: 15,
  exemptActions: ['health_check', 'agent_query', 'reputation_query'],
}

/**
 * Calculate the platform fee for an action.
 *
 * @param actionType - The type of action being executed
 * @param grossAmount - Total USDC amount in micro-units (6 decimals)
 * @param monthlyUsage - Number of actions the sponsor has used this month
 * @param config - Fee configuration (from platform_config table)
 * @param customBps - Per-sponsor custom rate (for enterprise tier)
 */
export function calculateFee(
  actionType: string,
  grossAmount: bigint,
  monthlyUsage: number,
  config: FeeConfig = DEFAULT_CONFIG,
  customBps?: number,
): FeeCalculation {
  // Check if action type is exempt (no fee regardless of usage)
  if (config.exemptActions.includes(actionType)) {
    return {
      grossAmount, feeAmount: 0n, netAmount: grossAmount,
      feeBasisPoints: 0, feeExempt: true,
      reason: 'exempt_action_type',
    }
  }

  // Zero-amount actions: no fee
  if (grossAmount === 0n) {
    return {
      grossAmount: 0n, feeAmount: 0n, netAmount: 0n,
      feeBasisPoints: 0, feeExempt: true,
      reason: 'zero_amount',
    }
  }

  // Determine effective fee rate
  const effectiveBps = customBps
    ?? (monthlyUsage >= config.highVolumeThreshold ? config.highVolumeBps : config.basisPoints)

  // Calculate fee using BigInt (no floating point ever)
  let feeAmount = (grossAmount * BigInt(effectiveBps)) / 10000n

  // Apply minimum fee floor
  if (feeAmount < config.minimumUsdc) {
    feeAmount = config.minimumUsdc
  }

  // Apply maximum fee cap
  if (feeAmount > config.maximumUsdc) {
    feeAmount = config.maximumUsdc
  }

  // Safety: fee must never exceed gross amount (hard cap at 10%)
  if (feeAmount >= grossAmount) {
    feeAmount = grossAmount / 10n
  }

  // Net amount — remainder goes to payer, not X.orb
  const netAmount = grossAmount - feeAmount

  return {
    grossAmount, feeAmount, netAmount,
    feeBasisPoints: effectiveBps, feeExempt: false,
  }
}

/** Format micro-USDC to human-readable string: 1000000 → "1.000000" */
export function formatUsdc(microUsdc: bigint): string {
  const whole = microUsdc / 1_000_000n
  const frac = microUsdc % 1_000_000n
  return `${whole}.${frac.toString().padStart(6, '0')}`
}
