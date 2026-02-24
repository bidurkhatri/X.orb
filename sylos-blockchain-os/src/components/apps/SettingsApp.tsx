import { useState, useEffect, useRef } from 'react'
import {
  Settings as SettingsIcon, Monitor, Bell, Palette, Shield, Globe, Database,
  Eye, Volume2, Wifi, ChevronRight, ChevronDown, Moon, Sun, Zap, Lock, Bot, Key
} from 'lucide-react'
import { agentRegistry } from '@/services/agent/AgentRegistry'
import { ROLE_META, getReputationColor } from '@/services/agent/AgentRoles'

const PREFS_KEY = 'sylos_settings'

interface Prefs {
  theme: 'dark' | 'midnight' | 'amoled'
  accentColor: string
  fontSize: number
  animations: boolean
  sounds: boolean
  notifications: boolean
  autoLock: number
  transparency: number
  rpcUrl: string
  chainId: string
}

const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  accentColor: '#6366f1',
  fontSize: 14,
  animations: true,
  sounds: false,
  notifications: true,
  autoLock: 5,
  transparency: 82,
  rpcUrl: 'https://polygon-rpc.com',
  chainId: '137',
}

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } } catch { return DEFAULT_PREFS }
}

function savePrefs(p: Prefs) { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) }

const sections = [
  { id: 'display', label: 'Display', icon: <Monitor size={16} /> },
  { id: 'agents', label: 'AI Agents', icon: <Bot size={16} /> },
  { id: 'credentials', label: 'Credentials', icon: <Key size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'privacy', label: 'Privacy & Security', icon: <Shield size={16} /> },
  { id: 'network', label: 'Network', icon: <Globe size={16} /> },
  { id: 'storage', label: 'Storage', icon: <Database size={16} /> },
  { id: 'about', label: 'About SylOS', icon: <Zap size={16} /> },
]

const accentColors = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6',
]

