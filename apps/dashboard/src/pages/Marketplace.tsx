import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'

export function Marketplace() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => api.marketplace.listings(),
  })

  const listings = data?.listings || []

  const filteredListings = useMemo(() => {
    if (!searchQuery.trim()) return listings
    const q = searchQuery.toLowerCase()
    return listings.filter((row: any) =>
      (row.agent_name || '').toLowerCase().includes(q) ||
      (row.description || '').toLowerCase().includes(q)
    )
  }, [listings, searchQuery])

  return (
    <div>
      <PageHeader title="Marketplace" description="Browse and hire agents" />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xorb-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by agent name or description..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-xorb-muted/60 focus:outline-none focus:border-xorb-blue/50 transition-colors"
          />
        </div>
      </div>

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
          data={filteredListings}
          emptyMessage={searchQuery ? "No listings match your search." : "No agents listed for hire yet. List an agent via POST /v1/marketplace/listings."}
        />
      )}
    </div>
  )
}
