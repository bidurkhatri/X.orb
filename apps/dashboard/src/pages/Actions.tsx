import { useState, useEffect, useRef, useCallback } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { ApiError } from '../components/ui/ApiError'

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
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const sinceRef = useRef(new Date(Date.now() - 3600000).toISOString())

  const longPoll = useCallback(async () => {
    setError(null)
    setConnected(true)

    while (true) {
      // Check if we should stop — use the abortRef signal
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch(
          `${API}/v1/events/stream?since=${encodeURIComponent(sinceRef.current)}`,
          {
            headers: { 'x-api-key': sessionStorage.getItem('xorb_api_key') || '' },
            signal: controller.signal,
          },
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `HTTP ${res.status}`)
        }

        const data = await res.json()

        const eventList = data.data?.events || data.events || (Array.isArray(data.data) ? data.data : [])
        if (eventList.length > 0) {
          setEvents(prev => [...eventList, ...prev].slice(0, 200))
          sinceRef.current = eventList[0].timestamp
        }

        setConnected(true)
        setError(null)
        // Immediately loop to long-poll again
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Intentional stop
          setConnected(false)
          return
        }
        setConnected(false)
        setError(err instanceof Error ? err.message : 'Connection lost')
        // Wait briefly before retrying on error
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }, [])

  useEffect(() => {
    if (polling) {
      longPoll()
    }
    return () => {
      abortRef.current?.abort()
    }
  }, [polling, longPoll])

  const handleToggle = () => {
    if (polling) {
      abortRef.current?.abort()
      setPolling(false)
      setConnected(false)
    } else {
      setPolling(true)
    }
  }

  return (
    <div>
      <PageHeader
        title="Actions"
        description="Real-time action feed from the 8-gate pipeline"
        action={
          <div className="flex items-center gap-3">
            {polling && (
              <div className="flex items-center gap-2 text-xs">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
                </span>
                <span className={connected ? 'text-green-400' : 'text-yellow-400'}>
                  {connected ? 'Live' : 'Reconnecting...'}
                </span>
              </div>
            )}
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                polling ? 'bg-xorb-red/20 text-xorb-red' : 'bg-xorb-green/20 text-xorb-green'
              }`}
            >
              {polling ? 'Stop Feed' : 'Start Live Feed'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <ApiError
            message={error}
            suggestion="The long-poll connection will automatically retry."
            onRetry={() => {
              abortRef.current?.abort()
              setPolling(false)
              setTimeout(() => setPolling(true), 100)
            }}
          />
        </div>
      )}

      <div className="glass-card divide-y divide-white/5">
        {events.length === 0 ? (
          <div className="p-12 text-center text-xorb-muted text-sm">
            {polling ? 'Waiting for events... (server holds request up to 20s)' : 'Click "Start Live Feed" to stream pipeline events.'}
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
