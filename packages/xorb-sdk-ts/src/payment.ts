/**
 * X.orb x402 v2 Payment Integration
 *
 * Uses the official @x402/core + @x402/evm packages for EIP-3009
 * TransferWithAuthorization — no USDC.approve() needed.
 *
 * Usage:
 * ```typescript
 * import { PaymentSigner } from 'xorb-sdk'
 * import { privateKeyToAccount } from 'viem/accounts'
 *
 * const signer = PaymentSigner.fromPrivateKey(process.env.SPONSOR_KEY)
 * // or
 * const signer = PaymentSigner.fromViemAccount(privateKeyToAccount('0x...'))
 * ```
 */

export interface PaymentSignerConfig {
  /** Sponsor's private key (hex, with or without 0x prefix) */
  privateKey: string
  /** Default network for payments (default: 'eip155:137' for Polygon) */
  network?: 'eip155:137' | 'eip155:8453' | string
}

/**
 * Signs x402 v2 payment headers using EIP-3009 TransferWithAuthorization.
 *
 * This replaces the old custom signature scheme. With v2:
 * - No USDC.approve() step needed
 * - Each payment is individually authorized for the exact amount
 * - Compatible with all x402 v2 services in the ecosystem
 */
export class PaymentSigner {
  private _client: unknown = null
  private _config: PaymentSignerConfig

  constructor(config: PaymentSignerConfig) {
    this._config = {
      ...config,
      privateKey: config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`,
      network: config.network || 'eip155:137',
    }
  }

  /**
   * Create a PaymentSigner from a private key string.
   */
  static fromPrivateKey(privateKey: string, network?: string): PaymentSigner {
    return new PaymentSigner({ privateKey, network })
  }

  /**
   * Get the initialized x402 client. Lazy-loaded to avoid import issues.
   */
  async getClient(): Promise<unknown> {
    if (!this._client) {
      const { x402Client } = await import('@x402/core/client')
      const { ExactEvmScheme } = await import('@x402/evm/exact/client')
      const { privateKeyToAccount } = await import('viem/accounts')

      const account = privateKeyToAccount(this._config.privateKey as `0x${string}`)
      const client = new x402Client()
      client.register('eip155:*', new ExactEvmScheme(account))
      this._client = client
    }
    return this._client
  }

  /**
   * Get a fetch function that automatically handles x402 payments.
   * When a 402 response is received, it signs the payment and retries.
   */
  async getPaymentFetch(): Promise<typeof fetch> {
    const client = await this.getClient()
    const { wrapFetchWithPayment } = await import('@x402/fetch')
    return wrapFetchWithPayment(fetch, client as any)
  }

  /** Returns the sponsor's wallet address */
  async getAddress(): Promise<string> {
    const { privateKeyToAccount } = await import('viem/accounts')
    const account = privateKeyToAccount(this._config.privateKey as `0x${string}`)
    return account.address
  }

  /** Returns the default network */
  get network(): string {
    return this._config.network || 'eip155:137'
  }
}
