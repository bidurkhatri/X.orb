import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, ArrowRight, AlertCircle } from 'lucide-react'
import { API_BASE } from '../lib/api'

export function Login() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!apiKey.startsWith('xorb_')) {
      setError('API key must start with "xorb_"')
      return
    }

    setLoading(true)
    try {
      // Validate the key against the API
      const res = await fetch(`${API_BASE}/v1/agents`, {
        headers: { 'x-api-key': apiKey },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Invalid API key' }))
        setError(data.error || `Authentication failed (${res.status})`)
        return
      }

      // Key is valid — store it and redirect
      sessionStorage.setItem('xorb_api_key', apiKey)
      navigate('/overview')
    } catch {
      setError('Cannot reach API server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">X.orb Dashboard</h1>
          <p className="text-sm text-xorb-muted">Enter your API key to access the agent trust infrastructure.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium mb-1.5">
              <Key size={14} className="inline mr-1.5" />
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="xorb_sk_..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-xorb-blue/50"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !apiKey}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>

        <p className="text-xs text-xorb-muted text-center mt-6">
          Don't have an API key? Contact your administrator or generate one via the API.
        </p>
      </div>
    </div>
  )
}