export default function SettingsApp() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [active, setActive] = useState('display')

  const update = (partial: Partial<Prefs>) => {
    const next = { ...prefs, ...partial }
    setPrefs(next)
    savePrefs(next)
  }

  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: '#fff' }
  const subStyle: React.CSSProperties = { fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} style={{
      width: '42px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', padding: '2px',
      background: value ? prefs.accentColor : 'rgba(255,255,255,0.1)', transition: 'all 0.2s ease', position: 'relative',
    }}>
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
        transition: 'transform 0.2s ease', transform: value ? 'translateX(18px)' : 'translateX(0)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )

  const Slider = ({ value, onChange, min = 0, max = 100 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
    <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{
      width: '140px', height: '4px', WebkitAppearance: 'none', background: `linear-gradient(to right, ${prefs.accentColor} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) ${((value - min) / (max - min)) * 100}%)`,
      borderRadius: '2px', outline: 'none', cursor: 'pointer',
    }} />
  )

  const renderSection = () => {
    switch (active) {
      case 'display':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Display</h3>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Theme</div><div style={subStyle}>System color scheme</div></div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['dark', 'midnight', 'amoled'] as const).map(t => (
                  <button key={t} onClick={() => update({ theme: t })} style={{
                    padding: '6px 12px', borderRadius: '8px', border: `1px solid ${prefs.theme === t ? prefs.accentColor : 'rgba(255,255,255,0.08)'}`,
                    background: prefs.theme === t ? `${prefs.accentColor}20` : 'rgba(255,255,255,0.03)',
                    color: prefs.theme === t ? prefs.accentColor : 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Font Size</div><div style={subStyle}>{prefs.fontSize}px</div></div>
              <Slider value={prefs.fontSize} onChange={v => update({ fontSize: v })} min={10} max={20} />
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>UI Transparency</div><div style={subStyle}>{prefs.transparency}%</div></div>
              <Slider value={prefs.transparency} onChange={v => update({ transparency: v })} min={50} max={100} />
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Animations</div><div style={subStyle}>Enable motion effects</div></div>
              <Toggle value={prefs.animations} onChange={v => update({ animations: v })} />
            </div>
          </>
        )

      case 'notifications':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Notifications</h3>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Push Notifications</div><div style={subStyle}>Transaction alerts and system events</div></div>
              <Toggle value={prefs.notifications} onChange={v => update({ notifications: v })} />
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Sound Effects</div><div style={subStyle}>Audio feedback for actions</div></div>
              <Toggle value={prefs.sounds} onChange={v => update({ sounds: v })} />
            </div>
          </>
        )

      case 'appearance':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Appearance</h3>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Accent Color</div><div style={subStyle}>System highlight color</div></div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {accentColors.map(c => (
                  <button key={c} onClick={() => update({ accentColor: c })} style={{
                    width: '24px', height: '24px', borderRadius: '50%', border: prefs.accentColor === c ? '2px solid #fff' : '2px solid transparent',
                    background: c, cursor: 'pointer', outline: prefs.accentColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px',
                  }} />
                ))}
              </div>
            </div>
          </>
        )

      case 'privacy':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Privacy & Security</h3>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Auto-Lock</div><div style={subStyle}>Lock after {prefs.autoLock} minutes of inactivity</div></div>
              <Slider value={prefs.autoLock} onChange={v => update({ autoLock: v })} min={1} max={30} />
            </div>
            <div style={{ padding: '14px 0', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              All data is stored locally in your browser. Your private keys never leave your wallet.
            </div>
          </>
        )

      case 'network':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Network</h3>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>RPC Endpoint</div>
                <input value={prefs.rpcUrl} onChange={e => update({ rpcUrl: e.target.value })} style={{
                  width: '100%', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box',
                }} />
              </div>
            </div>
            <div style={rowStyle}>
              <div><div style={labelStyle}>Chain ID</div><div style={subStyle}>Polygon PoS</div></div>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>{prefs.chainId}</span>
            </div>
          </>
        )

      case 'storage':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Storage</h3>
            {(() => {
              let total = 0
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (k) total += (localStorage.getItem(k) || '').length
              }
              const kb = (total / 1024).toFixed(1)
              const pct = Math.min(100, (total / (5 * 1024 * 1024)) * 100)
              return (
                <>
                  <div style={{ padding: '14px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={labelStyle}>Local Storage</span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{kb} KB / 5 MB</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${prefs.accentColor}, #8b5cf6)`, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                  <button onClick={() => { if (confirm('Clear all local data? This will reset settings and agent history.')) { localStorage.clear(); setPrefs(DEFAULT_PREFS) } }} style={{
                    padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.08)',
                    color: '#fca5a5', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Clear All Data
                  </button>
                </>
              )
            })()}
          </>
        )

      case 'agents': {
        const allAgents = agentRegistry.getAllAgents()
        const active = allAgents.filter(a => a.status === 'active')
        const paused = allAgents.filter(a => a.status === 'paused')
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>AI Agent Management</h3>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, marginBottom: '8px' }}>
                SylOS is a regulated digital civilization. AI agents are <strong style={{ color: '#a5b4fc' }}>licensed workers</strong> — not chatbots. Spawn, monitor, and manage agents from the <strong style={{ color: '#a5b4fc' }}>Agent Dashboard</strong> app.
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <span style={{ color: '#22c55e' }}>● {active.length} Active</span>
                <span style={{ color: '#f59e0b' }}>● {paused.length} Paused</span>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{allAgents.length} Total</span>
              </div>
            </div>
            {allAgents.length > 0 ? allAgents.slice(0, 10).map(a => {
              const meta = ROLE_META[a.role]
              const repColor = getReputationColor(a.reputationTier)
              return (
                <div key={a.agentId} style={{ ...rowStyle, gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{meta.icon}</span> {a.name}
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '100px', background: a.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: a.status === 'active' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>{a.status}</span>
                    </div>
                    <div style={subStyle}>{meta.label} · Rep {a.reputation}/10000 ({a.reputationTier}) · {a.totalActionsExecuted} actions</div>
                  </div>
                  <div style={{ width: '60px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ width: `${Math.min(100, a.reputation / 100)}%`, height: '100%', borderRadius: '2px', background: repColor }} />
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                No agents registered yet. Open the Agent Dashboard to spawn your first licensed worker.
              </div>
            )}
          </>
        )
      }

      case 'credentials':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>Credentials</h3>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                🔒 API keys are stored per-agent in localStorage. Each agent receives its LLM credentials during spawn. Your wallet private keys never leave your browser wallet (MetaMask/WalletConnect).
              </div>
            </div>
            {(() => {
              const agents = agentRegistry.getAllAgents()
              const credsCount = agents.filter(a => a.llmProvider.apiKey).length
              return (
                <>
                  <div style={rowStyle}>
                    <div><div style={labelStyle}>Stored API Keys</div><div style={subStyle}>{credsCount} agent{credsCount !== 1 ? 's' : ''} with LLM credentials</div></div>
                    <span style={{ fontSize: '12px', color: credsCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{credsCount > 0 ? '🔑 Active' : 'None'}</span>
                  </div>
                  <div style={rowStyle}>
                    <div><div style={labelStyle}>Wallet Keys</div><div style={subStyle}>Managed by MetaMask / WalletConnect</div></div>
                    <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>🔒 Hardware</span>
                  </div>
                  <div style={rowStyle}>
                    <div><div style={labelStyle}>RPC Credentials</div><div style={subStyle}>Polygon RPC endpoint (public)</div></div>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Public</span>
                  </div>
                </>
              )
            })()}
          </>
        )

      case 'about':
        return (
          <>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0' }}>About SylOS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                ['Version', '2.0.0-civilization'],
                ['Build', 'React 18 + Vite 5'],
                ['Chain', 'Polygon PoS (ID 137)'],
                ['Wallet', 'wagmi + RainbowKit'],
                ['Agent System', 'Regulated Civilization'],
                ['Messaging', 'XMTP Protocol'],
                ['Storage', 'IPFS (Pinata)'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                  <span style={{ fontSize: '12px', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', textAlign: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#a5b4fc', marginBottom: '4px' }}>SylOS — Blockchain Operating System</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>A regulated digital civilization where humans are citizens and AI agents are licensed workers</div>
            </div>
          </>
        )
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
      {/* Sidebar */}
      <div style={{ width: '200px', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '16px 0', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ padding: '0 16px 12px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Settings</div>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            background: active === s.id ? `${prefs.accentColor}15` : 'transparent',
            borderLeft: active === s.id ? `3px solid ${prefs.accentColor}` : '3px solid transparent',
            color: active === s.id ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
            transition: 'all 0.15s ease', textAlign: 'left',
          }}>
            <span style={{ color: active === s.id ? prefs.accentColor : 'rgba(255,255,255,0.3)' }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {renderSection()}
      </div>
    </div>
  )
}
