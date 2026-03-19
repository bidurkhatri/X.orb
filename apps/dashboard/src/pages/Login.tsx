import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, ArrowRight, AlertCircle, Plus, Copy, Check } from 'lucide-react'
import { API_BASE } from '../lib/api'

export function Login() {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [keyLabel, setKeyLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState('')
  const [copied, setCopied] = useState(false)
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
      const res = await fetch(`${API_BASE}/v1/agents`, {
        headers: { 'x-api-key': apiKey },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Invalid API key' }))
        const status = res.status
        setError(status === 401 ? 'Invalid API key. Check your key and try again.' : status === 429 ? 'Too many attempts. Wait a moment and try again.' : 'Authentication failed. Please check your key.')
        return
      }

      sessionStorage.setItem('xorb_api_key', apiKey)
      navigate('/overview')
    } catch {
      setError('Cannot reach API server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Enter a valid Ethereum address (0x + 40 hex characters)')
      return
    }
    if (!keyLabel.trim()) {
      setError('Enter a name for this key')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/v1/auth/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_address: walletAddress, label: keyLabel.trim() }),
      })
      const data = await res.json()
      if (data.success && data.data?.api_key) {
        setCreatedKey(data.data.api_key)
        setApiKey(data.data.api_key)
      } else {
        setError('Failed to create API key. Check your wallet address and try again.')
      }
    } catch {
      setError('Cannot reach API server. Check your connection.')
    } finally {
      setCreating(false)
    }
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">X.orb Dashboard</h1>
          <p className="text-sm text-xorb-muted">Enter your API key to access the agent trust infrastructure.</p>
        </div>

        {/* Key created success state */}
        {createdKey && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
            <p className="text-sm text-green-400 font-medium">API key created successfully</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-black/30 rounded px-2 py-1.5 break-all text-green-300">
                {createdKey}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
                title="Copy to clipboard"
                aria-label="Copy API key to clipboard"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-xorb-muted" />}
              </button>
            </div>
            <p className="text-xs text-yellow-400">Save this key now. It cannot be retrieved again.</p>
          </div>
        )}

        {/* Sign in form */}
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
              autoFocus={!showCreateForm}
            />
          </div>

          {error && !showCreateForm && (
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

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-xorb-muted">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Create key section */}
        {!showCreateForm ? (
          <button
            onClick={() => { setShowCreateForm(true); setError('') }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            Create a new API key
          </button>
        ) : (
          <form onSubmit={handleCreateKey} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-xorb-muted mb-1">Wallet Address</label>
              <input
                type="text"
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-xorb-blue/50"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-xorb-muted mb-1">Key Name</label>
              <input
                type="text"
                value={keyLabel}
                onChange={e => setKeyLabel(e.target.value)}
                placeholder="my-project"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xorb-blue/50"
              />
            </div>

            {error && showCreateForm && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
              >
                {creating ? 'Creating...' : 'Generate Key'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setError('') }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
