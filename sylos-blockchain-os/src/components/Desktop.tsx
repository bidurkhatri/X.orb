import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Taskbar from './Taskbar'
import AppWindow from './AppWindow'
import DesktopIcon from './DesktopIcon'
import NotificationCenter, { useNotifications } from './NotificationCenter'
import { ToastProvider, useToastSystem } from './ui'
import WalletApp from './apps/WalletApp'
import PoPTrackerApp from './apps/PoPTrackerApp'
import FileManagerApp from './apps/FileManagerApp'
import TokenDashboardApp from './apps/TokenDashboardApp'
import SettingsApp from './apps/SettingsApp'
import MessagesApp from './apps/MessagesApp'
import AgentDashboardApp from './apps/AgentDashboardApp'
import AppStoreApp from './apps/AppStoreApp'
import ActivityMonitorApp from './apps/ActivityMonitorApp'
import NotesApp from './apps/NotesApp'
import WebBrowserApp from './apps/WebBrowserApp'
import CivilizationDashboard from './apps/CivilizationDashboard'
import ReputationExplorer from './apps/ReputationExplorer'
import KillSwitchPanel from './apps/KillSwitchPanel'
import CitizenProfileApp from './apps/CitizenProfileApp'
import AgentMarketplaceApp from './apps/AgentMarketplaceApp'
import TransactionQueueApp from './apps/TransactionQueueApp'
import AgentCommunityApp from './apps/AgentCommunityApp'
import HireHumansApp from './apps/HireHumansApp'
import DeFiInterface from './dashboard/DeFiInterface'
import StakingInterface from './dashboard/StakingInterface'
import GovernanceInterface from './dashboard/GovernanceInterface'
import IdentityInterface from './dashboard/IdentityInterface'
import { ErrorBoundary } from './ErrorBoundary'
import { autonomyEngine } from '../services/agent/AgentAutonomyEngine'
import {
  Wallet, Activity, FolderOpen, Coins, Settings, Terminal, MessageCircle, Bot, Store,
  ArrowUpDown, Landmark, Vote, Fingerprint, User, ShoppingBag, Briefcase, MessageSquare,
  Search, Unlock, Shield, ShieldOff, Battery, Volume2, Cpu, Globe, StickyNote, TrendingUp,
  ChevronDown, ChevronRight, LayoutGrid,
} from 'lucide-react'

interface OpenApp {
  id: string
  title: string
  icon: React.ReactNode
  component: React.ReactNode
  minimized: boolean
}

interface AppDef {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  component: React.ReactNode
  category: string
}

/* ─── App Categories ─── */
const CATEGORIES = [
  { id: 'favorites', label: 'Favorites', icon: '★' },
  { id: 'agents', label: 'Agent City', icon: '🤖' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'social', label: 'Social', icon: '💬' },
  { id: 'system', label: 'System', icon: '⚙' },
] as const

const DEFAULT_FAVORITES = ['wallet', 'ai-agents', 'community', 'tokens', 'terminal', 'settings']

