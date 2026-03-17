import { useQuery } from '@tanstack/react-query'
import { Bot, Zap, Shield, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'
import { api } from '../lib/api'

export function Overview() {
  const { data: agentsData } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
    retry: false,
  })

  const { data: eventsData } = useQuery({
    queryKey: ['events-recent'],
    queryFn: () => api.events.list({ limit: 20 }),
    retry: false,
    refetchInterval: 5000,
  })

  const agents = agentsData?.agents || []
  const events = eventsData?.events || []
  const activeCount = agents.filter((a: any) => a.status === 'active').length
  const actionsToday = events.filter((e: any) => e.type === 'action.approved' || e.type === 'action.blocked').length
  const blockedToday = events.filter((e: any) => e.type === 'action.blocked').length
  const violations = events.filter((e: any) => e.type === 'agent.slashed').length


  return (
    <div>
      <PageHeader title="Overview" description="X.orb Agent Trust Infrastructure" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active Agents" value={activeCount} change={`${agents.length} total`} changeType="neutral" icon={Bot} />
        <MetricCard label="Actions Today" value={actionsToday} change={`${blockedToday} blocked`} changeType={blockedToday > 0 ? 'negative' : 'neutral'} icon={Zap} />
        <MetricCard label="Violations" value={violations} changeType={violations > 0 ? 'negative' : 'neutral'} icon={Shield} />
        <MetricCard label="Agents Registered" value={agents.length} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Recent Events</h3>
          {events.length === 0 ? (
            <div className="text-center py-8 text-xorb-muted text-sm">
              No events yet. Register an agent to get started.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {events.slice(0, 10).map((event: any) => (
                <div key={event.id} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    event.type === 'action.approved' ? 'bg-xorb-green' :
                    event.type === 'action.blocked' ? 'bg-xorb-red' :
                    event.type.includes('slash') ? 'bg-xorb-amber' : 'bg-xorb-blue'
                  }`} />
                  <span className="flex-1 truncate">{event.type}</span>
                  <span className="text-xs text-xorb-muted font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Orchestrated Services</h3>
          <div className="space-y-3">
            {[
              { name: 'ERC-8004', role: 'Identity', status: 'connected', color: 'text-orange-400' },
              { name: 'AgentScore', role: 'Trust Scoring', status: 'available', color: 'text-purple-400' },
              { name: 'x402', role: 'Payments', status: 'available', color: 'text-blue-400' },
              { name: 'PayCrow', role: 'Escrow', status: 'available', color: 'text-green-400' },
            ].map(svc => (
              <div key={svc.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-xorb-green" />
                  <span className="text-sm font-medium">{svc.name}</span>
                  <span className="text-xs text-xorb-muted">— {svc.role}</span>
                </div>
                <span className={`text-xs font-mono ${svc.color}`}>{svc.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
