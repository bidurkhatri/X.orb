import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon?: LucideIcon
}

export function MetricCard({ label, value, change, changeType = 'neutral', icon: Icon }: MetricCardProps) {
  const changeColor = changeType === 'positive' ? 'text-xorb-green' : changeType === 'negative' ? 'text-xorb-red' : 'text-xorb-muted'

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xorb-muted text-sm">{label}</span>
        {Icon && <Icon size={18} className="text-xorb-muted" />}
      </div>
      <div className="text-2xl font-semibold font-mono">{value}</div>
      {change && (
        <div className={`text-xs mt-1 ${changeColor}`}>{change}</div>
      )}
    </div>
  )
}
