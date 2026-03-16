import { useState } from 'react'
import { Copy, Eye, EyeOff, Key } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'

export function Settings() {
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState(localStorage.getItem('xorb_api_key') || '')

  const saveKey = () => {
    localStorage.setItem('xorb_api_key', apiKey)
  }

  return (
    <div>
      <PageHeader title="Settings" description="API configuration and account" />

      <div className="glass-card p-5 mb-6">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Key size={16} /> API Key</h3>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="xorb_sk_..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <button onClick={() => setShowKey(!showKey)} className="p-1 hover:bg-white/10 rounded">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => navigator.clipboard.writeText(apiKey)} className="p-1 hover:bg-white/10 rounded">
                <Copy size={14} />
              </button>
            </div>
          </div>
          <button onClick={saveKey} className="px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            Save
          </button>
        </div>
        <p className="text-xs text-xorb-muted mt-2">Your API key is stored locally and never sent to our servers.</p>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4">API Base URL</h3>
        <div className="text-sm font-mono text-xorb-muted bg-white/5 rounded-lg px-3 py-2">
          {import.meta.env.VITE_API_URL || 'https://api.xorb.xyz'}
        </div>
      </div>
    </div>
  )
}
