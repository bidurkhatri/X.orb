import { useState, useEffect } from 'react'
import { Copy, Eye, EyeOff, Key, Bell, Wallet, Shield, Trash2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '../components/layout/PageHeader'
import { api } from '../lib/api'

const API_BASE = () => sessionStorage.getItem('xorb_api_url') || import.meta.env.VITE_API_URL || 'https://api.xorb.xyz'

export function Settings() {
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey] = useState(sessionStorage.getItem('xorb_api_key') || '')
  const [usage, setUsage] = useState<any>(null)
  const [walletStatus, setWalletStatus] = useState<any>(null)
  const [notifications, setNotifications] = useState({
    slashing: true, reputation_warning: true, api_key_expiring: true,
    payment_receipt: true, free_tier_warning: true,
  })
  const [notifDirty, setNotifDirty] = useState(false)
  const [notifSaving, setNotifSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const headers: Record<string, string> = { 'x-api-key': apiKey }
      const [u, w] = await Promise.all([
        fetch(`${API_BASE()}/v1/billing/usage`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE()}/v1/billing/wallet-status`, { headers }).then(r => r.json()).catch(() => null),
      ])
      if (u) setUsage(u)
      if (w) setWalletStatus(w)

      // Load saved notification preferences from API or localStorage fallback
      try {
        const notifResp = await fetch(`${API_BASE()}/v1/settings/notifications`, { headers })
        if (notifResp.ok) {
          const saved = await notifResp.json()
          if (saved?.preferences) setNotifications(saved.preferences)
        }
      } catch {
        // API unavailable: load from localStorage fallback
        const saved = localStorage.getItem('xorb_notification_prefs')
        if (saved) {
          try { setNotifications(JSON.parse(saved)) } catch { /* invalid JSON in localStorage, use defaults */ }
        }
      }
    } catch { /* network error on usage/wallet fetch, page still renders with defaults */ }
  }

  const saveKey = () => {
    sessionStorage.setItem('xorb_api_key', apiKey)
    toast.success('API key saved')
  }

  const saveNotifications = async () => {
    setNotifSaving(true)
    try {
      const headers: Record<string, string> = {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      }
      const resp = await fetch(`${API_BASE()}/v1/settings/notifications`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ preferences: notifications }),
      })
      if (resp.ok) {
        toast.success('Notification preferences saved')
      } else {
        // Fallback: save to localStorage
        localStorage.setItem('xorb_notification_prefs', JSON.stringify(notifications))
        toast.success('Notification preferences saved locally')
      }
      setNotifDirty(false)
    } catch {
      localStorage.setItem('xorb_notification_prefs', JSON.stringify(notifications))
      toast.success('Notification preferences saved locally')
      setNotifDirty(false)
    } finally {
      setNotifSaving(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('xorb_api_key')
    window.location.href = '/login'
  }

  const toggleNotification = (key: string) => {
    setNotifications(n => ({ ...n, [key]: !n[key as keyof typeof n] }))
    setNotifDirty(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Account, API keys, wallet, and notifications" />

      {/* API Key Section */}
      <div className="glass-card p-5">
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
              <button onClick={() => { navigator.clipboard.writeText(apiKey); toast.success('Copied to clipboard') }} className="p-1 hover:bg-white/10 rounded">
                <Copy size={14} />
              </button>
            </div>
          </div>
          <button onClick={saveKey} className="px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors">
            Save
          </button>
        </div>
        <p className="text-xs text-xorb-muted mt-2">Your API key is stored in session storage and sent via the x-api-key header.</p>
      </div>

      {/* Billing & Usage */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Shield size={16} /> Billing & Usage</h3>
        {usage ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-xorb-muted">Free Tier Usage</span>
                <span>{usage.actions_used} / {usage.free_tier_limit}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-xorb-blue rounded-full h-2 transition-all"
                  style={{ width: `${Math.min(100, (usage.actions_used / usage.free_tier_limit) * 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xorb-muted">Tier:</span>{' '}
                <span className="font-medium capitalize">{usage.tier}</span>
              </div>
              <div>
                <span className="text-xorb-muted">Fee Rate:</span>{' '}
                <span className="font-medium">{usage.current_fee_rate_bps} bps</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-xorb-muted">Loading usage data...</p>
        )}
      </div>

      {/* Wallet Status */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Wallet size={16} /> Wallet</h3>
        {walletStatus ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${walletStatus.payment_ready ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>{walletStatus.payment_ready ? 'Payment Ready' : 'Setup Required'}</span>
            </div>
            {walletStatus.usdc_balance && (
              <div><span className="text-xorb-muted">USDC Balance:</span> {walletStatus.usdc_balance}</div>
            )}
            {walletStatus.facilitator_allowance && (
              <div><span className="text-xorb-muted">Allowance:</span> {walletStatus.facilitator_allowance}</div>
            )}
            {walletStatus.setup_required?.length > 0 && (
              <div className="mt-2 p-3 bg-yellow-500/10 rounded-lg text-xs">
                <p className="font-medium text-yellow-400 mb-1">Setup needed:</p>
                <ul className="list-disc list-inside text-xorb-muted">
                  {walletStatus.setup_required.map((s: string) => (
                    <li key={s}>{s.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-xorb-muted">Loading wallet status...</p>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium flex items-center gap-2"><Bell size={16} /> Notifications</h3>
          {notifDirty && (
            <button
              onClick={saveNotifications}
              disabled={notifSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Save size={12} />
              {notifSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {Object.entries(notifications).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
              <button
                onClick={() => toggleNotification(key)}
                className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-xorb-blue' : 'bg-white/20'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* API Base URL */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium mb-4">API Base URL</h3>
        <div className="text-sm font-mono text-xorb-muted bg-white/5 rounded-lg px-3 py-2">
          {import.meta.env.VITE_API_URL || 'https://api.xorb.xyz'}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="glass-card p-5 border border-red-500/20">
        <h3 className="text-sm font-medium mb-4 text-red-400 flex items-center gap-2"><Trash2 size={16} /> Danger Zone</h3>
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
