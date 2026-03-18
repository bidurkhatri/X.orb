import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bot, Zap, Store, Shield, Webhook,
  CreditCard, Settings, Activity, LogOut
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

  const handleLogout = () => {
    sessionStorage.removeItem('xorb_api_key')
    navigate('/login')
  }

  return (
    <aside className="glass-sidebar w-[220px] flex flex-col h-screen shrink-0">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="X.orb" className="w-8 h-8 object-contain invert" />
          <span className="font-semibold text-lg tracking-tight">X.orb</span>
        </div>
        <p className="text-[10px] text-xorb-muted mt-1.5 tracking-wide uppercase">Agent Trust Infrastructure</p>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
    </aside>
  )
}
