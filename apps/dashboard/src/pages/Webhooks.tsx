import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'
import { TableSkeleton, ButtonSpinner } from '../components/ui/Skeleton'
import { api } from '../lib/api'

export function Webhooks() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [url, setUrl] = useState('')
  const [eventTypes, setEventTypes] = useState('action.approved,action.blocked,agent.slashed')

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.webhooks.list(),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.webhooks.create(url, eventTypes.split(',').map(s => s.trim())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      setShowCreate(false)
      setUrl('')
      toast.success('Webhook created successfully')
    },
    onError: (err: Error) => {
      toast.error('Failed to create webhook. Check the URL and try again.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.webhooks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook deleted')
    },
    onError: (err: Error) => {
      toast.error('Failed to delete webhook. Please try again.')
    },
  })

  const webhooks = data?.webhooks || []

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Event subscriptions and delivery logs"
        action={
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Add Webhook
          </button>
        }
      />

      {showCreate && (
        <div className="glass-card p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-xorb-muted block mb-1">URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono" placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs text-xorb-muted block mb-1">Event Types (comma-separated)</label>
              <input value={eventTypes} onChange={e => setEventTypes(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <ButtonSpinner
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!url}
            className="px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Subscribe
          </ButtonSpinner>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : (
        <GlassTable
          columns={[
            { key: 'url', header: 'URL', render: (w: any) => <span className="font-mono text-xs truncate max-w-[300px] block">{w.url}</span> },
            { key: 'events', header: 'Events', render: (w: any) => <span className="text-xs">{w.event_types?.join(', ')}</span> },
            {
              key: 'status', header: 'Status',
              render: (w: any) => <span className={w.active ? 'badge-active' : 'badge-revoked'}>{w.active ? 'active' : 'disabled'}</span>,
            },
            {
              key: 'actions', header: '',
              render: (w: any) => (
                <button onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(w.id) }}
                  className="p-1 hover:bg-xorb-red/20 rounded text-xorb-muted hover:text-xorb-red transition-colors">
                  <Trash2 size={14} />
                </button>
              ),
              className: 'text-right w-12',
            },
          ]}
          data={webhooks}
          emptyMessage="No webhook subscriptions."
        />
      )}
    </div>
  )
}