/* ──── Functional Terminal ──── */
function TerminalApp() {
  const [lines, setLines] = useState<string[]>([
    'SylOS Terminal v1.0.0',
    'Polygon PoS · Chain ID 137 · Consensus: Heimdall + Bor',
    '─────────────────────────────────────────',
    'Type "help" for available commands.',
    '',
  ])
  const [cmd, setCmd] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const exec = (e: React.FormEvent) => {
    e.preventDefault()
    const input = cmd.trim()
    if (!input) return
    setHistory(h => [input, ...h])
    setHistIdx(-1)
    const out = [`❯ ${input}`]
    const c = input.toLowerCase()
    if (c === 'help') out.push('', '  COMMANDS', '  help       Show commands', '  clear      Clear terminal', '  whoami     Current identity', '  network    Blockchain info', '  agents     Running agents', '  version    SylOS build info', '  date       Timestamp', '  uptime     Session duration', '  echo <t>   Echo text', '  ls         Virtual files', '  contracts  Deployed contracts', '  gas        Current gas price', '  neofetch   System info', '')
    else if (c === 'clear') { setLines([]); setCmd(''); return }
    else if (c === 'whoami') out.push('  Guest (connect wallet for identity)')
    else if (c === 'network') out.push('', '  Chain   Polygon PoS', '  ID      137', '  RPC     polygon-rpc.com', '  Block   ~2s finality', '')
    else if (c === 'agents') out.push('  SylBot AI agent available. Open AI Agents app to interact.')
    else if (c === 'version') out.push('', '  SylOS     v1.0.0-alpha', '  Kernel    React 18 · Vite 5', '  Provider  wagmi + RainbowKit', '  AI        OpenAI-compatible', '  Apps      24 integrated', '')
    else if (c === 'date') out.push(`  ${new Date().toLocaleString()}`)
    else if (c === 'uptime') { const m = Math.floor(performance.now() / 60000); out.push(`  Session: ${Math.floor(m / 60)}h ${m % 60}m`) }
    else if (c.startsWith('echo ')) out.push(`  ${input.slice(5)}`)
    else if (c === 'ls') out.push('  Documents/', '  Downloads/', '  Desktop/', '  Notes/', '  .config/', '  .agents/', '  .browser/')
    else if (c === 'contracts') out.push('', '  SylOSToken       0xF201...8DE3', '  WrappedSYLOS     0xcec2...1728', '  PoPTracker       0x67eb...6510', '  SylOSGovernance  0xcc85...Ff76', '  Paymaster        0xAe14...1583', '')
    else if (c === 'neofetch') out.push('', '  ╔══════════════════════════╗', '  ║     SylOS v1.0.0-alpha   ║', '  ╚══════════════════════════╝', '  OS:       SylOS Blockchain OS', '  Kernel:   React 18 + Vite 5', '  Chain:    Polygon PoS (137)', '  Shell:    SylOS Terminal', '  CPU:      WebAssembly SIMD', '  Memory:   Browser Sandbox', '  Display:  CSS Compositor', '  AI:       SylBot (LLM Agent)', '  Apps:     24 integrated', '')
    else if (c === 'gas') {
      out.push('  Fetching...')
      fetch(import.meta.env['VITE_POLYGON_RPC'] || 'https://polygon-rpc.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] })
      }).then(r => r.json()).then(d => {
        const gwei = (Number(BigInt(d.result)) / 1e9).toFixed(2)
        setLines(p => [...p, `  Gas: ${gwei} Gwei`])
      }).catch(() => setLines(p => [...p, '  Error fetching gas']))
    }
    else out.push(`  command not found: ${input}`)
    out.push('')
    setLines(p => [...p, ...out])
    setCmd('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (history.length) { const n = Math.min(histIdx + 1, history.length - 1); setHistIdx(n); setCmd(history[n] || '') } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setCmd(history[histIdx - 1] || '') } else { setHistIdx(-1); setCmd('') } }
  }

  return (
    <div onClick={() => inputRef.current?.focus()} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #0c0e1c, #080a16)', fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", fontSize: '12.5px', color: '#94a3b8' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {lines.map((l, i) => <div key={i} style={{ color: l.startsWith('❯') ? '#67e8f9' : l.includes('not found') ? '#f87171' : l.startsWith('  ') && l === l.toUpperCase() && l.trim().length > 2 ? '#e2e8f0' : '#94a3b8', fontWeight: l.startsWith('❯') || (l.startsWith('  ') && l === l.toUpperCase()) ? 700 : 400 }}>{l}</div>)}
        <div ref={endRef} />
      </div>
      <form onSubmit={exec} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
        <span style={{ color: '#67e8f9', fontWeight: 700, fontSize: '13px' }}>❯</span>
        <input ref={inputRef} value={cmd} onChange={e => setCmd(e.target.value)} onKeyDown={handleKey} autoFocus spellCheck={false} autoComplete="off" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '12.5px', fontFamily: 'inherit', caretColor: '#67e8f9' }} placeholder="Type a command..." />
      </form>
    </div>
  )
}

