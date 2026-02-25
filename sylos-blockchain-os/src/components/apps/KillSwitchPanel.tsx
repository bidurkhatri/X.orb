/**
 * KillSwitch Panel — Emergency Agent Controls
 *
 * Provides sponsors with emergency controls over their agents:
 * - Pause/revoke individual agents (on-chain when deployed)
 * - Pause all / revoke all emergency buttons
 * - View slashing history
 * - Action log with timestamps
 *
 * Uses useAgentRegistry hook which calls smart contracts when deployed,
 * or falls back to localStorage when contracts aren't live yet.
 */

import { useState, useEffect } from 'react'
import { ShieldOff, AlertTriangle, Pause, Play, Trash2, Shield, Users, Zap, Clock, Activity, RefreshCw, ChevronRight } from 'lucide-react'
import { useAccount } from 'wagmi'
import { useAgentRegistry, useSlashingEngine, getReputationColor, ROLE_META, type CivilizationAgent } from '../../hooks/useAgentContracts'
import { formatEther } from 'viem'

const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #0c0412 0%, #120a1e 40%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  dangerCard: { background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  btn: (color: string, filled = false) => ({
    padding: '8px 16px', borderRadius: '10px', border: filled ? 'none' : `1px solid ${color}30`,
    background: filled ? `linear-gradient(135deg, ${color}, ${color}cc)` : `${color}10`,
    color: filled ? '#fff' : color, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
  }) as React.CSSProperties,
}

