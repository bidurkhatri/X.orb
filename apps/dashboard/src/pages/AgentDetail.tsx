import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pause, Play, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'
import { CardGridSkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'

export function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)

  const { data: agentData, isLoading } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => api.agents.get(id!),
    enabled: !!id,
    retry: false,
  })

  const { data: auditData } = useQuery({
    queryKey: ['audit', id],
    queryFn: () => api.audit.get(id!),
    enabled: !!id,
    retry: false,
  })

  const pauseMutation = useMutation({
    mutationFn: () => api.agents.pause(id!, (agentData?.agent || agentData)?.sponsorAddress || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      toast.success('Agent paused')
    },
    onError: () => toast.error('Failed to pause agent. Please try again.'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => api.agents.resume(id!, (agentData?.agent || agentData)?.sponsorAddress || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      toast.success('Agent resumed')
    },
    onError: () => toast.error('Failed to resume agent. Please try again.'),
  })

  const revokeMutation = useMutation({
    mutationFn: () => api.agents.revoke(id!, (agentData?.agent || agentData)?.sponsorAddress || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', id] })
      toast.success('Agent revoked')
    },
    onError: () => toast.error('Failed to revoke agent. Please try again.'),
  })

  const agent = agentData?.agent || agentData
  const audit = auditData

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse bg-white/10 rounded" />
      <CardGridSkeleton count={4} />
    </div>
  )
  if (!agent) return <div className="text-xorb-muted p-8">Agent not found.</div>

  const bondUsdc = (parseInt(agent.stakeBond || '0') / 1_000_000).toFixed(2)

  return (
    <div>
      <button onClick={() => navigate('/agents')} className="flex items-center gap-1 text-xorb-muted hover:text-xorb-text text-sm mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to Agents
      </button>

      <PageHeader
        title={agent.name}
        description={`${agent.role} · ${agent.agentId}`}
        action={
          <div className="flex gap-2">
            {agent.status === 'active' && (
              <button onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-amber/20 text-xorb-amber rounded-lg text-sm hover:bg-xorb-amber/30 transition-colors disabled:opacity-50">
                <Pause size={14} /> {pauseMutation.isPending ? '...' : 'Pause'}
              </button>
            )}
            {agent.status === 'paused' && (
              <button onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-green/20 text-xorb-green rounded-lg text-sm hover:bg-xorb-green/30 transition-colors disabled:opacity-50">
                <Play size={14} /> {resumeMutation.isPending ? '...' : 'Resume'}
              </button>
            )}
            {agent.status !== 'revoked' && !showRevokeConfirm && (
              <button onClick={() => setShowRevokeConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-red/20 text-xorb-red rounded-lg text-sm hover:bg-xorb-red/30 transition-colors">
                <XCircle size={14} /> Revoke
              </button>
            )}
            {showRevokeConfirm && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-xs text-red-400">Permanently revoke? Bond will be slashed.</span>
                <button onClick={() => { revokeMutation.mutate(); setShowRevokeConfirm(false) }}
                  disabled={revokeMutation.isPending}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {revokeMutation.isPending ? '...' : 'Confirm'}
                </button>
                <button onClick={() => setShowRevokeConfirm(false)}
                  className="px-2 py-1 bg-white/10 rounded text-xs hover:bg-white/20">
                  Cancel
                </button>
              </div>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-3 mb-6">
        <span className={agent.status === 'active' ? 'badge-active' : agent.status === 'paused' ? 'badge-paused' : 'badge-revoked'}>
          {agent.status}
        </span>
        <span className="badge-tier">{agent.trustSource || agent.reputationTier}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/*
         * Backward compat: the API returns both `trustScore` (canonical) and `reputation`
         * (legacy field). Older SDK versions (<= 0.2.x) only send `reputation`, so we
         * fall back to it to avoid showing undefined for agents registered via older clients.
         */}
        <MetricCard label="Trust Score" value={agent.trustScore ?? agent.reputation} />
        <MetricCard label="Trust Source" value={agent.trustSource || 'local'} />
        <MetricCard label="Bond (USDC)" value={`$${bondUsdc}`} />
        <MetricCard label="Slash Events" value={agent.slashEvents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Recent Events</h3>
          {(audit?.recent_events || []).length === 0 ? (
            <div className="text-center py-8 text-xorb-muted text-sm">No events recorded.</div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(audit.recent_events as Array<Record<string, string>>).slice(0, 20).map((e, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    e.type?.includes('approved') ? 'bg-xorb-green' :
                    e.type?.includes('blocked') ? 'bg-xorb-red' : 'bg-xorb-blue'
                  }`} />
                  <span className="flex-1 truncate">{e.type}</span>
                  <span className="text-xs text-xorb-muted font-mono">{e.timestamp ? new Date(e.timestamp).toLocaleTimeString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Violations</h3>
          {(audit?.violations?.count || 0) === 0 ? (
            <div className="text-center py-8 text-xorb-muted text-sm">No violations. Clean record.</div>
          ) : (
            <div>
              <div className="text-2xl font-mono font-semibold mb-2">{audit.violations.count}</div>
              <div className="text-sm text-xorb-muted">Total slashed: ${(parseInt(audit.violations.total_slashed || '0') / 1_000_000).toFixed(2)} USDC</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
