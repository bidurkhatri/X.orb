const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function getApiKey(): string {
  return localStorage.getItem('xorb_api_key') || ''
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'x-api-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`)
  return data
}

// Agents
export const api = {
  health: () => request<{ status: string; version: string }>('GET', '/v1/health'),

  agents: {
    list: (sponsor?: string, status?: string) => {
      const params = new URLSearchParams()
      if (sponsor) params.set('sponsor', sponsor)
      if (status) params.set('status', status)
      const qs = params.toString()
      return request<{ agents: any[]; count: number }>('GET', `/v1/agents${qs ? '?' + qs : ''}`)
    },
    get: (id: string) => request<{ agent: any }>('GET', `/v1/agents/${id}`),
    register: (body: { name: string; role: string; sponsor_address: string; description?: string }) =>
      request<{ agent: any }>('POST', '/v1/agents', body),
    pause: (id: string, callerAddress: string) =>
      request<{ agent: any }>('PATCH', `/v1/agents/${id}`, { action: 'pause', caller_address: callerAddress }),
    resume: (id: string, callerAddress: string) =>
      request<{ agent: any }>('PATCH', `/v1/agents/${id}`, { action: 'resume', caller_address: callerAddress }),
    revoke: (id: string, callerAddress: string) =>
      request<{ agent: any }>('DELETE', `/v1/agents/${id}`, { caller_address: callerAddress }),
  },

  actions: {
    execute: (body: { agent_id: string; action: string; tool: string; params?: Record<string, unknown> }) =>
      request<any>('POST', '/v1/actions/execute', body),
    batch: (actions: any[]) => request<any>('POST', '/v1/actions/batch', { actions }),
  },

  reputation: {
    get: (agentId: string) => request<any>('GET', `/v1/reputation/${agentId}`),
    leaderboard: () => request<{ agents: any[] }>('GET', '/v1/reputation/leaderboard'),
  },

  events: {
    list: (opts?: { since?: string; type?: string; agent_id?: string; limit?: number }) => {
      const params = new URLSearchParams()
      if (opts?.since) params.set('since', opts.since)
      if (opts?.type) params.set('type', opts.type)
      if (opts?.agent_id) params.set('agent_id', opts.agent_id)
      if (opts?.limit) params.set('limit', opts.limit.toString())
      return request<{ events: any[]; count: number }>('GET', `/v1/events?${params}`)
    },
  },

  webhooks: {
    list: () => request<{ webhooks: any[] }>('GET', '/v1/webhooks'),
    create: (url: string, eventTypes: string[]) =>
      request<any>('POST', '/v1/webhooks', { url, event_types: eventTypes }),
    delete: (id: string) => request<any>('DELETE', `/v1/webhooks/${id}`),
    deliveries: (id: string) => request<any>('GET', `/v1/webhooks/${id}/deliveries`),
  },

  audit: {
    get: (agentId: string) => request<any>('GET', `/v1/audit/${agentId}`),
  },

  compliance: {
    report: (agentId: string, format: string) =>
      request<any>('GET', `/v1/compliance/${agentId}?format=${format}`),
    frameworks: (agentId: string) =>
      request<any>('GET', `/v1/compliance/${agentId}/frameworks`),
  },

  marketplace: {
    listings: () => request<{ listings: any[]; count: number }>('GET', '/v1/marketplace/listings'),
    createListing: (body: any) => request<any>('POST', '/v1/marketplace/listings', body),
    hire: (listingId: string, amount: number) =>
      request<any>('POST', '/v1/marketplace/hire', { listing_id: listingId, escrow_amount_usdc: amount }),
  },

  pricing: () => request<any>('GET', '/v1/pricing'),
}
