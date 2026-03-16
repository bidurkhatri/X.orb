import { Bot, Zap, Shield, TrendingUp } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'

export function Overview() {
  return (
    <div>
      <PageHeader title="Overview" description="X.orb Agent Trust Infrastructure" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active Agents" value="0" change="+0 this week" changeType="neutral" icon={Bot} />
        <MetricCard label="Actions Today" value="0" change="0 blocked" changeType="neutral" icon={Zap} />
        <MetricCard label="Violations" value="0" change="0 this month" changeType="neutral" icon={Shield} />
        <MetricCard label="Pipeline p95" value="—" change="Target: <50ms" changeType="neutral" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Recent Actions</h3>
          <div className="text-center py-8 text-xorb-muted text-sm">
            No actions yet. Register an agent to get started.
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-xorb-muted mb-4">Reputation Distribution</h3>
          <div className="space-y-3">
            {['ELITE', 'TRUSTED', 'RELIABLE', 'NOVICE', 'UNTRUSTED'].map(tier => (
              <div key={tier} className="flex items-center gap-3">
                <span className="text-xs text-xorb-muted w-20">{tier}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-xorb-blue/40 rounded-full" style={{ width: '0%' }} />
                </div>
                <span className="text-xs font-mono text-xorb-muted w-8">0</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
