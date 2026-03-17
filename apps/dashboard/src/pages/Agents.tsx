import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { api } from '../lib/api'

const PAGE_SIZE = 20

export function Agents() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'RESEARCHER', sponsor_address: '', description: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.agents.register(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setShowCreate(false)
      setForm({ name: '', role: 'RESEARCHER', sponsor_address: '', description: '' })
    },
  })

  const agents = data?.agents || []

  // Filter agents by search query (name or scope/role)
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents
    const q = searchQuery.toLowerCase()
    return agents.filter((a: any) =>
      (a.name || '').toLowerCase().includes(q) ||
      (a.scope || a.permissionScope || a.role || '').toLowerCase().includes(q) ||
      (a.agentId || '').toLowerCase().includes(q)
    )
  }, [agents, searchQuery])

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
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Register Agent
          </button>
        }
      />

      {showCreate && (
        <div className="glass-card p-5 mb-6">
          <h3 className="text-sm font-medium mb-4">Register New Agent</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-xorb-muted block mb-1">Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="research-bot" />
            </div>
            <div>
              <label className="text-xs text-xorb-muted block mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm">
                {['TRADER', 'RESEARCHER', 'MONITOR', 'CODER', 'GOVERNANCE_ASSISTANT', 'FILE_INDEXER', 'RISK_AUDITOR'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-xorb-muted block mb-1">Sponsor Address</label>
              <input value={form.sponsor_address} onChange={e => setForm({ ...form, sponsor_address: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono" placeholder="0x..." />
            </div>
            <div>
              <label className="text-xs text-xorb-muted block mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm" placeholder="What does this agent do?" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name || !form.sponsor_address}
              className="px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {createMutation.isPending ? 'Creating...' : 'Create Agent'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
          {createMutation.error && (
            <p className="text-xs text-xorb-red mt-2">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Search / filter bar */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-xorb-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            placeholder="Search by name, scope, or ID..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-xorb-muted/60 focus:outline-none focus:border-xorb-blue/50 transition-colors"
          />
        </div>
      </div>

      <GlassTable
        columns={columns}
        data={paginatedAgents}
        onRowClick={(a: any) => navigate(`/agents/${a.agentId}`)}
        emptyMessage={isLoading ? 'Loading agents...' : searchQuery ? 'No agents match your search.' : "No agents registered yet. Click 'Register Agent' to create your first agent."}
      />

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
