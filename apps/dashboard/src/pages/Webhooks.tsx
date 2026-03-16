import { Plus } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { GlassTable } from '../components/glass/GlassTable'

export function Webhooks() {
  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Event subscriptions and delivery logs"
        action={
          <button className="flex items-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Add Webhook
          </button>
        }
      />
      <GlassTable
        columns={[
          { key: 'url', header: 'URL', render: () => <span>—</span> },
          { key: 'events', header: 'Events', render: () => <span>—</span> },
          { key: 'status', header: 'Status', render: () => <span>—</span> },
          { key: 'deliveries', header: 'Deliveries', render: () => <span>—</span> },
        ]}
        data={[]}
        emptyMessage="No webhook subscriptions. Click 'Add Webhook' to subscribe to events."
      />
    </div>
  )
}
