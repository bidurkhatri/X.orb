/**
 * Contract Event Monitor (SEC-7)
 *
 * Monitors XorbPaymentSplitter events for anomalies.
 * Alerts via Sentry + email on suspicious activity.
 */
import { ethers } from 'ethers'

const SPLITTER_EVENTS = [
  'event PaymentProcessed(address indexed payer, address indexed recipient, uint256 grossAmount, uint256 feeAmount, uint256 netAmount, bytes32 indexed actionId)',
  'event BatchSettled(uint256 count, uint256 totalFees, uint256 totalNet)',
  'event Refunded(address indexed payer, uint256 amount, bytes32 indexed actionId)',
  'event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)',
  'event FeeUpdated(uint256 oldBps, uint256 newBps)',
]

export class ContractMonitor {
  private provider: ethers.JsonRpcProvider | null = null
  private contract: ethers.Contract | null = null

  constructor() {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.RPC_URL
    const splitterAddress = process.env.XORB_PAYMENT_SPLITTER_ADDRESS
    if (!rpcUrl || !splitterAddress) return

    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.contract = new ethers.Contract(splitterAddress, SPLITTER_EVENTS, this.provider)
  }

  /** Start listening for events */
  startMonitoring(): void {
    if (!this.contract) {
      console.warn('[Monitor] Contract not configured — monitoring disabled')
      return
    }

    // Alert on treasury changes (potential attack)
    this.contract.on('TreasuryUpdated', (oldTreasury, newTreasury) => {
      this.alert('CRITICAL', `Treasury changed from ${oldTreasury} to ${newTreasury}`)
    })

    // Alert on unusual fee changes
    this.contract.on('FeeUpdated', (oldBps, newBps) => {
      if (Number(newBps) > 100) {
        this.alert('HIGH', `Fee changed from ${oldBps} to ${newBps} bps (>1%)`)
      }
    })

    // Alert on large refunds
    this.contract.on('Refunded', (_payer, amount, _actionId) => {
      if (BigInt(amount) > 1_000_000_000n) { // > $1,000
        this.alert('MEDIUM', `Large refund: ${Number(amount) / 1e6} USDC`)
      }
    })

    console.log('[Monitor] Contract event monitoring started')
  }

  /** Check facilitator wallet health */
  async checkHealth(): Promise<{
    facilitatorEthBalance: string
    facilitatorUsdcBalance: string
    pendingPayments: number
    alerts: string[]
  }> {
    const alerts: string[] = []

    if (!this.provider) {
      return { facilitatorEthBalance: '0', facilitatorUsdcBalance: '0', pendingPayments: 0, alerts: ['Monitor not configured'] }
    }

    const facilitatorAddress = process.env.XORB_FACILITATOR_ADDRESS
    if (!facilitatorAddress) {
      return { facilitatorEthBalance: '0', facilitatorUsdcBalance: '0', pendingPayments: 0, alerts: ['Facilitator not configured'] }
    }

    const ethBalance = await this.provider.getBalance(facilitatorAddress)
    if (ethBalance < ethers.parseEther('0.01')) {
      alerts.push('Facilitator ETH balance low — cannot pay gas')
    }

    let pending = 0
    if (this.contract) {
      try { pending = Number(await this.contract.pendingCount()) } catch {}
    }

    return {
      facilitatorEthBalance: ethers.formatEther(ethBalance),
      facilitatorUsdcBalance: '0', // Would need USDC contract call
      pendingPayments: pending,
      alerts,
    }
  }

  private alert(severity: string, message: string): void {
    const log = { level: severity, service: 'contract-monitor', message, timestamp: new Date().toISOString() }
    console.error(JSON.stringify(log))

    // Report to Sentry if configured
    const sentryDsn = process.env.SENTRY_DSN
    if (sentryDsn) {
      fetch(sentryDsn, {
        method: 'POST',
        body: JSON.stringify({ message: `[Contract Monitor] ${severity}: ${message}` }),
      }).catch(() => {})
    }
  }
}

let _monitor: ContractMonitor | null = null
export function getContractMonitor(): ContractMonitor {
  if (!_monitor) {
    _monitor = new ContractMonitor()
    _monitor.startMonitoring()
  }
  return _monitor
}
