import type {
  XorbConfig, Agent, CreateAgentParams, ExecuteActionParams,
  PipelineResult, ReputationInfo, WebhookSubscription, AuditLog,
  PricingEndpoint, XorbError,
} from './types'

export class XorbClient {
  private baseUrl: string
  private apiKey: string
  private timeout: number

  public agents: AgentsAPI
  public actions: ActionsAPI
  public reputation: ReputationAPI
  public webhooks: WebhooksAPI
  public audit: AuditAPI
  public marketplace: MarketplaceAPI

  constructor(config: XorbConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 30000

    this.agents = new AgentsAPI(this)
    this.actions = new ActionsAPI(this)
    this.reputation = new ReputationAPI(this)
    this.webhooks = new WebhooksAPI(this)
    this.audit = new AuditAPI(this)
    this.marketplace = new MarketplaceAPI(this)
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'Content-Type': 'application/json',
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    })

    const data = await res.json()

    if (!res.ok) {
      const err = data as XorbError
      throw new XorbAPIError(err.error || 'Request failed', res.status, err.request_id)
    }

    return data as T
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
    return this.client.request('POST', '/v1/agents', params)
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

  async pause(agentId: string, callerAddress: string): Promise<{ agent: Agent }> {
    return this.client.request('PATCH', `/v1/agents/${agentId}`, {
      action: 'pause', caller_address: callerAddress,
    })
  }

  async resume(agentId: string, callerAddress: string): Promise<{ agent: Agent }> {
    return this.client.request('PATCH', `/v1/agents/${agentId}`, {
      action: 'resume', caller_address: callerAddress,
    })
  }

  async revoke(agentId: string, callerAddress: string): Promise<{ agent: Agent }> {
    return this.client.request('DELETE', `/v1/agents/${agentId}`, {
      caller_address: callerAddress,
    })
  }
}

class ActionsAPI {
  constructor(private client: XorbClient) {}

  async execute(params: ExecuteActionParams): Promise<PipelineResult> {
    return this.client.request('POST', '/v1/actions/execute', params)
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

class MarketplaceAPI {
  constructor(private client: XorbClient) {}

  async createListing(params: { agent_id: string; rate_usdc_per_hour?: number; rate_usdc_per_action?: number; description: string }): Promise<unknown> {
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
