/**
 * PaymentService — Handles on-chain USDC payment flow.
 *
 * Implements the facilitator pattern:
 * 1. collectPayment: payer → facilitator (via ERC-20 transferFrom)
 * 2. splitAndForward: facilitator → treasury (fee) + facilitator → recipient (net)
 * 3. refund: facilitator → payer (full gross on rejection)
 *
 * All amounts in USDC micro-units (6 decimals). All arithmetic uses BigInt.
 */
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'

// Standard ERC-20 ABI (only the functions we need)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
]

// USDC contract addresses by chain
const USDC_ADDRESSES: Record<string, string> = {
  'eip155:137': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',   // Polygon PoS
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base
}

export interface PaymentRecord {
  id?: string
  action_id: string
  agent_id: string
  sponsor_address: string
  payer_address: string
  recipient_address: string
  gross_amount: string       // BigInt as string
  fee_amount: string
  net_amount: string
  fee_basis_points: number
  fee_exempt: boolean
  fee_exempt_reason?: string
  collect_tx_hash?: string
  fee_tx_hash?: string
  forward_tx_hash?: string
  refund_tx_hash?: string
  status: 'held' | 'completed' | 'escrowed' | 'refunded' | 'failed'
  refund_reason?: string
  chain: string
  nonce_hash: string
  fee_matures_at?: string
  created_at?: string
  completed_at?: string
  refunded_at?: string
}

let _provider: ethers.JsonRpcProvider | null = null
let _facilitatorWallet: ethers.Wallet | null = null
let _supabase: ReturnType<typeof createClient> | null = null

function getProvider(): ethers.JsonRpcProvider | null {
  if (!_provider) {
    const rpcUrl = process.env.POLYGON_RPC_URL || process.env.RPC_URL
    if (!rpcUrl) return null
    _provider = new ethers.JsonRpcProvider(rpcUrl)
  }
  return _provider
}

function getFacilitatorWallet(): ethers.Wallet | null {
  if (!_facilitatorWallet) {
    const key = process.env.XORB_FACILITATOR_PRIVATE_KEY
    const provider = getProvider()
    if (!key || !provider) return null
    _facilitatorWallet = new ethers.Wallet(key, provider)
  }
  return _facilitatorWallet
}

function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (url && key) _supabase = createClient(url, key)
  }
  return _supabase
}

// XorbPaymentSplitter ABI (batch mode)
const SPLITTER_ABI = [
  'function processPayment(address payer, address recipient, uint256 grossAmount, bytes32 actionId) external returns (uint256 feeAmount, uint256 netAmount)',
  'function collectAndQueue(address payer, address recipient, uint256 grossAmount, uint256 feeBps, bytes32 actionId) external',
  'function settleBatch(uint256 maxCount) external',
  'function refundQueued(bytes32 actionId) external',
  'function pendingCount() external view returns (uint256)',
  'event BatchSettled(uint256 count, uint256 totalFees, uint256 totalNet)',
]

const IMMEDIATE_THRESHOLD = BigInt(process.env.IMMEDIATE_PAYMENT_THRESHOLD || '100000000') // $100 default

function getChainId(): string {
  return process.env.XORB_CHAIN || 'eip155:137'
}

function getSplitterContract(): ethers.Contract | null {
  const address = process.env.XORB_PAYMENT_SPLITTER_ADDRESS
  if (!address) return null
  const wallet = getFacilitatorWallet()
  if (!wallet) return null
  return new ethers.Contract(address, SPLITTER_ABI, wallet)
}

function getUsdcContract(): ethers.Contract | null {
  const wallet = getFacilitatorWallet()
  if (!wallet) return null
  const chain = getChainId()
  const usdcAddress = USDC_ADDRESSES[chain]
  if (!usdcAddress) return null
  return new ethers.Contract(usdcAddress, ERC20_ABI, wallet)
}

export class PaymentService {
  /** Check payer's USDC allowance for the facilitator wallet */
  async checkAllowance(payerAddress: string): Promise<bigint> {
    const usdc = getUsdcContract()
    const wallet = getFacilitatorWallet()
    if (!usdc || !wallet) return 0n
    try {
      return await usdc.allowance(payerAddress, wallet.address)
    } catch (err) {
      console.error('[PaymentService] checkAllowance failed:', err)
      return 0n
    }
  }

  /** Check an address's USDC balance */
  async getBalance(address: string): Promise<bigint> {
    const usdc = getUsdcContract()
    if (!usdc) return 0n
    try {
      return await usdc.balanceOf(address)
    } catch (err) {
      console.error('[PaymentService] getBalance failed:', err)
      return 0n
    }
  }

  /** Get the facilitator wallet address */
  getFacilitatorAddress(): string | null {
    const wallet = getFacilitatorWallet()
    return wallet?.address || process.env.XORB_FACILITATOR_ADDRESS || null
  }

