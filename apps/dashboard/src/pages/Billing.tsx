import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'
import { api } from '../lib/api'

export function Billing() {
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
  })

  const { data: pricing } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => api.pricing(),
  })

  const agents = agentsData?.agents || []
  const totalActions = agents.reduce((sum: number, a: any) => sum + (a.totalActionsExecuted || 0), 0)
  const freeTierLimit = pricing?.free_tier?.limit || 1000
  const freeTierUsed = Math.min(totalActions, freeTierLimit)
  const paidActions = Math.max(0, totalActions - freeTierLimit)

  // Derive per-action price from pricing endpoints instead of hardcoding
  const perActionPrice = useMemo(() => {
    const endpoints = pricing?.endpoints || []
    const actionEndpoint = endpoints.find((ep: any) =>
      ep.endpoint?.includes('/actions') || ep.endpoint?.includes('execute')
    )
    if (actionEndpoint?.price_usdc) return parseFloat(actionEndpoint.price_usdc)
    // Fallback: average across all priced endpoints
    const priced = endpoints.filter((ep: any) => ep.price_usdc && parseFloat(ep.price_usdc) > 0)
    if (priced.length > 0) {
      return priced.reduce((sum: number, ep: any) => sum + parseFloat(ep.price_usdc), 0) / priced.length
    }
    return 0.005 // last-resort default
  }, [pricing])

  const totalSpent = paidActions * perActionPrice

  return (
    <div>
      <PageHeader title="Billing" description="x402 payment history and usage" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Free Tier Used" value={`${freeTierUsed.toLocaleString()} / ${freeTierLimit.toLocaleString()}`} />
        <MetricCard label="Total Spent (USDC)" value={`$${totalSpent.toFixed(2)}`} />
        <MetricCard label="Paid Actions" value={paidActions.toLocaleString()} />
      </div>

      <div className="glass-card p-5 mb-6">
        <h3 className="text-sm font-medium text-xorb-muted mb-4">Pricing</h3>
        <div className="space-y-2">
          {(pricing?.endpoints || []).map((ep: any) => (
            <div key={ep.endpoint} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2">
              <span className="text-sm font-mono">{ep.endpoint}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-xorb-blue">${ep.price_usdc}</span>
                <span className="text-xs text-xorb-muted">via {ep.via}</span>
                {ep.auth && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">{ep.auth}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-xorb-muted mb-4">Payment History</h3>
        {totalSpent === 0 ? (
          <div className="text-center py-8 text-xorb-muted text-sm">
            No payments yet. First {freeTierLimit.toLocaleString()} actions per month are free via x402.
          </div>
        ) : (
          <div className="text-center py-8 text-xorb-muted text-sm">
            {paidActions.toLocaleString()} paid actions at ${perActionPrice.toFixed(4)}/action = ${totalSpent.toFixed(2)} USDC
          </div>
        )}
      </div>
    </div>
  )
}
