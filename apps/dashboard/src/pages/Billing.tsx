import { PageHeader } from '../components/layout/PageHeader'
import { MetricCard } from '../components/glass/MetricCard'

export function Billing() {
  return (
    <div>
      <PageHeader title="Billing" description="x402 payment history and usage" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Free Tier Used" value="0 / 1,000" />
        <MetricCard label="Total Spent (USDC)" value="$0.00" />
        <MetricCard label="This Month" value="$0.00" />
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-xorb-muted mb-4">Payment History</h3>
        <div className="text-center py-8 text-xorb-muted text-sm">
          No payments yet. First 1,000 actions per month are free.
        </div>
      </div>
    </div>
  )
}