function AgentControlRow({ agent, onPause, onResume, onRevoke, txPending }: {
  agent: CivilizationAgent; onPause: () => void; onResume: () => void; onRevoke: () => void; txPending: boolean
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
          {agent.source === 'chain' && <span style={s.badge('#22c55e')}>ON-CHAIN</span>}
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
          {meta.label} · Rep: <span style={{ color: tierColor }}>{agent.reputation}</span> · Staked: {formatEther(agent.stakeBond)} · Slashed: {formatEther(agent.slashedAmount)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {agent.status === 'active' && (
          <button onClick={onPause} disabled={txPending} style={{ ...s.btn('#f59e0b'), opacity: txPending ? 0.5 : 1 }}>
            <Pause size={12} /> Pause
          </button>
        )}
        {agent.status === 'paused' && (
          <button onClick={onResume} disabled={txPending} style={{ ...s.btn('#22c55e'), opacity: txPending ? 0.5 : 1 }}>
            <Play size={12} /> Resume
          </button>
        )}
        {agent.status !== 'revoked' && (
          <button onClick={onRevoke} disabled={txPending} style={{ ...s.btn('#ef4444'), opacity: txPending ? 0.5 : 1 }}>
            <Trash2 size={12} /> Revoke
          </button>
        )}
      </div>
    </div>
  )
}

export default function KillSwitchPanel() {
  const { address } = useAccount()
  const { myAgents, stats, loading, txPending, contractsDeployed, refresh, pauseAgent, resumeAgent, revokeAgent } = useAgentRegistry()
  const { totalViolations, totalSlashed: slashTotal } = useSlashingEngine()
  const [confirmPauseAll, setConfirmPauseAll] = useState(false)
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false)
  const [actionLog, setActionLog] = useState<string[]>([])

  const log = (msg: string) => {
    setActionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50))
  }

  const handlePause = (agent: CivilizationAgent) => {
    pauseAgent(agent.agentId)
    log(`Paused agent: ${agent.name}${contractsDeployed ? ' (tx submitted)' : ''}`)
  }

  const handleResume = (agent: CivilizationAgent) => {
    resumeAgent(agent.agentId)
    log(`Resumed agent: ${agent.name}${contractsDeployed ? ' (tx submitted)' : ''}`)
  }

  const handleRevoke = (agent: CivilizationAgent) => {
    if (!confirm(`Permanently revoke "${agent.name}"? This will slash its stake bond and cannot be undone.`)) return
    revokeAgent(agent.agentId)
    log(`REVOKED agent: ${agent.name} (stake slashed)${contractsDeployed ? ' — on-chain tx submitted' : ''}`)
  }

  const handlePauseAll = () => {
    const active = myAgents.filter(a => a.status === 'active')
    active.forEach(a => {
      pauseAgent(a.agentId)
      log(`Paused: ${a.name}`)
    })
    setConfirmPauseAll(false)
    log(`EMERGENCY: Paused ${active.length} agents`)
  }

  const handleRevokeAll = () => {
    const alive = myAgents.filter(a => a.status !== 'revoked')
    alive.forEach(a => {
      revokeAgent(a.agentId)
      log(`Revoked: ${a.name}`)
    })
    setConfirmRevokeAll(false)
    log(`NUCLEAR: Revoked all ${alive.length} agents`)
  }

  const activeCount = myAgents.filter(a => a.status === 'active').length
  const pausedCount = myAgents.filter(a => a.status === 'paused').length
  const revokedCount = myAgents.filter(a => a.status === 'revoked').length
  const myTotalStaked = myAgents.reduce((sum, a) => sum + a.stakeBond, BigInt(0))

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <ShieldOff size={28} style={{ color: '#ef4444' }} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 2px 0', letterSpacing: '-0.5px' }}>Kill Switch</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Emergency agent controls
            {contractsDeployed ? ' — on-chain enforcement active' : ' — local mode (contracts pending deployment)'}
          </p>
        </div>
        {txPending && <span style={{ ...s.badge('#f59e0b'), marginLeft: '8px' }}>TX PENDING</span>}
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
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>{formatEther(myTotalStaked)}</div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f4364c08, transparent)', border: '1px solid #f4364c15', borderRadius: '14px', padding: '14px' }}>
              <div style={s.label}>Violations</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#f4364c', marginTop: '4px' }}>{totalViolations}</div>
            </div>
          </div>

          {/* Emergency Controls */}
          <div style={{ ...s.dangerCard, marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={16} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444' }}>Emergency Controls</span>
              {contractsDeployed && <span style={{ ...s.badge('#ef4444'), marginLeft: '8px' }}>ON-CHAIN</span>}
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(239,68,68,0.5)' }}>Irreversible actions require confirmation</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pause size={14} /> Pause All Agents
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px', lineHeight: 1.5 }}>
                  Immediately pause all {activeCount} active agents. They can be individually resumed later.
                </div>
                {!confirmPauseAll ? (
                  <button onClick={() => setConfirmPauseAll(true)} disabled={activeCount === 0 || txPending} style={{ ...s.btn('#f59e0b', true), opacity: activeCount === 0 || txPending ? 0.3 : 1, width: '100%', justifyContent: 'center' }}>
                    <Pause size={14} /> Pause All ({activeCount})
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handlePauseAll} style={{ ...s.btn('#f59e0b', true), flex: 1, justifyContent: 'center' }}>Confirm Pause</button>
                    <button onClick={() => setConfirmPauseAll(false)} style={{ ...s.btn('rgba(255,255,255,0.3)'), flex: 1, justifyContent: 'center' }}>Cancel</button>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ef4444', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={14} /> Nuclear: Revoke All
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px', lineHeight: 1.5 }}>
                  Permanently revoke all agents and slash their stake bonds. This cannot be undone.
                </div>
                {!confirmRevokeAll ? (
                  <button onClick={() => setConfirmRevokeAll(true)} disabled={myAgents.filter(a => a.status !== 'revoked').length === 0 || txPending} style={{ ...s.btn('#ef4444', true), opacity: myAgents.filter(a => a.status !== 'revoked').length === 0 || txPending ? 0.3 : 1, width: '100%', justifyContent: 'center' }}>
                    <Trash2 size={14} /> Revoke All ({myAgents.filter(a => a.status !== 'revoked').length})
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleRevokeAll} style={{ ...s.btn('#ef4444', true), flex: 1, justifyContent: 'center' }}>CONFIRM REVOKE</button>
                    <button onClick={() => setConfirmRevokeAll(false)} style={{ ...s.btn('rgba(255,255,255,0.3)'), flex: 1, justifyContent: 'center' }}>Cancel</button>
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
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Your Agents</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{myAgents.length} total</span>
              </div>
              {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Loading...</div>
              ) : myAgents.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                  No agents found for your wallet. Spawn agents from the AI Agents app.
                </div>
              ) : (
                myAgents.map(agent => (
                  <AgentControlRow
                    key={agent.agentId} agent={agent} txPending={txPending}
                    onPause={() => handlePause(agent)}
                    onResume={() => handleResume(agent)}
                    onRevoke={() => handleRevoke(agent)}
                  />
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
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {actionLog.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '11px' }}>
                    <Clock size={20} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ margin: 0 }}>Actions will appear here</p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px' }}>
                      {contractsDeployed ? 'On-chain transactions are logged' : 'Local actions are logged'}
                    </p>
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
        </>
      )}
    </div>
  )
}