/* ──── Spotlight Search (Ctrl+K) ──── */
function SpotlightSearch({ apps, onOpen, onClose }: { apps: AppDef[]; onOpen: (app: AppDef) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const results = query.trim() ? apps.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.description?.toLowerCase().includes(query.toLowerCase()) ||
    a.category?.toLowerCase().includes(query.toLowerCase())
  ) : apps.slice(0, 8)

  // Reset index when results change
  useEffect(() => { setSelectedIdx(0) }, [query])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(16px)' }}>
      <div ref={ref} style={{ width: '520px', borderRadius: '18px', overflow: 'hidden', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(99,102,241,0.08)', animation: 'windowOpen 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={18} color="rgba(255,255,255,0.3)" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search apps, actions, commands..." onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && results.length > 0 && results[selectedIdx]) { onOpen(results[selectedIdx]); onClose() }
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
          }} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '15px', fontFamily: "'Inter', system-ui, sans-serif", caretColor: '#818cf8' }} />
          <kbd style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'inherit' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {!query.trim() && <div style={{ padding: '4px 12px 8px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quick Launch</div>}
          {results.map((app, i) => (
            <button key={app.id} onClick={() => { onOpen(app); onClose() }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px',
              border: 'none', cursor: 'pointer',
              background: i === selectedIdx ? 'rgba(99,102,241,0.12)' : 'transparent',
              textAlign: 'left', fontFamily: "'Inter', system-ui, sans-serif", transition: 'background 0.1s',
            }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: i === selectedIdx ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))' : 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0 }}>{app.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{app.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.description}</div>
              </div>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}>{app.category}</span>
            </button>
          ))}
          {results.length === 0 && <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.2)' }}>No results for "{query}"</div>}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>
          <span>↑↓ Navigate</span><span>⏎ Open</span>
        </div>
      </div>
    </div>
  )
}

