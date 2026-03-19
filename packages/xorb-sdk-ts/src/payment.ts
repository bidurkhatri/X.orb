import { randomBytes } from 'crypto'

/**
 * Configuration for x402 payment header signing.
 */
export interface PaymentSignerConfig {
  /** Sponsor's private key (hex, with or without 0x prefix) */
  privateKey: string
  /** X.orb facilitator address (defaults to production facilitator) */
  facilitatorAddress?: string
  /** CAIP-2 network identifier (defaults to Polygon PoS) */
  network?: 'eip155:137' | 'eip155:8453' | string
}

/**
 * x402 payment header payload structure.
 */
export interface PaymentHeader {
  signature: string
  amount: string
  network: string
  nonce: string
  expiry: number
  payer: string
}

const DEFAULT_FACILITATOR = '0xF41faE67716670edBFf581aEe37014307dF71A9B'
const DEFAULT_NETWORK = 'eip155:137'
const EXPIRY_SECONDS = 300 // 5 minutes

/**
 * Signs x402 payment headers for X.orb API requests.
 *
 * Usage:
 * ```typescript
 * import { PaymentSigner } from '@xorb/sdk'
 *
 * const signer = new PaymentSigner({
 *   privateKey: process.env.SPONSOR_PRIVATE_KEY!,
 * })
 *
 * const header = await signer.signPaymentHeader('5000') // $0.005 USDC
 * // Use as: headers['x-payment'] = header
 * ```
 */
export class PaymentSigner {
  private privateKey: string
  private facilitatorAddress: string
  private network: string
  private _wallet: unknown = null
  private _ethers: Record<string, unknown> | null = null

  constructor(config: PaymentSignerConfig) {
    this.privateKey = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
    this.facilitatorAddress = config.facilitatorAddress || DEFAULT_FACILITATOR
    this.network = config.network || DEFAULT_NETWORK
  }

  private async getEthers(): Promise<Record<string, any>> {
    if (!this._ethers) {
      this._ethers = await import('ethers')
    }
    return this._ethers
  }

  private async getWallet(): Promise<{ address: string; signMessage: (msg: Uint8Array) => Promise<string> }> {
    if (!this._wallet) {
      const ethers = await this.getEthers()
      this._wallet = new (ethers.Wallet as any)(this.privateKey)
    }
    return this._wallet as { address: string; signMessage: (msg: Uint8Array) => Promise<string> }
  }

  /** Returns the sponsor's wallet address */
  async getAddress(): Promise<string> {
    const wallet = await this.getWallet()
    return wallet.address
  }

  /**
   * Sign an x402 payment header for a given USDC amount.
   *
   * @param amount - USDC amount in micro-units (6 decimals). "5000" = $0.005
   * @param nonce - Optional unique nonce. Auto-generated if not provided.
   * @returns Base64-encoded x-payment header string
   */
  async signPaymentHeader(amount: string, nonce?: string): Promise<string> {
    const ethers = await this.getEthers()
    const wallet = await this.getWallet()

    const paymentNonce = nonce || randomBytes(16).toString('hex')
    const expiry = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS

    // Construct message hash matching X.orb's server-side validation
    const solidityPackedKeccak256 = ethers.solidityPackedKeccak256 as (types: string[], values: unknown[]) => string
    const getBytes = ethers.getBytes as (hex: string) => Uint8Array

    const messageHash = solidityPackedKeccak256(
      ['uint256', 'address', 'string', 'uint256'],
      [amount, this.facilitatorAddress, paymentNonce, expiry]
    )

    // Sign the hash
    const signature = await wallet.signMessage(getBytes(messageHash))

    const payload: PaymentHeader = {
      signature,
      amount,
      network: this.network,
      nonce: paymentNonce,
      expiry,
      payer: wallet.address,
    }

    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }
}
