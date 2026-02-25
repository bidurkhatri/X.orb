/**
 * KillSwitch Panel — Emergency Agent Controls
 *
 * Provides sponsors and governance with emergency controls:
 * - Pause/revoke all agents
 * - View and manage slashing events
 * - Active violation monitoring
 * - Emergency shutdown capabilities
 */

import { useState, useEffect, useCallback } from 'react'
import { ShieldOff, AlertTriangle, Pause, Play, Trash2, Shield, Users, Zap, Clock, Activity, RefreshCw, ChevronRight } from 'lucide-react'
import { useAccount } from 'wagmi'
import { agentRegistry, type RegisteredAgent } from '@/services/agent/AgentRegistry'
import { getReputationColor, ROLE_META } from '@/services/agent/AgentRoles'

/* ── Styles ── */
const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #0c0412 0%, #120a1e 40%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  dangerCard: { background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  btn: (color: string, filled = false) => ({
    padding: '8px 16px', borderRadius: '10px', border: filled ? 'none' : `1px solid ${color}30`,
    background: filled ? `linear-gradient(135deg, ${color}, ${color}cc)` : `${color}10`,
    color: filled ? '#fff' : color, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
  }) as React.CSSProperties,
}

interface SlashEvent {
  id: string
  agentName: string
  agentId: string
  violationType: string
  amount: string
  repPenalty: number
  timestamp: number
  autoRevoked: boolean
}

function AgentControlRow({ agent, onPause, onResume, onRevoke }: {
  agent: RegisteredAgent
  onPause: () => void
  onResume: () => void
  onRevoke: () => void
}) {
  const meta = ROLE_META[agent.role]
  const tierColor = getReputationColor(agent.reputationTier)
  const statusColors: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', revoked: '#ef4444', expired: '#6b7280' }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '8px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{agent.name}</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColors[agent.status] }} />
          <span style={{ fontSize: '10px', color: statusColors[agent.status], fontWeight: 600, textTransform: 'uppercase' }}>{agent.status}</span>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
          {meta.label} · Rep: <span style={{ color: tierColor }}>{agent.reputation}</span> · Slashes: {agent.slashEvents}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {agent.status === 'active' && (
          <button onClick={onPause} style={s.btn('#f59e0b')}>
            <Pause size={12} /> Pause
          </button>
        )}
        {agent.status === 'paused' && (
          <button onClick={onResume} style={s.btn('#22c55e')}>
            <Play size={12} /> Resume
          </button>
        )}
        {agent.status !== 'revoked' && (
          <button onClick={onRevoke} style={s.btn('#ef4444')}>
            <Trash2 size={12} /> Revoke
          </button>
        )}
      </div>
    </div>
  )
}

