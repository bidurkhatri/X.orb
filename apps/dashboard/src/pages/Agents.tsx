import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'

interface Agent {
  agentId: string
  name: string
  role: string
  reputation: number
  reputationTier: string
  status: string
  totalActionsExecuted: number
}

export function Agents() {
  const navigate = useNavigate()
  const agents: Agent[] = [] // TODO: fetch from API

  const columns = [
    {
      key: 'name',
      header: 'Agent',
      render: (a: Agent) => (
        <div>
          <div className="font-medium">{a.name}</div>
          <div className="text-xs text-xorb-muted font-mono">{a.agentId}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (a: Agent) => <span className="badge bg-xorb-blue/20 text-xorb-blue">{a.role}</span>,
    },
    {
      key: 'reputation',
      header: 'Reputation',
      render: (a: Agent) => (
        <div className="flex items-center gap-2">
          <span className="font-mono">{a.reputation}</span>
          <span className="badge-tier">{a.reputationTier}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a: Agent) => (
        <span className={a.status === 'active' ? 'badge-active' : a.status === 'paused' ? 'badge-paused' : 'badge-revoked'}>
          {a.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (a: Agent) => <span className="font-mono">{a.totalActionsExecuted}</span>,
      className: 'text-right',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Manage your registered agents"
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} />
            Register Agent
          </button>
        }
      />

      <GlassTable
        columns={columns}
        data={agents}
        onRowClick={(a) => navigate(`/agents/${a.agentId}`)}
        emptyMessage="No agents registered yet. Click 'Register Agent' to create your first agent."
      />
    </div>
  )
}
