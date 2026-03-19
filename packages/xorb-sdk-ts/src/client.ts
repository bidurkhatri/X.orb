import type {
  XorbConfig, Agent, CreateAgentParams, ExecuteActionParams,
  PipelineResult, ReputationInfo, WebhookSubscription, AuditLog,
  PricingEndpoint, XorbError,
} from './types'
import type { PaymentSigner } from './payment'

export class XorbClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number
  /** Optional x402 payment signer for automatic payment header generation */
  public signer?: PaymentSigner

  public agents: AgentsAPI
  public actions: ActionsAPI
  public reputation: ReputationAPI
  public webhooks: WebhooksAPI
  public audit: AuditAPI
  public marketplace: MarketplaceAPI
  public compliance: ComplianceAPI
  public events: EventsAPI
  public payments: PaymentsAPI

  constructor(config: XorbConfig & { signer?: PaymentSigner }) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 30000
    this.signer = config.signer

    this.agents = new AgentsAPI(this)
    this.actions = new ActionsAPI(this)
    this.reputation = new ReputationAPI(this)
    this.webhooks = new WebhooksAPI(this)
    this.audit = new AuditAPI(this)
    this.marketplace = new MarketplaceAPI(this)
    this.compliance = new ComplianceAPI(this)
    this.events = new EventsAPI(this)
    this.payments = new PaymentsAPI(this)
  }

  async request<T>(method: string, path: string, body?: unknown, retries = 3, paymentHeader?: string): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    }
    if (paymentHeader) {
      headers['x-payment'] = paymentHeader
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.timeout),
        })

        const raw = await res.json()

        // Unwrap standard envelope: { success, data, error }
        const envelope = raw as { success?: boolean; data?: unknown; error?: { code: string; message: string } }

        if (!res.ok) {
          const message = envelope.error?.message || (raw as XorbError).error || 'Request failed'
          const apiError = new XorbAPIError(message, res.status, (raw as XorbError).request_id)
          if (res.status < 500) throw apiError
          lastError = apiError
        } else {
          // Unwrap: if response has { success, data }, return data; otherwise return raw
          const result = envelope.success !== undefined && envelope.data !== undefined
            ? envelope.data
            : raw
          return result as T
        }
      } catch (err) {
        if (err instanceof XorbAPIError && err.status < 500) throw err
        lastError = err instanceof Error ? err : new Error(String(err))
      }

      // Exponential backoff before retry
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500))
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  async health(): Promise<{ status: string; version: string }> {
    return this.request('GET', '/v1/health')
  }

  async pricing(): Promise<{ endpoints: PricingEndpoint[]; free_tier: { limit: number; period: string } }> {
    return this.request('GET', '/v1/pricing')
  }
}

export class XorbAPIError extends Error {
  status: number
  requestId?: string

  constructor(message: string, status: number, requestId?: string) {
    super(message)
    this.name = 'XorbAPIError'
    this.status = status
    this.requestId = requestId
  }
}

// --- Sub-APIs ---

class AgentsAPI {
  constructor(private client: XorbClient) {}

  async register(params: CreateAgentParams): Promise<{ agent: Agent }> {
    const header = this.client.signer
      ? await this.client.signer.signPaymentHeader('100000') // $0.10 registration fee
      : undefined
    return this.client.request('POST', '/v1/agents', params, 3, header)
  }

  async list(opts?: { sponsor?: string; status?: string }): Promise<{ agents: Agent[]; count: number }> {
    const query = new URLSearchParams()
    if (opts?.sponsor) query.set('sponsor', opts.sponsor)
    if (opts?.status) query.set('status', opts.status)
    const qs = query.toString()
    return this.client.request('GET', `/v1/agents${qs ? '?' + qs : ''}`)
  }

  async get(agentId: string): Promise<{ agent: Agent }> {
    return this.client.request('GET', `/v1/agents/${agentId}`)
  }

  async pause(agentId: string): Promise<{ agent: Agent }> {
    return this.client.request('PATCH', `/v1/agents/${agentId}`, { action: 'pause' })
  }

  async resume(agentId: string): Promise<{ agent: Agent }> {
    return this.client.request('PATCH', `/v1/agents/${agentId}`, { action: 'resume' })
  }

  async revoke(agentId: string): Promise<{ agent: Agent }> {
    return this.client.request('DELETE', `/v1/agents/${agentId}`)
  }

  async renew(agentId: string, renewDays?: number): Promise<{ agent: Agent }> {
    return this.client.request('PATCH', `/v1/agents/${agentId}`, {
      action: 'renew', renew_days: renewDays || 30,
    })
  }
}

class ActionsAPI {
  constructor(private client: XorbClient) {}

  async execute(params: ExecuteActionParams, amountUsdc?: string): Promise<PipelineResult> {
    const header = this.client.signer
      ? await this.client.signer.signPaymentHeader(amountUsdc || '5000') // $0.005 default
      : undefined
    return this.client.request('POST', '/v1/actions/execute', params, 3, header)
  }

  async batch(actions: ExecuteActionParams[]): Promise<{
    total: number; approved: number; blocked: number; results: PipelineResult[]
  }> {
    return this.client.request('POST', '/v1/actions/batch', { actions })
  }
}

class ReputationAPI {
  constructor(private client: XorbClient) {}