export default function KillSwitchPanel() {
  const { address } = useAccount()
  const [agents, setAgents] = useState<RegisteredAgent[]>([])
  const [slashEvents] = useState<SlashEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmPauseAll, setConfirmPauseAll] = useState(false)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])

  const sponsorAddr = address || '0xUnconnected'

  const refresh = useCallback(() => {
    setLoading(true)
    const all = address ? agentRegistry.getAgentsBySponsor(address) : []
    setAgents(all)
    setLoading(false)
  }, [address])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const log = (msg: string) => {
    setActionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const handlePause = (agent: RegisteredAgent) => {
    try {
      agentRegistry.pauseAgent(agent.agentId, sponsorAddr)
      log(`Paused agent: ${agent.name}`)
      refresh()
    } catch (e: any) { log(`Failed to pause ${agent.name}: ${e.message}`) }
  }

  const handleResume = (agent: RegisteredAgent) => {
    try {
      agentRegistry.resumeAgent(agent.agentId, sponsorAddr)
      log(`Resumed agent: ${agent.name}`)
      refresh()
    } catch (e: any) { log(`Failed to resume ${agent.name}: ${e.message}`) }
  }

  const handleRevoke = (agent: RegisteredAgent) => {
    if (!confirm(`Permanently revoke "${agent.name}"? This will slash its stake bond and cannot be undone.`)) return
    try {
      agentRegistry.revokeAgent(agent.agentId, sponsorAddr)
      log(`REVOKED agent: ${agent.name} (stake slashed)`)
      refresh()
    } catch (e: any) { log(`Failed to revoke ${agent.name}: ${e.message}`) }
  }

  const handlePauseAll = () => {
    const active = agents.filter(a => a.status === 'active')
    active.forEach(a => {
      try {
        agentRegistry.pauseAgent(a.agentId, sponsorAddr)
        log(`Paused: ${a.name}`)
      } catch { /* skip already paused */ }
    })
    setConfirmPauseAll(false)
    refresh()
    log(`EMERGENCY: Paused ${active.length} agents`)
  }

  const handleRevokeAll = () => {
    const alive = agents.filter(a => a.status !== 'revoked')
    alive.forEach(a => {
      try {
        agentRegistry.revokeAgent(a.agentId, sponsorAddr)
        log(`Revoked: ${a.name}`)
      } catch { /* skip */ }
    })
    setConfirmRevokeAll(false)
    refresh()
    log(`NUCLEAR: Revoked all ${alive.length} agents`)
  }

  const activeCount = agents.filter(a => a.status === 'active').length
  const pausedCount = agents.filter(a => a.status === 'paused').length
  const revokedCount = agents.filter(a => a.status === 'revoked').length
  const totalStaked = agents.reduce((sum, a) => sum + Number(a.stakeBond) / 1e18, 0)
  const totalSlashed = agents.reduce((sum, a) => sum + a.slashEvents, 0)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <ShieldOff size={28} style={{ color: '#ef4444' }} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 2px 0', letterSpacing: '-0.5px' }}>Kill Switch</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Emergency agent controls and enforcement panel
          </p>
        </div>
        <button onClick={refresh} style={{ marginLeft: 'auto', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {!address ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '60px 40px' }}>
          <Shield size={40} style={{ color: 'rgba(255,255,255,0.1)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Wallet Not Connected</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>Connect your wallet to manage your sponsored agents.</div>
        </div>
      ) : (
        <>
          {/* Status Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #22c55e08, transparent)', border: '1px solid #22c55e15', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Active</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>{activeCount}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f59e0b08, transparent)', border: '1px solid #f59e0b15', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Paused</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>{pausedCount}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #ef444408, transparent)', border: '1px solid #ef444415', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Revoked</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{revokedCount}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #818cf808, transparent)', border: '1px solid #818cf815', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Staked</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>{totalStaked.toFixed(0)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f4364c08, transparent)', border: '1px solid #f4364c15', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Slash Events</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f4364c', marginTop: '4px' }}>{totalSlashed}</div>
            </div>
          </div>

          {/* Emergency Controls */}
          <div style={{ ...s.dangerCard, marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Emergency Controls</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(239,68,68,0.5)' }}>Irreversible actions require confirmation</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Pause All */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pause size={14} /> Pause All Agents
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px', lineHeight: 1.5 }}>
                  Immediately pause all {activeCount} active agents. They can be individually resumed later.
                </div>
                {!confirmPauseAll ? (
                  <button onClick={() => setConfirmPauseAll(true)} disabled={activeCount === 0} style={{ ...s.btn('#f59e0b', true), opacity: activeCount === 0 ? 0.3 : 1, cursor: activeCount === 0 ? 'default' : 'pointer', width: '100%', justifyContent: 'center' }}>
                    <Pause size={14} /> Pause All ({activeCount})
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handlePauseAll} style={{ ...s.btn('#f59e0b', true), flex: 1, justifyContent: 'center' }}>
                      Confirm Pause
                    </button>
                    <button onClick={() => setConfirmPauseAll(false)} style={{ ...s.btn('rgba(255,255,255,0.3)'), flex: 1, justifyContent: 'center' }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Revoke All */}
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} /> Nuclear: Revoke All
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px', lineHeight: 1.5 }}>
                  Permanently revoke all agents and slash their stake bonds. This cannot be undone.
                </div>
                {!confirmRevokeAll ? (
                  <button onClick={() => setConfirmRevokeAll(true)} disabled={agents.filter(a => a.status !== 'revoked').length === 0} style={{ ...s.btn('#ef4444', true), opacity: agents.filter(a => a.status !== 'revoked').length === 0 ? 0.3 : 1, cursor: agents.filter(a => a.status !== 'revoked').length === 0 ? 'default' : 'pointer', width: '100%', justifyContent: 'center' }}>
                    <Trash2 size={14} /> Revoke All ({agents.filter(a => a.status !== 'revoked').length})
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleRevokeAll} style={{ ...s.btn('#ef4444', true), flex: 1, justifyContent: 'center' }}>
                      CONFIRM REVOKE
                    </button>
                    <button onClick={() => setConfirmRevokeAll(false)} style={{ ...s.btn('rgba(255,255,255,0.3)'), flex: 1, justifyContent: 'center' }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '16px' }}>
            {/* Agent Control List */}
            <div style={s.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Users size={14} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Individual Agent Controls</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{agents.length} total</span>
              </div>

              {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Loading...</div>
              ) : agents.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                  No agents found for your wallet.
                </div>
              ) : (
                agents.map(agent => (
                  <AgentControlRow
                    key={agent.agentId}
                    agent={agent}
                    onPause={() => handlePause(agent)}
                    onResume={() => handleResume(agent)}
                    onRevoke={() => handleRevoke(agent)}
                  />
                ))
              )}
            </div>

            {/* Right Column: Slash History + Action Log */}
            <div>
              {/* Slash History */}
              <div style={{ ...s.card, marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Zap size={14} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Slash History</span>
                </div>
                {slashEvents.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>
                    <Shield size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ margin: 0 }}>No slashing events recorded</p>
                  </div>
                ) : (
                  slashEvents.map(event => (
                    <div key={event.id} style={{ padding: '10px', borderRadius: '8px', background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.06)', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#f87171' }}>{event.agentName}</span>
                        {event.autoRevoked && <span style={s.badge('#ef4444')}>AUTO-REVOKED</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', display: 'flex', gap: '8px' }}>
                        <span>{event.violationType}</span>
                        <ChevronRight size={10} style={{ opacity: 0.3 }} />
                        <span>-{event.amount} wSYLOS</span>
                        <ChevronRight size={10} style={{ opacity: 0.3 }} />
                        <span>-{event.repPenalty} rep</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Action Log */}
              <div style={s.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Activity size={14} style={{ color: '#22c55e' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Action Log</span>
                  {actionLog.length > 0 && (
                    <button onClick={() => setActionLog([])} style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
                  )}
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {actionLog.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>
                      <Clock size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                      <p style={{ margin: 0 }}>Actions will appear here</p>
                    </div>
                  ) : (
                    actionLog.map((entry, i) => (
                      <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: entry.includes('REVOKED') || entry.includes('NUCLEAR') ? '#f87171' : entry.includes('Paused') || entry.includes('EMERGENCY') ? '#f59e0b' : entry.includes('Resumed') ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                        {entry}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