  /** Get the treasury wallet address */
  getTreasuryAddress(): string {
    return process.env.XORB_TREASURY_ADDRESS || ''
  }

  /** Execute USDC.transferFrom: payer → facilitator (requires prior ERC-20 approval) */
  async collectPayment(payerAddress: string, amount: bigint): Promise<{ txHash: string }> {
    const usdc = getUsdcContract()
    const wallet = getFacilitatorWallet()
    if (!usdc || !wallet) {
      throw new Error('Payment infrastructure not configured (missing XORB_FACILITATOR_PRIVATE_KEY or RPC_URL)')
    }

    // Verify allowance
    const allowance = await usdc.allowance(payerAddress, wallet.address)
    if (BigInt(allowance) < amount) {
      throw new Error(`Insufficient USDC allowance: ${allowance} < ${amount}. Payer must call USDC.approve(${wallet.address}, amount) first.`)
    }

    // Verify balance
    const balance = await usdc.balanceOf(payerAddress)
    if (BigInt(balance) < amount) {
      throw new Error(`Insufficient USDC balance: ${balance} < ${amount}`)
    }

    // Execute transferFrom
    const tx = await usdc.transferFrom(payerAddress, wallet.address, amount)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  }

  /** Split: facilitator → treasury (fee) + facilitator → recipient (net) */
  async splitAndForward(
    recipientAddress: string,
    grossAmount: bigint,
    feeAmount: bigint,
  ): Promise<{ feeTxHash: string; forwardTxHash: string }> {
    const usdc = getUsdcContract()
    if (!usdc) throw new Error('Payment infrastructure not configured')

    const treasury = this.getTreasuryAddress()
    if (!treasury) throw new Error('XORB_TREASURY_ADDRESS not configured')

    const netAmount = grossAmount - feeAmount

    // Transfer fee to treasury
    let feeTxHash = ''
    if (feeAmount > 0n) {
      const feeTx = await usdc.transfer(treasury, feeAmount)
      const feeReceipt = await feeTx.wait()
      feeTxHash = feeReceipt.hash
    }

    // Transfer net to recipient
    let forwardTxHash = ''
    if (netAmount > 0n) {
      const forwardTx = await usdc.transfer(recipientAddress, netAmount)
      const forwardReceipt = await forwardTx.wait()
      forwardTxHash = forwardReceipt.hash
    }

    return { feeTxHash, forwardTxHash }
  }

  /** Refund: facilitator → payer (full gross amount) */
  async refund(payerAddress: string, amount: bigint): Promise<{ txHash: string }> {
    const usdc = getUsdcContract()
    if (!usdc) throw new Error('Payment infrastructure not configured')

    const tx = await usdc.transfer(payerAddress, amount)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  }

  // --- Batch Mode (via XorbPaymentSplitter contract) ---

  /** Process via splitter contract: immediate mode for high-value, batch for rest */
  async processViaSplitter(
    payerAddress: string,
    recipientAddress: string,
    grossAmount: bigint,
    feeBps: number,
    actionId: string,
  ): Promise<{ mode: 'immediate' | 'batch'; txHash?: string }> {
    const splitter = getSplitterContract()
    if (!splitter) {
      // Fallback to direct mode if splitter not deployed
      return { mode: 'immediate' }
    }

    const actionBytes = ethers.encodeBytes32String(actionId.slice(0, 31))

    if (grossAmount >= IMMEDIATE_THRESHOLD) {
      // Immediate: atomic collect + split + forward
      const tx = await splitter.processPayment(payerAddress, recipientAddress, grossAmount, actionBytes)
      const receipt = await tx.wait()
      return { mode: 'immediate', txHash: receipt.hash }
    } else {
      // Batch: collect and queue for later settlement
      const tx = await splitter.collectAndQueue(payerAddress, recipientAddress, grossAmount, feeBps, actionBytes)
      const receipt = await tx.wait()
      return { mode: 'batch', txHash: receipt.hash }
    }
  }

  /** Settle all pending batch payments (called by cron every 5 min) */
  async settleBatch(): Promise<{ count: number; totalFees: bigint; totalNet: bigint; tx?: string }> {
    const splitter = getSplitterContract()
    if (!splitter) return { count: 0, totalFees: 0n, totalNet: 0n }

    const pending = await splitter.pendingCount()
    if (BigInt(pending) === 0n) return { count: 0, totalFees: 0n, totalNet: 0n }

    const maxBatch = parseInt(process.env.BATCH_SETTLEMENT_THRESHOLD || '100')
    const tx = await splitter.settleBatch(maxBatch)
    const receipt = await tx.wait()

    // Parse BatchSettled event
    const event = receipt.logs.find((l: any) => {
      try { return splitter.interface.parseLog(l)?.name === 'BatchSettled' } catch { return false }
    })
    const parsed = event ? splitter.interface.parseLog(event) : null

    return {
      count: parsed ? Number(parsed.args[0]) : 0,
      totalFees: parsed ? BigInt(parsed.args[1]) : 0n,
      totalNet: parsed ? BigInt(parsed.args[2]) : 0n,
      tx: receipt.hash,
    }
  }