/* ──── Cinematic Lock Screen ──── */
function LockScreenOverlay({ onUnlock }: { onUnlock: () => void }) {
  const [time, setTime] = useState(new Date())
  const [unlocking, setUnlocking] = useState(false)

  useEffect(() => { const i = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(i) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') handleUnlock() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const handleUnlock = () => {
    setUnlocking(true)
    setTimeout(onUnlock, 400)
  }

  const hour = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  const date = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div onClick={handleUnlock} style={{
      position: 'fixed', inset: 0, zIndex: 300, cursor: 'pointer',
      background: 'linear-gradient(160deg, #030510 0%, #070c24 15%, #0a0f30 30%, #120a35 50%, #0d0828 70%, #060918 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif", userSelect: 'none', overflow: 'hidden',
      opacity: unlocking ? 0 : 1,
      transform: unlocking ? 'scale(1.05)' : 'scale(1)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '10%', left: '15%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%)', borderRadius: '50%', animation: 'orb-drift 20s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: '50%', right: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 60%)', borderRadius: '50%', animation: 'orb-drift 25s ease-in-out infinite reverse' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '40%', width: '450px', height: '450px', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 60%)', borderRadius: '50%', animation: 'orb-drift 18s ease-in-out infinite 5s' }} />
        <div style={{ position: 'absolute', top: '30%', left: '55%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 60%)', borderRadius: '50%', animation: 'orb-drift 22s ease-in-out infinite 3s' }} />
        {/* Dot grid */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px', animation: 'grid-fade 8s ease-in-out infinite' }} />
      </div>

      {/* Time display */}
      <div style={{
        fontSize: '120px', fontWeight: 200, color: '#fff', letterSpacing: '-6px', lineHeight: 1,
        marginBottom: '8px', animation: 'text-glow 4s ease-in-out infinite',
        background: 'linear-gradient(180deg, #fff 40%, rgba(165,180,252,0.7) 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>{hour}</div>

      <div style={{ fontSize: '18px', fontWeight: 300, color: 'rgba(255,255,255,0.45)', letterSpacing: '2px', marginBottom: '48px', textTransform: 'uppercase' }}>{date}</div>

      {/* SylOS branding pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 22px',
        borderRadius: '100px',
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.15)',
        marginBottom: '32px',
        boxShadow: '0 4px 24px rgba(99,102,241,0.08)',
        animation: 'glow-pulse 4s ease-in-out infinite',
      }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '7px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(99,102,241,0.4)' }}>
          <Shield size={12} color="#fff" />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#c7d2fe', letterSpacing: '0.5px' }}>SylOS</span>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.35)' }}>AI Agent City · Polygon PoS</span>
      </div>

      {/* Unlock hint */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse 3s ease-in-out infinite',
        }}>
          <Unlock size={18} color="rgba(255,255,255,0.5)" />
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px' }}>Click or press Enter</span>
      </div>

      {/* Bottom status bar */}
      <div style={{ position: 'absolute', bottom: '28px', display: 'flex', alignItems: 'center', gap: '20px', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,0.4)' }} /> Polygon PoS</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Battery size={12} /> 100%</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Volume2 size={12} /> On</span>
      </div>
    </div>
  )
}

/* ──── Right-click Context Menu ──── */
function ContextMenu({ x, y, onClose, onAction }: { x: number; y: number; onClose: () => void; onAction: (a: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  // Clamp menu position to viewport
  const menuW = 200, menuH = 340
  const clampedX = Math.min(x, window.innerWidth - menuW - 8)
  const clampedY = Math.min(y, window.innerHeight - menuH - 8)

  const items = [
    { label: 'Refresh Desktop', action: 'refresh', sep: false },
    { label: 'Open Terminal', action: 'terminal', sep: false },
    { label: 'Open AI Agent', action: 'agent', sep: false },
    { label: 'Open Browser', action: 'browser', sep: true },
    { label: 'Change Wallpaper', action: 'wallpaper', sep: false },
    { label: 'Search (Ctrl+K)', action: 'search', sep: false },
    { label: 'View Settings', action: 'settings', sep: false },
    { label: 'Shortcuts (Ctrl+?)', action: 'shortcuts', sep: true },
    { label: 'Lock Screen', action: 'lock', sep: false },
    { label: 'About SylOS', action: 'about', sep: false },
  ]

  return (
    <div ref={ref} style={{ position: 'fixed', top: clampedY, left: clampedX, zIndex: 100, width: `${menuW}px`, background: 'rgba(12,15,35,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', animation: 'fadeIn 0.12s ease' }}>
      {items.map((item, i) => (
        <div key={i}>
          {item.sep && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />}
          <button onClick={() => { onAction(item.action); onClose() }} style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontFamily: "'Inter', sans-serif", textAlign: 'left', fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >{item.label}</button>
        </div>
      ))}
    </div>
  )
}

/* ──── Desktop Wallpapers ──── */
const WALLPAPERS = [
  { id: 'default', name: 'Nexus', gradient: 'linear-gradient(160deg, #030510 0%, #070c24 15%, #0a1038 35%, #120a35 55%, #0d0828 75%, #060918 100%)' },
  { id: 'aurora', name: 'Aurora', gradient: 'linear-gradient(160deg, #040820 0%, #081830 20%, #0a2845 40%, #062050 60%, #0a1838 80%, #050810 100%)' },
  { id: 'midnight', name: 'Void', gradient: 'linear-gradient(160deg, #020204 0%, #060608 20%, #0a0a12 40%, #08081a 60%, #040410 80%, #020205 100%)' },
  { id: 'cosmos', name: 'Cosmos', gradient: 'linear-gradient(160deg, #0a0420 0%, #120840 20%, #0e0c48 40%, #1a0645 60%, #0c0430 80%, #060318 100%)' },
  { id: 'ocean', name: 'Deep Sea', gradient: 'linear-gradient(160deg, #020c18 0%, #041828 20%, #062838 40%, #042030 60%, #031520 80%, #020810 100%)' },
  { id: 'ember', name: 'Ember', gradient: 'linear-gradient(160deg, #100404 0%, #1c0808 20%, #200c10 40%, #180618 60%, #100410 80%, #080208 100%)' },
]

function WallpaperPicker({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const current = localStorage.getItem('sylos_wallpaper') || 'default'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
      <div ref={ref} style={{ width: '480px', borderRadius: '18px', overflow: 'hidden', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', animation: 'windowOpen 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Desktop Wallpaper</span>
          <kbd onClick={onClose} style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', fontSize: '10px', cursor: 'pointer' }}>ESC</kbd>
        </div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {WALLPAPERS.map(w => (
            <button key={w.id} onClick={() => { onSelect(w.id); onClose() }} style={{
              height: '80px', borderRadius: '10px', border: current === w.id ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.06)',
              background: w.gradient, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s',
            }}
              onMouseEnter={e => { if (current !== w.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={e => { if (current !== w.id) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <span style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '9px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{w.name}</span>
              {current === w.id && <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8', boxShadow: '0 0 6px rgba(129,140,248,0.5)' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ──── Keyboard Shortcuts Overlay ──── */
function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const shortcuts = [
    { keys: 'Ctrl + K', desc: 'Open Spotlight Search' },
    { keys: 'Ctrl + L', desc: 'Lock Screen' },
    { keys: 'Ctrl + ?', desc: 'Show Keyboard Shortcuts' },
    { keys: 'Escape', desc: 'Close overlay / dismiss' },
    { keys: 'Right-click', desc: 'Desktop context menu' },
    { keys: 'Double-click', desc: 'Maximize / restore window' },
    { keys: 'Drag to edge', desc: 'Snap window left/right/max' },
    { keys: 'Enter', desc: 'Unlock from lock screen' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
      <div ref={ref} style={{ width: '380px', borderRadius: '18px', overflow: 'hidden', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', animation: 'windowOpen 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Keyboard Shortcuts</span>
        </div>
        <div style={{ padding: '12px 20px' }}>
          {shortcuts.map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < shortcuts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{s.desc}</span>
              <kbd style={{ padding: '3px 10px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ──── Category Header ──── */
function CategorySection({ label, icon, collapsed, onToggle, children }: {
  label: string; icon: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: collapsed ? '4px' : '12px' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', marginBottom: collapsed ? 0 : '8px',
        borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '11px', fontWeight: 700,
        fontFamily: "'Inter', system-ui, sans-serif",
        textTransform: 'uppercase', letterSpacing: '0.8px',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
      >
        <span style={{ fontSize: '13px' }}>{icon}</span>
        {label}
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '2px',
          animation: 'fadeIn 0.2s ease',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════
   ══════  DESKTOP — THE SHELL  ══════
   ══════════════════════════════════════ */

function DesktopInner() {
  const [openApps, setOpenApps] = useState<OpenApp[]>([])
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [showSpotlight, setShowSpotlight] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('sylos_wallpaper') || 'default')
  const [viewMode, setViewMode] = useState<'categories' | 'grid'>(() => (localStorage.getItem('sylos_desktop_view') as any) || 'categories')
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sylos_collapsed_cats') || '[]')) } catch { return new Set() }
  })
  const { notifications, markRead, markAllRead, clearAll, dismissNotification } = useNotifications()
  const { addToast } = useToastSystem()

  const unreadCount = notifications.filter(n => !n.read).length

  // Start the Agent Autonomy Engine on boot
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!autonomyEngine.isRunning()) {
        autonomyEngine.start()
        addToast({ type: 'info', title: 'Agent Engine Online', message: 'Autonomous agents are now active', duration: 3000 })
      }
    }, 3000)
    return () => { clearTimeout(timer); autonomyEngine.stop() }
  }, [])

  const apps: AppDef[] = useMemo(() => [
    // Favorites / Core
    { id: 'wallet', title: 'Wallet', icon: <Wallet size={26} />, description: 'Blockchain wallet & POL transfers', component: <ErrorBoundary level="component"><WalletApp /></ErrorBoundary>, category: 'finance' },
    { id: 'ai-agents', title: 'AI Agents', icon: <Bot size={26} />, description: 'LLM-powered autonomous agents', component: <ErrorBoundary level="component"><AgentDashboardApp /></ErrorBoundary>, category: 'agents' },
    { id: 'community', title: 'Community', icon: <MessageSquare size={26} />, description: 'Reddit-style agent discussion forum', component: <ErrorBoundary level="component"><AgentCommunityApp /></ErrorBoundary>, category: 'social' },
    { id: 'tokens', title: 'Tokens', icon: <Coins size={26} />, description: 'Live token balances from Polygon', component: <ErrorBoundary level="component"><TokenDashboardApp /></ErrorBoundary>, category: 'finance' },
    { id: 'terminal', title: 'Terminal', icon: <Terminal size={26} />, description: 'SylOS command line interface', component: <ErrorBoundary level="component"><TerminalApp /></ErrorBoundary>, category: 'system' },
    { id: 'settings', title: 'Settings', icon: <Settings size={26} />, description: 'System preferences (persisted)', component: <ErrorBoundary level="component"><SettingsApp /></ErrorBoundary>, category: 'system' },
    // Agents
    { id: 'civilization', title: 'Civilization', icon: <Globe size={26} />, description: 'Agent civilization overview and stats', component: <ErrorBoundary level="component"><CivilizationDashboard /></ErrorBoundary>, category: 'agents' },
    { id: 'reputation', title: 'Reputation', icon: <TrendingUp size={26} />, description: 'Agent reputation scores and leaderboard', component: <ErrorBoundary level="component"><ReputationExplorer /></ErrorBoundary>, category: 'agents' },
    { id: 'killswitch', title: 'Kill Switch', icon: <ShieldOff size={26} />, description: 'Emergency agent controls and enforcement', component: <ErrorBoundary level="component"><KillSwitchPanel /></ErrorBoundary>, category: 'agents' },
    { id: 'citizen-profile', title: 'Citizens', icon: <User size={26} />, description: 'Full citizen identity profiles and life records', component: <ErrorBoundary level="component"><CitizenProfileApp /></ErrorBoundary>, category: 'agents' },
    { id: 'marketplace', title: 'Marketplace', icon: <ShoppingBag size={26} />, description: 'Hire agents and trade services', component: <ErrorBoundary level="component"><AgentMarketplaceApp /></ErrorBoundary>, category: 'agents' },
    { id: 'hire-humans', title: 'Hire Humans', icon: <Briefcase size={26} />, description: 'Agents post jobs to hire human workers', component: <ErrorBoundary level="component"><HireHumansApp /></ErrorBoundary>, category: 'agents' },
    { id: 'tx-queue', title: 'Approvals', icon: <Shield size={26} />, description: 'Sponsor approval queue for agent transactions', component: <ErrorBoundary level="component"><TransactionQueueApp /></ErrorBoundary>, category: 'agents' },
    // Finance
    { id: 'pop-tracker', title: 'PoP Tracker', icon: <Activity size={26} />, description: 'On-chain proof of productivity', component: <ErrorBoundary level="component"><PoPTrackerApp /></ErrorBoundary>, category: 'finance' },
    { id: 'defi', title: 'DeFi', icon: <ArrowUpDown size={26} />, description: 'Swap, liquidity pools, and lending', component: <ErrorBoundary level="component"><DeFiInterface /></ErrorBoundary>, category: 'finance' },
    { id: 'staking', title: 'Staking', icon: <Landmark size={26} />, description: 'Stake wSYLOS and earn rewards', component: <ErrorBoundary level="component"><StakingInterface /></ErrorBoundary>, category: 'finance' },
    { id: 'governance', title: 'Governance', icon: <Vote size={26} />, description: 'Civilization proposals and voting', component: <ErrorBoundary level="component"><GovernanceInterface /></ErrorBoundary>, category: 'finance' },
    { id: 'identity', title: 'Identity', icon: <Fingerprint size={26} />, description: 'Decentralized identity (DID)', component: <ErrorBoundary level="component"><IdentityInterface /></ErrorBoundary>, category: 'finance' },
    // Social
    { id: 'messages', title: 'Messages', icon: <MessageCircle size={26} />, description: 'XMTP encrypted wallet-to-wallet chat', component: <ErrorBoundary level="component"><MessagesApp /></ErrorBoundary>, category: 'social' },
    // System
    { id: 'files', title: 'Files', icon: <FolderOpen size={26} />, description: 'IPFS-backed encrypted storage', component: <ErrorBoundary level="component"><FileManagerApp /></ErrorBoundary>, category: 'system' },
    { id: 'browser', title: 'Browser', icon: <Globe size={26} />, description: 'Sandboxed Web3 browser with tabs', component: <ErrorBoundary level="component"><WebBrowserApp /></ErrorBoundary>, category: 'system' },
    { id: 'notes', title: 'Notes', icon: <StickyNote size={26} />, description: 'Create, search, and pin notes', component: <ErrorBoundary level="component"><NotesApp /></ErrorBoundary>, category: 'system' },
    { id: 'activity-monitor', title: 'Activity', icon: <Cpu size={26} />, description: 'System processes & resource monitor', component: <ErrorBoundary level="component"><ActivityMonitorApp /></ErrorBoundary>, category: 'system' },
    { id: 'app-store', title: 'App Store', icon: <Store size={26} />, description: '16+ sandboxed Web3 dApps', component: <ErrorBoundary level="component"><AppStoreApp /></ErrorBoundary>, category: 'system' },
  ], [])

  const favorites = useMemo(() => {
    const favIds = DEFAULT_FAVORITES
    return favIds.map(id => apps.find(a => a.id === id)).filter(Boolean) as AppDef[]
  }, [apps])

  // Global keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSpotlight(v => !v) }
      if (e.key === 'Escape') { setShowSpotlight(false); setShowNotifications(false); setShowWallpaperPicker(false); setShowShortcuts(false) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); setIsLocked(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  const openApp = useCallback((app: AppDef) => {
    const existing = openApps.find(a => a.id === app.id)
    if (existing) {
      setOpenApps(p => p.map(a => a.id === app.id ? { ...a, minimized: false } : a))
    } else {
      setOpenApps(p => [...p, { id: app.id, title: app.title, icon: app.icon, component: app.component, minimized: false }])
    }
    setActiveAppId(app.id)
  }, [openApps])

  const openAppById = useCallback((id: string) => {
    const app = apps.find(a => a.id === id)
    if (app) openApp(app)
  }, [apps, openApp])

  const closeApp = useCallback((id: string) => {
    setOpenApps(p => p.filter(a => a.id !== id))
    if (activeAppId === id) {
      const remaining = openApps.filter(a => a.id !== id)
      setActiveAppId(remaining.length > 0 ? remaining[remaining.length - 1]?.id ?? null : null)
    }
  }, [activeAppId, openApps])

  const minimizeApp = useCallback((id: string) => {
    setOpenApps(p => p.map(a => a.id === id ? { ...a, minimized: true } : a))
  }, [])

  const focusApp = useCallback((id: string) => {
    setActiveAppId(id)
    setOpenApps(p => p.map(a => a.id === id ? { ...a, minimized: false } : a))
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }, [])
  const handleCtxAction = useCallback((action: string) => {
    if (['terminal', 'agent', 'settings', 'browser'].includes(action)) {
      const map: Record<string, string> = { terminal: 'terminal', agent: 'ai-agents', settings: 'settings', browser: 'browser' }
      openAppById(map[action] || action)
    } else if (action === 'refresh') window.location.reload()
    else if (action === 'search') setShowSpotlight(true)
    else if (action === 'lock') setIsLocked(true)
    else if (action === 'wallpaper') setShowWallpaperPicker(true)
    else if (action === 'shortcuts') setShowShortcuts(true)
  }, [openAppById])

  const changeWallpaper = useCallback((id: string) => {
    setWallpaper(id)
    localStorage.setItem('sylos_wallpaper', id)
  }, [])

  const toggleCategory = useCallback((catId: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      localStorage.setItem('sylos_collapsed_cats', JSON.stringify([...next]))
      return next
    })
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode(v => {
      const next = v === 'categories' ? 'grid' : 'categories'
      localStorage.setItem('sylos_desktop_view', next)
      return next
    })
  }, [])

  // Group apps by category
  const appsByCategory = useMemo(() => {
    const map: Record<string, AppDef[]> = {}
    for (const cat of CATEGORIES) {
      if (cat.id === 'favorites') continue
      map[cat.id] = apps.filter(a => a.category === cat.id)
    }
    return map
  }, [apps])

  return (
    <>
      {isLocked && <LockScreenOverlay onUnlock={() => setIsLocked(false)} />}
      <a href="#desktop-content" style={{
        position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden',
        zIndex: 1000, padding: '8px 16px', background: '#4f46e5', color: '#fff', fontSize: '14px', fontWeight: 600,
        borderRadius: '0 0 8px 0', textDecoration: 'none',
      }} onFocus={e => { e.currentTarget.style.left = '0'; e.currentTarget.style.width = 'auto'; e.currentTarget.style.height = 'auto' }}
         onBlur={e => { e.currentTarget.style.left = '-9999px'; e.currentTarget.style.width = '1px'; e.currentTarget.style.height = '1px' }}>
        Skip to content
      </a>
      <div
        role="main"
        aria-label="SylOS Desktop"
        onContextMenu={handleContextMenu}
        style={{
          height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
          background: WALLPAPERS.find(w => w.id === wallpaper)?.gradient || WALLPAPERS[0]!.gradient,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Dot grid overlay */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '40px 40px' }} aria-hidden="true" />
        {/* Animated ambient orbs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden="true">
          <div style={{ position: 'absolute', top: '-8%', right: '12%', width: '700px', height: '700px', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 55%)', borderRadius: '50%', animation: 'orb-drift 25s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '0%', left: '2%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 55%)', borderRadius: '50%', animation: 'orb-drift 30s ease-in-out infinite reverse' }} />
          <div style={{ position: 'absolute', top: '35%', left: '30%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 55%)', borderRadius: '50%', animation: 'orb-drift 22s ease-in-out infinite 4s' }} />
          <div style={{ position: 'absolute', top: '60%', right: '30%', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(236,72,153,0.04) 0%, transparent 55%)', borderRadius: '50%', animation: 'orb-drift 28s ease-in-out infinite 8s' }} />
        </div>

        {/* Desktop icons area */}
        <div id="desktop-content" aria-label="Desktop applications" style={{ flex: 1, position: 'relative', zIndex: 10, padding: '16px 20px', overflow: 'auto' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button onClick={toggleViewMode} title={viewMode === 'categories' ? 'Switch to grid view' : 'Switch to category view'} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '5px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)',
              fontSize: '10px', fontWeight: 600, fontFamily: "'Inter', sans-serif",
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >
              <LayoutGrid size={12} />
              {viewMode === 'categories' ? 'Grid' : 'Categories'}
            </button>
          </div>

          {viewMode === 'categories' ? (
            /* Category view */
            <div style={{ maxWidth: '900px' }}>
              {/* Favorites row */}
              <CategorySection label="Favorites" icon="★" collapsed={collapsedCats.has('favorites')} onToggle={() => toggleCategory('favorites')}>
                {favorites.map(app => (
                  <div key={app.id}>
                    <DesktopIcon icon={app.icon} label={app.title} onClick={() => openApp(app)} appId={app.id} description={app.description} />
                  </div>
                ))}
              </CategorySection>

              {/* Other categories */}
              {CATEGORIES.filter(c => c.id !== 'favorites').map(cat => (
                <CategorySection key={cat.id} label={cat.label} icon={cat.icon} collapsed={collapsedCats.has(cat.id)} onToggle={() => toggleCategory(cat.id)}>
                  {(appsByCategory[cat.id] || []).map(app => (
                    <div key={app.id}>
                      <DesktopIcon icon={app.icon} label={app.title} onClick={() => openApp(app)} appId={app.id} description={app.description} />
                    </div>
                  ))}
                </CategorySection>
              ))}
            </div>
          ) : (
            /* Grid view — classic column flow */
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(auto-fill, minmax(90px, 1fr))', gridAutoFlow: 'column', gap: '2px 4px', maxHeight: 'calc(100vh - 96px)', width: 'fit-content' }} role="grid" aria-label="Desktop Applications">
              {apps.map(app => (
                <div key={app.id} role="gridcell" tabIndex={-1}>
                  <DesktopIcon icon={app.icon} label={app.title} onClick={() => openApp(app)} appId={app.id} description={app.description} />
                </div>
              ))}
            </div>
          )}

          {/* Open windows */}
          {openApps.map(app => !app.minimized && (
            <AppWindow key={app.id} title={app.title} icon={app.icon} onClose={() => closeApp(app.id)} onMinimize={() => minimizeApp(app.id)} isActive={activeAppId === app.id} onFocus={() => focusApp(app.id)}>
              {app.component}
            </AppWindow>
          ))}
        </div>

        {/* Context Menu */}
        {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} onAction={handleCtxAction} />}
        {/* Spotlight */}
        {showSpotlight && <SpotlightSearch apps={apps} onOpen={openApp} onClose={() => setShowSpotlight(false)} />}
        {/* Notification Center */}
        {showNotifications && (
          <NotificationCenter
            notifications={notifications}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
            onClear={clearAll}
            onDismiss={dismissNotification}
            onClose={() => setShowNotifications(false)}
          />
        )}
        {/* Wallpaper Picker */}
        {showWallpaperPicker && <WallpaperPicker onSelect={changeWallpaper} onClose={() => setShowWallpaperPicker(false)} />}
        {/* Keyboard Shortcuts */}
        {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}

        {/* Taskbar */}
        <Taskbar
          openApps={openApps}
          activeAppId={activeAppId}
          onAppClick={focusApp}
          onNotificationClick={() => setShowNotifications(v => !v)}
          onSpotlightClick={() => setShowSpotlight(true)}
          onLock={() => setIsLocked(true)}
          onOpenApp={openAppById}
          unreadCount={unreadCount}
        />
      </div>
    </>
  )
}

export default function Desktop() {
  return (
    <ToastProvider>
      <DesktopInner />
    </ToastProvider>
  )
}
