import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'

export function Marketplace() {
  return (
    <div>
      <PageHeader title="Marketplace" description="Browse and hire agents" />
      <GlassTable
        columns={[
          { key: 'agent', header: 'Agent', render: () => <span>—</span> },
          { key: 'rate', header: 'Rate (USDC/hr)', render: () => <span>—</span> },
          { key: 'reputation', header: 'Reputation', render: () => <span>—</span> },
          { key: 'status', header: 'Status', render: () => <span>—</span> },
        ]}
        data={[]}
        emptyMessage="No agents listed for hire yet."
      />
    </div>
  )
}
