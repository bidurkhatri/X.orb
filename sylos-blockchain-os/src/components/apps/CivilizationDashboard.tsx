/**
 * Civilization Dashboard — The control center for the SylOS digital nation
 *
 * Shows the real state of the civilization: how many agents exist,
 * what they're doing, how much stake is bonded, and recent activity.
 * Reads from on-chain AgentRegistry when deployed, localStorage when not.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Globe, Users, Shield, TrendingUp, AlertTriangle, Activity, Zap, Crown, Eye, BarChart3 } from 'lucide-react'
import { CHAIN } from '../../config/contracts'
import { useAgentRegistry, useSlashingEngine, getReputationColor, ROLE_META, type CivilizationAgent } from '../../hooks/useAgentContracts'
import { supabaseData, type CivilizationStatsRow } from '../../services/db/SupabaseDataService'
import { formatEther } from 'viem'

const rpc = async (method: string, params: unknown[] = []) => {
  const res = await fetch(CHAIN.RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  return (await res.json()).result
}

const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  statCard: (color: string) => ({ background: `linear-gradient(135deg, ${color}10, ${color}05)`, border: `1px solid ${color}20`, borderRadius: '16px', padding: '20px' }) as React.CSSProperties,
  h1: { fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.5px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
}

const tierColor = (tier: string) => {
  switch (tier) {
    case 'ELITE': return '#ffd700'
    case 'TRUSTED': return '#22d3ee'
    case 'RELIABLE': return '#34d399'
    case 'NOVICE': return '#a78bfa'
    default: return '#ef4444'
  }
}

export default function CivilizationDashboard() {
  const { isConnected } = useAccount()
  const { agents, stats, loading: agentsLoading, contractsDeployed } = useAgentRegistry()
  const { totalViolations } = useSlashingEngine()
  const [blockNumber, setBlockNumber] = useState(0)
  const [gasPrice, setGasPrice] = useState('0')
  const [networkLoading, setNetworkLoading] = useState(true)
  const [dbStats, setDbStats] = useState<CivilizationStatsRow | null>(null)

  // Fetch civilization stats from Supabase (supplements on-chain data)
  useEffect(() => {
    supabaseData.fetchCivilizationStats().then(s => { if (s) setDbStats(s) }).catch(() => {})
  }, [])

  const fetchNetwork = useCallback(async () => {
    try {
      const [blockHex, gasPriceHex] = await Promise.all([
        rpc('eth_blockNumber'),
        rpc('eth_gasPrice'),
      ])
      setBlockNumber(parseInt(blockHex || '0', 16))
      setGasPrice((parseInt(gasPriceHex || '0', 16) / 1e9).toFixed(1))
    } catch { /* Network unavailable */ }
    finally { setNetworkLoading(false) }
  }, [])

  useEffect(() => {
    fetchNetwork()
    const interval = setInterval(fetchNetwork, 15000)
    return () => clearInterval(interval)
  }, [fetchNetwork])

  const recentAgents = [...agents]
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .slice(0, 10)

  const loading = agentsLoading || networkLoading

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Globe size={28} style={{ color: '#818cf8' }} />
        <div>
          <h1 style={s.h1}>SylOS Civilization</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Regulated digital civilization for AI agents
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {contractsDeployed && <span style={s.badge('#22c55e')}>ON-CHAIN</span>}
          {!contractsDeployed && <span style={s.badge('#f59e0b')}>LOCAL MODE</span>}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#34d399' : '#ef4444' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {blockNumber > 0 && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>
              Block #{blockNumber.toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div style={s.grid}>
        <div style={s.statCard('#818cf8')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users size={16} style={{ color: '#818cf8' }} />
            <span style={s.label}>Total Agents</span>
          </div>
          <div style={{ ...s.value, color: '#818cf8' }}>{loading ? '—' : stats.totalAgents}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            {stats.activeAgents} active / {stats.pausedAgents} paused / {stats.revokedAgents} revoked
          </div>
        </div>

        <div style={s.statCard('#34d399')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Shield size={16} style={{ color: '#34d399' }} />
            <span style={s.label}>Total Staked</span>
          </div>
          <div style={{ ...s.value, color: '#34d399' }}>
            {loading ? '—' : formatEther(stats.totalStaked)}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>wSYLOS bonded</div>
        </div>

        <div style={s.statCard('#f59e0b')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Crown size={16} style={{ color: '#f59e0b' }} />
            <span style={s.label}>Avg Reputation</span>
          </div>
          <div style={{ ...s.value, color: '#f59e0b' }}>{loading ? '—' : stats.avgReputation}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>out of 10,000</div>
        </div>

        <div style={s.statCard('#ef4444')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span style={s.label}>Total Slashed</span>
          </div>
          <div style={{ ...s.value, color: '#ef4444' }}>
            {loading ? '—' : formatEther(stats.totalSlashed)}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            {totalViolations} violation{totalViolations !== 1 ? 's' : ''} recorded
          </div>
        </div>
      </div>

      {/* Network Status */}
      <div style={{ ...s.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Zap size={16} style={{ color: '#818cf8' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Network Status</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div>
            <div style={s.label}>Chain</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>Polygon PoS</div>
          </div>
          <div>
            <div style={s.label}>Block</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
              {blockNumber > 0 ? `#${blockNumber.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div style={s.label}>Gas Price</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
              {gasPrice !== '0' ? `${gasPrice} Gwei` : '—'}
            </div>
          </div>
          <div>
            <div style={s.label}>Agent Contracts</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: contractsDeployed ? '#34d399' : '#f59e0b' }}>
              {contractsDeployed ? 'Deployed' : 'Pending Deploy'}
            </div>
          </div>
        </div>
      </div>

      {/* Civilization Constitution */}
      <div style={{ ...s.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Civilization Constitution</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {[
            { rule: 'Min Stake Bond', value: '100 wSYLOS', icon: Shield },
            { rule: 'Max Agents/Sponsor', value: '10', icon: Users },
            { rule: 'Auto-Pause Threshold', value: 'Rep < 500', icon: AlertTriangle },
            { rule: 'Rate Limit Slash', value: '5% of stake', icon: Zap },
            { rule: 'Permission Violation Slash', value: '10% of stake', icon: Eye },
            { rule: 'Critical Fault Slash', value: '50% + Revoke', icon: AlertTriangle },
          ].map(r => (
            <div key={r.rule} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)' }}>
              <r.icon size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{r.rule}</div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reputation Tiers — showing actual agent counts per tier */}
      <div style={{ ...s.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <TrendingUp size={16} style={{ color: '#22d3ee' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Reputation Tiers</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { tier: 'ELITE', range: '8500-10000', desc: 'Maximum trust', count: agents.filter(a => a.reputationTier === 'ELITE').length },
            { tier: 'TRUSTED', range: '6000-8499', desc: 'Elevated privileges', count: agents.filter(a => a.reputationTier === 'TRUSTED').length },
            { tier: 'RELIABLE', range: '3000-5999', desc: 'Standard operations', count: agents.filter(a => a.reputationTier === 'RELIABLE').length },
            { tier: 'NOVICE', range: '1000-2999', desc: 'Basic access only', count: agents.filter(a => a.reputationTier === 'NOVICE').length },
            { tier: 'UNTRUSTED', range: '0-999', desc: 'Restricted / auto-paused', count: agents.filter(a => a.reputationTier === 'UNTRUSTED').length },
          ].map(t => (
            <div key={t.tier} style={{ flex: '1 1 150px', padding: '12px', borderRadius: '12px', background: `${tierColor(t.tier)}08`, border: `1px solid ${tierColor(t.tier)}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={s.badge(tierColor(t.tier))}>{t.tier}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: tierColor(t.tier) }}>{t.count}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{t.range}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Activity Feed — from real data */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Activity size={16} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Citizens</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            {agents.length > 0 ? `${agents.length} registered` : ''}
          </span>
        </div>
        {recentAgents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            <Globe size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No agents in the civilization yet.</p>
            <p style={{ fontSize: '11px' }}>Open the <strong>AI Agents</strong> app to spawn your first licensed worker.</p>
          </div>
        ) : (
          recentAgents.map(agent => {
            const meta = ROLE_META[agent.role]
            const statusColors: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', revoked: '#ef4444', expired: '#6b7280' }
            const lastActive = agent.lastActiveAt > 0
              ? Math.floor((Date.now() / 1000 - agent.lastActiveAt) / 60)
              : -1
            const timeAgo = lastActive < 0 ? 'Never' : lastActive < 60 ? `${lastActive}m ago` : `${Math.floor(lastActive / 60)}h ago`
            return (
              <div key={agent.agentId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{agent.name}</span>
                    <span style={s.badge(tierColor(agent.reputationTier))}>{agent.reputationTier}</span>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColors[agent.status] }} />
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>
                    {meta.label} · {agent.totalActions} actions · Rep {agent.reputation}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', textAlign: 'right', flexShrink: 0 }}>
                  {timeAgo}
                  <div style={{ fontSize: '9px', marginTop: '2px' }}>
                    {formatEther(agent.stakeBond)} staked
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
