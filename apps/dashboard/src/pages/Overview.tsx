import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Bot, Zap, Shield, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'
import { api } from '../lib/api'

type SortKey = 'score' | 'actions' | 'name'

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

  const navigate = useNavigate()
  const [leaderboardSort, setLeaderboardSort] = useState<SortKey>('score')

  const agents = agentsData?.agents || []
  const events = eventsData?.events || []
  const activeCount = agents.filter((a: any) => a.status === 'active').length
  const actionsToday = events.filter((e: any) => e.type === 'action.approved' || e.type === 'action.blocked').length
  const blockedToday = events.filter((e: any) => e.type === 'action.blocked').length
  const violations = events.filter((e: any) => e.type === 'agent.slashed').length

  // Sort agents for the leaderboard
  const sortedAgents = useMemo(() => {
    const sorted = [...agents]
    switch (leaderboardSort) {
      case 'score':
        return sorted.sort((a: any, b: any) => (b.trustScore ?? b.reputation ?? 0) - (a.trustScore ?? a.reputation ?? 0))
      case 'actions':
        return sorted.sort((a: any, b: any) => (b.totalActionsExecuted ?? 0) - (a.totalActionsExecuted ?? 0))
      case 'name':
        return sorted.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
    }
  }, [agents, leaderboardSort])

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
              { name: 'DJD Agent Score', role: 'Trust Scoring', status: 'available', color: 'text-purple-400' },
              { name: 'x402', role: 'Payments', status: 'available', color: 'text-blue-400' },
              { name: 'Xorb Escrow', role: 'Escrow', status: 'available', color: 'text-green-400' },
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

      {/* Agent Leaderboard */}
      {agents.length > 0 && (
        <div className="glass-card p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-xorb-muted">Agent Leaderboard</h3>
            <select
              value={leaderboardSort}
              onChange={e => setLeaderboardSort(e.target.value as SortKey)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-xorb-blue/50 transition-colors"
            >
              <option value="score">Sort by Score</option>
              <option value="actions">Sort by Actions</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
          <div className="space-y-1">
            <div className="grid grid-cols-[2rem_1fr_5rem_5rem_4.5rem] gap-2 px-2 py-1 text-xs text-xorb-muted uppercase tracking-wider">
              <span>#</span>
              <span>Agent</span>
              <span className="text-right">Score</span>
              <span className="text-right">Actions</span>
              <span className="text-right">Status</span>
            </div>
            {sortedAgents.slice(0, 10).map((a: any, i: number) => (
              <div
                key={a.agentId}
                onClick={() => navigate(`/agents/${a.agentId}`)}
                className="grid grid-cols-[2rem_1fr_5rem_5rem_4.5rem] gap-2 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-sm items-center"
              >
                <span className="text-xorb-muted font-mono text-xs">{i + 1}</span>
                <div className="truncate">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-xorb-muted ml-2">{a.scope || a.role}</span>
                </div>
                <span className="font-mono text-right">{a.trustScore ?? a.reputation ?? '—'}</span>
                <span className="font-mono text-right">{a.totalActionsExecuted ?? 0}</span>
                <span className={`text-right text-xs ${a.status === 'active' ? 'text-xorb-green' : a.status === 'paused' ? 'text-xorb-amber' : 'text-xorb-red'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