  async get(agentId: string): Promise<ReputationInfo> {
    return this.client.request('GET', `/v1/reputation/${agentId}`)
  }

  async leaderboard(): Promise<{ agents: Array<{ agent_id: string; name: string; score: number; tier: string }> }> {
    return this.client.request('GET', '/v1/reputation/leaderboard')
  }
}

class WebhooksAPI {
  constructor(private client: XorbClient) {}

  async subscribe(url: string, eventTypes: string[]): Promise<WebhookSubscription> {
    return this.client.request('POST', '/v1/webhooks', { url, event_types: eventTypes })
  }

  async list(): Promise<{ webhooks: WebhookSubscription[] }> {
    return this.client.request('GET', '/v1/webhooks')
  }

  async delete(webhookId: string): Promise<{ deleted: boolean }> {
    return this.client.request('DELETE', `/v1/webhooks/${webhookId}`)
  }

  async deliveries(webhookId: string): Promise<{ deliveries: unknown[] }> {
    return this.client.request('GET', `/v1/webhooks/${webhookId}/deliveries`)
  }
}

class AuditAPI {
  constructor(private client: XorbClient) {}

  async get(agentId: string): Promise<AuditLog> {
    return this.client.request('GET', `/v1/audit/${agentId}`)
  }
}

class ComplianceAPI {
  constructor(private client: XorbClient) {}

  async report(agentId: string, format: 'eu-ai-act' | 'nist-ai-rmf' | 'soc2' = 'eu-ai-act'): Promise<unknown> {
    return this.client.request('GET', `/v1/compliance/${agentId}?format=${format}`)
  }

  async frameworks(agentId: string): Promise<{ frameworks: Array<{ id: string; name: string; description: string }> }> {
    return this.client.request('GET', `/v1/compliance/${agentId}/frameworks`)
  }
}

class EventsAPI {
  constructor(private client: XorbClient) {}

  async list(opts?: { agent_id?: string; type?: string; since?: string; limit?: number }): Promise<{ events: unknown[]; count: number }> {
    const query = new URLSearchParams()
    if (opts?.agent_id) query.set('agent_id', opts.agent_id)
    if (opts?.type) query.set('type', opts.type)
    if (opts?.since) query.set('since', opts.since)
    if (opts?.limit) query.set('limit', opts.limit.toString())
    return this.client.request('GET', `/v1/events?${query}`)
  }
}

class MarketplaceAPI {
  constructor(private client: XorbClient) {}

  async createListing(params: {
    agent_id: string
    price_per_unit: string  // BigInt as string (USDC, 6 decimals)
    pricing_model: 'PerHour' | 'PerDay' | 'PerTask'
    description: string
  }): Promise<unknown> {
    return this.client.request('POST', '/v1/marketplace/listings', params)
  }

  async listings(): Promise<{ listings: unknown[]; count: number }> {
    return this.client.request('GET', '/v1/marketplace/listings')
  }

  async hire(listingId: string, escrowAmountUsdc: number): Promise<unknown> {
    return this.client.request('POST', '/v1/marketplace/hire', {
      listing_id: listingId, escrow_amount_usdc: escrowAmountUsdc,
    })
  }
}

class PaymentsAPI {
  constructor(private client: XorbClient) {}

  /** Get billing usage for the authenticated sponsor */
  async usage(): Promise<unknown> {
    return this.client.request('GET', '/v1/billing/usage')
  }

  /** Get wallet readiness status */
  async walletStatus(): Promise<unknown> {
    return this.client.request('GET', '/v1/billing/wallet-status')
  }

  /** Get payment history */
  async history(opts?: { limit?: number; cursor?: string }): Promise<unknown> {
    const query = new URLSearchParams()
    if (opts?.limit) query.set('limit', opts.limit.toString())
    if (opts?.cursor) query.set('cursor', opts.cursor)
    return this.client.request('GET', `/v1/payments?${query}`)
  }

  /** Get payment receipt */
  async receipt(actionId: string): Promise<unknown> {
    return this.client.request('GET', `/v1/payments/${actionId}/receipt`)
  }

  /** Set spending caps */
  async setSpendingCaps(daily?: string, monthly?: string): Promise<unknown> {
    return this.client.request('PUT', '/v1/billing/spending-caps', {
      daily_spend_cap_usdc: daily, monthly_spend_cap_usdc: monthly,
    })
  }
}

export class WalletHelpers {
  /** Generate USDC.approve() transaction data for the facilitator address */
  static approveUsdcData(facilitatorAddress: string, amount: bigint = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')): { to: string, data: string } {
    // ERC-20 approve(address,uint256) selector = 0x095ea7b3
    const paddedAddr = facilitatorAddress.slice(2).padStart(64, '0')
    const paddedAmount = amount.toString(16).padStart(64, '0')
    return {
      to: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
      data: `0x095ea7b3${paddedAddr}${paddedAmount}`,
    }
  }

  /** Generate USDC.allowance() call data to check current approval */
  static checkAllowanceData(ownerAddress: string, facilitatorAddress: string): { to: string, data: string } {
    // ERC-20 allowance(address,address) selector = 0xdd62ed3e
    const paddedOwner = ownerAddress.slice(2).padStart(64, '0')
    const paddedSpender = facilitatorAddress.slice(2).padStart(64, '0')
    return {
      to: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      data: `0xdd62ed3e${paddedOwner}${paddedSpender}`,
    }
  }
}
