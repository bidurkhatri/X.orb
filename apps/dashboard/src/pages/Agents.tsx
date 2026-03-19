import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bot, Search, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useState, useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { api } from '../lib/api'

const PAGE_SIZE = 20

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export function Agents() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
    retry: false,
  })

  const agents = Array.isArray(data) ? data : (data?.agents || data?.data || [])

  // Filter agents by search query (name or scope/role) and status
  const filteredAgents = useMemo(() => {
    let result = agents
    if (statusFilter) {
      result = result.filter((a: Record<string, string>) => a.status === statusFilter)
    }
    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase()
    return result.filter((a: Record<string, string>) =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.scope || a.permissionScope || a.role || '').toLowerCase().includes(q) ||
      (a.agentId || '').toLowerCase().includes(q)
    )
  }, [agents, searchQuery, statusFilter])

  // Reset to page 1 when search query changes
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginatedAgents = filteredAgents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const columns = [
    {
      key: 'name',
      header: 'Agent',
      render: (a: any) => (
        <div>
          <div className="font-medium">{a.name}</div>
          <div className="text-xs text-xorb-muted font-mono">{a.agentId}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (a: any) => <span className="badge bg-xorb-blue/20 text-xorb-blue">{a.scope || a.permissionScope || a.role}</span>,
    },
    {
      key: 'trust',
      header: 'Trust',
      render: (a: any) => (
        <div className="flex items-center gap-2">
          {/*
           * Backward compat: the API returns both `trustScore` (canonical) and `reputation`
           * (legacy field). Older SDK versions (<= 0.2.x) only send `reputation`, so we
           * fall back to it to avoid showing "—" for agents registered via older clients.
           */}
          <span className="font-mono">{a.trustScore ?? a.reputation ?? '—'}/100</span>
          <span className="text-xs text-xorb-muted">{a.trustSource || 'local'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a: any) => (
        <span className={a.status === 'active' ? 'badge-active' : a.status === 'paused' ? 'badge-paused' : 'badge-revoked'}>
          {a.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a: any) => <span className="font-mono">{a.totalActionsExecuted}</span>,
      className: 'text-right',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Agents"
        description={`${filteredAgents.length}${searchQuery ? ` of ${agents.length}` : ''} registered`}
        action={
          <button
            onClick={() => downloadCSV(filteredAgents, 'xorb-agents.csv')}
            disabled={filteredAgents.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        }
      />

      {/* Search / filter bar — only show when agents exist */}
      {agents.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xorb-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
                placeholder="Search by name, scope, or ID..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-xorb-muted/60 focus:outline-none focus:border-xorb-blue/50 transition-colors"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : agents.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-xorb-blue/10 flex items-center justify-center mx-auto mb-4">
            <Bot size={28} className="text-xorb-blue" />
          </div>
          <h3 className="text-lg font-medium mb-2">No agents yet</h3>
          <p className="text-sm text-xorb-muted mb-4 max-w-md mx-auto">
            Agents are registered programmatically via the X.orb SDK.
          </p>
          <code className="block text-xs text-xorb-blue bg-white/5 rounded-lg px-4 py-2 mb-4 font-mono">
            npm install @xorb/sdk
          </code>
          <a href="https://api.xorb.xyz/v1/docs" target="_blank" rel="noopener noreferrer"
            className="text-sm text-xorb-blue hover:underline">
            View SDK Documentation →
          </a>
        </div>
      ) : (
        <GlassTable
          columns={columns}
          data={paginatedAgents}
          onRowClick={(a: Record<string, string>) => navigate(`/agents/${a.agentId}`)}
          emptyMessage="No agents match your search."
        />
      )}

      {/* Pagination controls */}
      {filteredAgents.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-xorb-muted">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAgents.length)} of {filteredAgents.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-sm text-xorb-muted font-mono">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
