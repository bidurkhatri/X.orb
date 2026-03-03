import { Wifi, Battery, Volume2, Shield, Cpu, HardDrive, Bell, Search, Lock, Bot, Terminal as TerminalIcon, Settings, Zap, Users } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useSettings } from '../hooks/useSettings'
import { useIsMobile } from '../hooks/useIsMobile'

interface TaskbarProps {
  openApps: Array<{ id: string; title: string; icon: React.ReactNode; minimized: boolean }>
  activeAppId: string | null
  onAppClick: (id: string) => void
  onNotificationClick?: () => void
  onSpotlightClick?: () => void
  onLock?: () => void
  onOpenApp?: (id: string) => void
  unreadCount?: number
}

export default function Taskbar({ openApps, activeAppId, onAppClick, onNotificationClick, onSpotlightClick, onLock, onOpenApp, unreadCount = 0 }: TaskbarProps) {
  const settings = useSettings()
  const isMobile = useIsMobile()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [showSystemTray, setShowSystemTray] = useState(false)
  const [storageKB, setStorageKB] = useState(0)
  const [agentCount, setAgentCount] = useState(0)
  const startRef = useRef<HTMLDivElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Real system metrics
  useEffect(() => {
    const measure = () => {
      try {
        let total = 0
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key) total += localStorage.getItem(key)?.length || 0
        }
        setStorageKB(Math.round(total / 1024))
      } catch { setStorageKB(0) }

      try {
        const reg = JSON.parse(localStorage.getItem('sylos_agent_registry') || '[]')
        setAgentCount(Array.isArray(reg) ? reg.filter((a: any) => a.status === 'active').length : 0)
      } catch { setAgentCount(0) }
    }
    measure()
    const interval = setInterval(measure, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) setShowStartMenu(false)
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) setShowSystemTray(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Session uptime
  const uptime = useMemo(() => {
    const m = Math.floor(performance.now() / 60000)
    return `${Math.floor(m / 60)}h ${m % 60}m`
  }, [currentTime]) // recalculate each second

  const startMenuItems = [
    { icon: <Bot size={16} color="#a78bfa" />, label: 'AI Agents', desc: `${agentCount} active agent${agentCount !== 1 ? 's' : ''}`, appId: 'ai-agents' },
    { icon: <TerminalIcon size={16} color="#22d3ee" />, label: 'Terminal', desc: 'Command line', appId: 'terminal' },
    { icon: <Cpu size={16} color="#34d399" />, label: 'Activity', desc: 'System monitor', appId: 'activity-monitor' },
    { icon: <HardDrive size={16} color="#fbbf24" />, label: 'Files', desc: 'IPFS storage', appId: 'files' },
    { icon: <Settings size={16} color="#94a3b8" />, label: 'Settings', desc: 'Preferences', appId: 'settings' },
  ]

  return (
    <div role="toolbar" aria-label="Taskbar" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, height: '52px',
      background: `var(--sylos-taskbar-bg, rgba(6, 8, 22, 0.75))`,
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderTop: '1px solid rgba(255,255,255,0.04)',
      padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Subtle top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
        background: `linear-gradient(90deg, transparent, ${settings.accentColor}26, ${settings.accentColor}1a, transparent)`,
      }} />

      {/* ─── Left: SylOS Button ─── */}
      <div ref={startRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => { setShowStartMenu(v => !v); setShowSystemTray(false) }}
          aria-expanded={showStartMenu}
          aria-haspopup="menu"
          aria-label="SylOS Start Menu"
          style={{
            padding: '6px 14px',
            background: showStartMenu
              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(139, 92, 246, 0.3))'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
            border: showStartMenu
              ? '1px solid rgba(99, 102, 241, 0.4)'
              : '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: '10px',
            color: '#c7d2fe', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit',
            transition: 'all 0.25s ease',
            boxShadow: showStartMenu ? '0 0 20px rgba(99,102,241,0.2)' : 'none',
          }}
          onMouseEnter={e => { if (!showStartMenu) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15))' }}
          onMouseLeave={e => { if (!showStartMenu) e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))' }}
        >
          <div style={{
            width: '18px', height: '18px', borderRadius: '6px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}>
            <Shield size={11} color="#fff" />
          </div>
          SylOS
        </button>

        {/* ─── Start Menu ─── */}
        {showStartMenu && (
          <div role="menu" aria-label="Start menu" onKeyDown={e => { if (e.key === 'Escape') setShowStartMenu(false) }} style={{
            position: 'absolute', bottom: '56px', left: isMobile ? '-10px' : 0, width: isMobile ? '100vw' : '300px',
            background: 'rgba(8, 10, 28, 0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: isMobile ? '24px 24px 0 0' : '18px', padding: '8px',
            backdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(99,102,241,0.06)',
            animation: 'slideUp 0.2s ease',
            zIndex: 1000,
          }}>
            {/* Header */}
            <div style={{
              padding: '14px 18px 16px', marginBottom: '4px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                }}>
                  <Shield size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>SylOS</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
                    AI Agent City · Polygon PoS
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            {startMenuItems.map((item, i) => (
              <button key={i} role="menuitem" aria-label={`${item.label} - ${item.desc}`} onClick={() => { if (item.appId && onOpenApp) { onOpenApp(item.appId); setShowStartMenu(false) } }} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                borderRadius: '12px', border: 'none', cursor: 'pointer', background: 'transparent',
                color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 500, width: '100%',
                fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '9px',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{item.desc}</div>
                </div>
              </button>
            ))}

            {/* Footer actions */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px', paddingTop: '6px' }}>
              <div style={{ display: 'flex', gap: '4px', padding: '4px 8px' }}>
                <button onClick={() => { onSpotlightClick?.(); setShowStartMenu(false) }} style={{
                  flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 600,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; e.currentTarget.style.color = '#a5b4fc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                ><Search size={11} /> Search</button>
                <button onClick={() => { onLock?.(); setShowStartMenu(false) }} style={{
                  flex: 1, padding: '8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', fontSize: '10px', fontWeight: 600,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#fca5a5' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
                ><Lock size={11} /> Lock</button>
              </div>
              <div style={{ padding: '6px 14px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {!isMobile && (
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={9} /> Chain 137 · v1.0.0 · Up {uptime}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Center: App Dock ─── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 20px', overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: openApps.length > 0 ? '4px 6px' : '0',
          borderRadius: '14px',
          background: openApps.length > 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
          border: openApps.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          maxWidth: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {openApps.map(app => (
            <button
              key={app.id}
              onClick={() => onAppClick(app.id)}
              title={app.title}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '11px', fontWeight: 500,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                background: activeAppId === app.id
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15))'
                  : 'transparent',
                color: activeAppId === app.id ? '#e0e7ff' : app.minimized ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
                position: 'relative',
                whiteSpace: 'nowrap',
                opacity: app.minimized ? 0.6 : 1,
              }}
              onMouseEnter={e => {
                if (activeAppId !== app.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={e => {
                if (activeAppId !== app.id) e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{app.icon}</div>
              <span>{app.title}</span>
              {/* Bottom indicator */}
              <div style={{
                position: 'absolute', bottom: '-3px', left: '50%', transform: 'translateX(-50%)',
                width: activeAppId === app.id ? '16px' : '4px', height: '3px', borderRadius: '2px',
                background: activeAppId === app.id
                  ? `linear-gradient(90deg, ${settings.accentColor}, ${settings.accentColor}cc)`
                  : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activeAppId === app.id ? `0 0 8px ${settings.accentColor}66` : 'none',
              }} />
            </button>
          ))}
        </div>
      </div>

      {/* ─── Right: System Tray ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Active agents indicator */}
        {!isMobile && agentCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '8px',
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.12)',
            fontSize: '10px', fontWeight: 600, color: '#a78bfa',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <Users size={11} />
            {agentCount}
          </div>
        )}

        {/* Notification bell */}
        <button onClick={onNotificationClick} aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: '7px', borderRadius: '9px', color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '3px', right: '3px', width: '12px', height: '12px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff', fontSize: '7px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 8px rgba(239,68,68,0.4)',
              animation: 'pulse 2s ease-in-out infinite',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        {/* System status */}
        <div ref={trayRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowSystemTray(v => !v); setShowStartMenu(false) }}
            aria-expanded={showSystemTray}
            aria-label="System tray"
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 10px', borderRadius: '10px', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
          >
            <Wifi size={13} />
            <Volume2 size={13} />
            <Battery size={13} />
          </button>

          {showSystemTray && (
            <div style={{
              position: 'absolute', bottom: '56px', right: 0, width: '280px',
              background: 'rgba(8, 10, 28, 0.95)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '18px', padding: '12px',
              backdropFilter: 'blur(40px) saturate(180%)',
              boxShadow: '0 32px 100px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.04)',
              animation: 'slideUp 0.2s ease',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', padding: '4px 12px 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>System</div>
              {[
                { icon: <Wifi size={14} />, label: 'Network', value: 'Polygon PoS', color: '#34d399' },
                { icon: <Zap size={14} />, label: 'Chain ID', value: '137', color: '#818cf8' },
                { icon: <Bot size={14} />, label: 'Active Agents', value: `${agentCount}`, color: '#a78bfa' },
                { icon: <HardDrive size={14} />, label: 'Storage', value: `${storageKB} KB`, color: '#f472b6' },
                { icon: <Volume2 size={14} />, label: 'Uptime', value: uptime, color: '#fbbf24' },
                { icon: <Battery size={14} />, label: 'Battery', value: '100%', color: '#34d399' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: '10px', marginBottom: '2px',
                  background: 'rgba(255,255,255,0.02)',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                    <span style={{ color: item.color }}>{item.icon}</span> {item.label}
                  </div>
                  <span style={{ fontSize: '11px', color: item.color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' }} />

        {/* Clock */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', minWidth: '58px' }}>
          <span style={{
            fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace", letterSpacing: '0.5px',
          }}>
            {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
            {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  )
}
