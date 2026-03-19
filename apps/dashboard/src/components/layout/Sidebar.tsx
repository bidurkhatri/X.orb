import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, Zap, Store, Shield, Webhook,
  CreditCard, Settings, Activity, LogOut, Menu, X, ExternalLink
} from 'lucide-react'

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/actions', label: 'Actions', icon: Zap },
  { to: '/marketplace', label: 'Marketplace', icon: Store },
  { to: '/audit', label: 'Audit', icon: Shield },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    sessionStorage.removeItem('xorb_api_key')
    navigate('/login')
  }

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">X</div>
          <span className="font-semibold text-lg tracking-tight">X.orb</span>
        </div>
        <p className="text-[10px] text-xorb-muted mt-1.5 tracking-wide uppercase">Agent Trust Infrastructure</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-xorb-blue/15 text-xorb-blue font-medium'
                  : 'text-xorb-muted hover:text-xorb-text hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <a
          href="https://api.xorb.xyz/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-xorb-muted hover:text-xorb-text hover:bg-white/5"
        >
          <ExternalLink size={18} />
          API Docs
        </a>
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="glass-card p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <Activity size={14} className="text-xorb-green" />
            <span className="text-xorb-muted">API:</span>
            <span className="text-xorb-green font-medium">Live</span>
          </div>
          <div className="text-[10px] text-xorb-muted">
            8-gate pipeline active
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-xorb-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white/10 backdrop-blur rounded-lg hover:bg-white/20 transition-colors"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="glass-sidebar w-[220px] flex flex-col h-screen shrink-0 relative z-50">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-4 p-1 text-xorb-muted hover:text-white"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex glass-sidebar w-[220px] flex-col h-screen shrink-0">
        {sidebarContent}
      </aside>
    </>
  )
}
