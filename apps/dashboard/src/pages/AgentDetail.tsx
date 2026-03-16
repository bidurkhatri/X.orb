import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pause, Play, XCircle } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'

export function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate('/agents')} className="flex items-center gap-1 text-xorb-muted hover:text-xorb-text text-sm mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to Agents
      </button>

      <PageHeader
        title={`Agent ${id?.slice(0, 16)}...`}
        description="Agent details, actions, and reputation history"
        action={
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-amber/20 text-xorb-amber rounded-lg text-sm hover:bg-xorb-amber/30 transition-colors">
              <Pause size={14} /> Pause
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-green/20 text-xorb-green rounded-lg text-sm hover:bg-xorb-green/30 transition-colors">
              <Play size={14} /> Resume
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-red/20 text-xorb-red rounded-lg text-sm hover:bg-xorb-red/30 transition-colors">
              <XCircle size={14} /> Revoke
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Reputation" value="1000" />
        <MetricCard label="Tier" value="NOVICE" />
        <MetricCard label="Total Actions" value="0" />
        <MetricCard label="Bond (USDC)" value="50.00" />
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-xorb-muted mb-4">Action History</h3>
        <div className="text-center py-8 text-xorb-muted text-sm">
          No actions recorded for this agent yet.
        </div>
      </div>
    </div>
  )
}
