import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Bot, Zap, Store, Shield, Webhook,
  CreditCard, Settings, Activity
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
  return (
    <aside className="glass-sidebar w-[220px] flex flex-col h-screen shrink-0">
      <div className="p-5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-xorb-blue flex items-center justify-center">
            <span className="text-white font-bold text-sm">X</span>
          </div>
          <span className="font-semibold text-lg">X.orb</span>
        </div>
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

      <div className="p-4 border-t border-white/8">
        <div className="glass-card p-3">
          <div className="flex items-center gap-2 text-xs">
            <Activity size={14} className="text-xorb-green" />
            <span className="text-xorb-muted">API Status:</span>
            <span className="text-xorb-green font-medium">Live</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