  /** Refund a queued payment via splitter contract */
  async refundQueued(actionId: string): Promise<{ txHash: string }> {
    const splitter = getSplitterContract()
    if (!splitter) throw new Error('Payment splitter not configured')

    const actionBytes = ethers.encodeBytes32String(actionId.slice(0, 31))
    const tx = await splitter.refundQueued(actionBytes)
    const receipt = await tx.wait()
    return { txHash: receipt.hash }
  }

  /** Get treasury USDC balance */
  async getTreasuryBalance(): Promise<bigint> {
    const treasury = this.getTreasuryAddress()
    if (!treasury) return 0n
    return this.getBalance(treasury)
  }

  /** Record a payment in Supabase */
  async recordPayment(record: PaymentRecord): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    // @ts-expect-error — Supabase client not typed for payments schema
    const { error } = await sb.from('payments').insert(record)
    if (error) console.error('[PaymentService] recordPayment failed:', error.message)
  }

  /** Update a payment record */
  async updatePayment(actionId: string, updates: Partial<PaymentRecord>): Promise<void> {
    const sb = getSupabase()
    if (!sb) return
    // @ts-expect-error — Supabase client not typed for our schema
    await sb.from('payments').update(updates).eq('action_id', actionId)
  }

  /** Get payment by action ID */
  async getPayment(actionId: string): Promise<PaymentRecord | null> {
    const sb = getSupabase()
    if (!sb) return null
    const { data } = await sb.from('payments').select('*').eq('action_id', actionId).single()
    return data as PaymentRecord | null
  }

  /** Get payments for a sponsor */
  async getPaymentsBySponsor(sponsorAddress: string, opts?: { limit?: number; cursor?: string }): Promise<{
    data: PaymentRecord[]
    next_cursor?: string
    has_more: boolean
  }> {
    const sb = getSupabase()
    if (!sb) return { data: [], has_more: false }
    const limit = opts?.limit || 20
    let query = sb.from('payments').select('*')
      .eq('sponsor_address', sponsorAddress)
      .order('created_at', { ascending: false })
      .limit(limit + 1)
    if (opts?.cursor) query = query.lt('created_at', opts.cursor)
    const { data } = await query
    const rows = (data || []) as (PaymentRecord & { created_at: string })[]
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    return {
      data: page,
      next_cursor: hasMore ? page[page.length - 1].created_at : undefined,
      has_more: hasMore,
    }
  }

  /** Get sponsor's monthly usage count */
  async getMonthlyUsage(sponsorAddress: string): Promise<number> {
    const sb = getSupabase()
    if (!sb) return 0
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const { count } = await sb
      .from('agent_actions')
      .select('*', { count: 'exact', head: true })
      .eq('sponsor_address', sponsorAddress)
      .gte('created_at', monthStart.toISOString())
    return count || 0
  }

  /** Get revenue summary */
  async getRevenueSummary(period: 'today' | 'month' | 'all'): Promise<{
    actions: number
    gross_volume: bigint
    fees_collected: bigint
    refunds: bigint
    net_revenue: bigint
  }> {
    const sb = getSupabase()
    if (!sb) return { actions: 0, gross_volume: 0n, fees_collected: 0n, refunds: 0n, net_revenue: 0n }

    let since: string
    const now = new Date()
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else {
      since = '2020-01-01T00:00:00Z'
    }

    const { data: completed } = await sb.from('payments').select('gross_amount, fee_amount')
      .eq('status', 'completed').gte('created_at', since) as { data: Array<{ gross_amount: string; fee_amount: string }> | null }
    const { data: refunded } = await sb.from('payments').select('gross_amount')
      .eq('status', 'refunded').gte('created_at', since) as { data: Array<{ gross_amount: string }> | null }

    let grossVolume = 0n, feesCollected = 0n, refundTotal = 0n
    for (const p of (completed || [])) {
      grossVolume += BigInt(p.gross_amount)
      feesCollected += BigInt(p.fee_amount)
    }
    for (const r of (refunded || [])) {
      refundTotal += BigInt(r.gross_amount)
    }

    return {
      actions: (completed || []).length,
      gross_volume: grossVolume,
      fees_collected: feesCollected,
      refunds: refundTotal,
      net_revenue: feesCollected,
    }
  }

  /** Check if payment infra is configured */
  isConfigured(): boolean {
    return !!(
      process.env.XORB_FACILITATOR_PRIVATE_KEY &&
      (process.env.POLYGON_RPC_URL || process.env.RPC_URL) &&
      process.env.XORB_TREASURY_ADDRESS
    )
  }
}

// Singleton
let _paymentService: PaymentService | null = null
export function getPaymentService(): PaymentService {
  if (!_paymentService) _paymentService = new PaymentService()
  return _paymentService
}
