import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'

export function Marketplace() {
  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => api.marketplace.listings(),
  })

  const listings = data?.listings || []

  return (
    <div>
      <PageHeader title="Marketplace" description="Browse and hire agents" />
      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : (
        <GlassTable
          columns={[
            { key: 'agent', header: 'Agent', render: (row: any) => <span className="font-mono text-sm">{row.agent_name || row.agent_id}</span> },
            { key: 'rate_hr', header: 'Rate (USDC/hr)', render: (row: any) => <span className="font-mono">{row.rate_usdc_per_hour != null ? `$${row.rate_usdc_per_hour}` : '—'}</span> },
            { key: 'rate_act', header: 'Rate (USDC/action)', render: (row: any) => <span className="font-mono">{row.rate_usdc_per_action != null ? `$${row.rate_usdc_per_action}` : '—'}</span> },
            { key: 'desc', header: 'Description', render: (row: any) => <span className="text-xorb-muted text-sm">{row.description || '—'}</span> },
            { key: 'status', header: 'Status', render: (row: any) => (
              <span className={`text-xs px-2 py-1 rounded-full ${row.available ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {row.available ? 'Available' : 'Hired'}
              </span>
            )},
          ]}
          data={listings}
          emptyMessage="No agents listed for hire yet. List an agent via POST /v1/marketplace/listings."
        />
      )}
    </div>
  )
}
