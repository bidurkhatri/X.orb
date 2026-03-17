import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { api } from '../lib/api'

export function Agents() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', role: 'RESEARCHER', sponsor_address: '', description: '' })

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
        description={`${agents.length} registered`}
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

      <GlassTable
        columns={columns}
        data={agents}
        onRowClick={(a: any) => navigate(`/agents/${a.agentId}`)}
        emptyMessage={isLoading ? 'Loading agents...' : "No agents registered yet. Click 'Register Agent' to create your first agent."}
      />
    </div>
  )
}
