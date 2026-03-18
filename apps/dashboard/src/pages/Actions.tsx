import { useState, useEffect } from 'react'
import { PageHeader } from '../components/layout/PageHeader'

const API = import.meta.env.VITE_API_URL || 'https://api.xorb.xyz'

interface ActionEvent {
  id: string
  type: string
  agentId: string
  data: Record<string, unknown>
  timestamp: string
}

export function Actions() {
  const [events, setEvents] = useState<ActionEvent[]>([])
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    let mounted = true
    let since = new Date(Date.now() - 3600000).toISOString()

    async function poll() {
      if (!mounted || !polling) return
      try {
        const res = await fetch(`${API}/v1/events?since=${since}&limit=50`, {
          headers: { 'x-api-key': sessionStorage.getItem('xorb_api_key') || '' },
        })
        const data = await res.json()
        if (data.events?.length > 0) {
          setEvents(prev => [...data.events, ...prev].slice(0, 200))
          since = data.events[0].timestamp
        }
      } catch { /* retry next tick */ }
      if (mounted && polling) setTimeout(poll, 2000)
    }

    if (polling) poll()
    return () => { mounted = false }
  }, [polling])

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Real-time action feed from the 8-gate pipeline"
        action={
          <button
            onClick={() => setPolling(!polling)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              polling ? 'bg-xorb-red/20 text-xorb-red' : 'bg-xorb-green/20 text-xorb-green'
            }`}
          >
            {polling ? 'Stop Feed' : 'Start Live Feed'}
          </button>
        }
      />

      <div className="glass-card divide-y divide-white/5">
        {events.length === 0 ? (
          <div className="p-12 text-center text-xorb-muted text-sm">
            {polling ? 'Waiting for events...' : 'Click "Start Live Feed" to stream pipeline events.'}
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="px-4 py-3 flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                event.type === 'action.approved' ? 'bg-xorb-green' :
                event.type === 'action.blocked' ? 'bg-xorb-red' :
                event.type.includes('slash') ? 'bg-xorb-amber' : 'bg-xorb-blue'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{event.type}</div>
                <div className="text-xs text-xorb-muted font-mono truncate">{event.agentId}</div>
              </div>
              <div className="text-xs text-xorb-muted font-mono shrink-0">
                {new Date(event.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
