import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Globe, Users, Shield, TrendingUp, AlertTriangle, Activity, Zap, Crown, Eye, BarChart3 } from 'lucide-react'
import { CHAIN } from '../../config/contracts'

const rpc = async (method: string, params: unknown[] = []) => {
  const res = await fetch(CHAIN.RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  return (await res.json()).result
}

interface CivStats {
  totalAgents: number
  activeAgents: number
  pausedAgents: number
  revokedAgents: number
  totalStaked: string
  totalSlashed: string
  avgReputation: number
  blockNumber: number
  gasPrice: string
}

const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  statCard: (color: string) => ({ background: `linear-gradient(135deg, ${color}10, ${color}05)`, border: `1px solid ${color}20`, borderRadius: '16px', padding: '20px' }) as React.CSSProperties,
  h1: { fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', letterSpacing: '-0.5px' } as React.CSSProperties,
  h2: { fontSize: '15px', fontWeight: 600, margin: '0 0 16px 0', color: 'rgba(255,255,255,0.7)' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' } as React.CSSProperties,
  row: { display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' as const } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
}

interface AgentFeedItem {
  id: string
  agentName: string
  action: string
  tier: string
  time: string
}

export default function CivilizationDashboard() {
  const { isConnected } = useAccount()
  const [stats, setStats] = useState<CivStats>({
    totalAgents: 0, activeAgents: 0, pausedAgents: 0, revokedAgents: 0,
    totalStaked: '0', totalSlashed: '0', avgReputation: 5000,
    blockNumber: 0, gasPrice: '0',
  })
  const [loading, setLoading] = useState(true)
  const [feed] = useState<AgentFeedItem[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const [blockHex, gasPriceHex] = await Promise.all([
        rpc('eth_blockNumber'),
        rpc('eth_gasPrice'),
      ])
      setStats(prev => ({
        ...prev,
        blockNumber: parseInt(blockHex || '0', 16),
        gasPrice: (parseInt(gasPriceHex || '0', 16) / 1e9).toFixed(1),
      }))
    } catch {
      // Network unavailable
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const tierColor = (tier: string) => {
    switch (tier) {
      case 'ELITE': return '#ffd700'
      case 'TRUSTED': return '#22d3ee'
      case 'RELIABLE': return '#34d399'
      case 'NOVICE': return '#a78bfa'
      default: return '#ef4444'
    }
  }

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
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#34d399' : '#ef4444' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {stats.blockNumber > 0 && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>
              Block #{stats.blockNumber.toLocaleString()}
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
            {stats.activeAgents} active / {stats.pausedAgents} paused
          </div>
        </div>

        <div style={s.statCard('#34d399')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Shield size={16} style={{ color: '#34d399' }} />
            <span style={s.label}>Total Staked</span>
          </div>
          <div style={{ ...s.value, color: '#34d399' }}>
            {loading ? '—' : `${(Number(stats.totalStaked) / 1e18).toFixed(0)}`}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>wSYLOS bonded</div>
        </div>

        <div style={s.statCard('#f59e0b')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Crown size={16} style={{ color: '#f59e0b' }} />
            <span style={s.label}>Avg Reputation</span>
          </div>
          <div style={{ ...s.value, color: '#f59e0b' }}>{loading ? '—' : stats.avgReputation.toFixed(0)}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>out of 10,000</div>
        </div>

        <div style={s.statCard('#ef4444')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span style={s.label}>Total Slashed</span>
          </div>
          <div style={{ ...s.value, color: '#ef4444' }}>
            {loading ? '—' : `${(Number(stats.totalSlashed) / 1e18).toFixed(0)}`}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>wSYLOS penalized</div>
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
              {stats.blockNumber > 0 ? `#${stats.blockNumber.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div style={s.label}>Gas Price</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
              {stats.gasPrice !== '0' ? `${stats.gasPrice} Gwei` : '—'}
            </div>
          </div>
          <div>
            <div style={s.label}>Contracts</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px', color: '#34d399' }}>8 deployed</div>
          </div>
        </div>
      </div>

      {/* Civilization Rules */}
      <div style={{ ...s.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <BarChart3 size={16} style={{ color: '#f59e0b' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Civilization Rules</span>
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

      {/* Reputation Tiers */}
      <div style={{ ...s.card, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <TrendingUp size={16} style={{ color: '#22d3ee' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Reputation Tiers</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { tier: 'ELITE', range: '8500-10000', desc: 'Maximum trust' },
            { tier: 'TRUSTED', range: '6000-8499', desc: 'Elevated privileges' },
            { tier: 'RELIABLE', range: '3000-5999', desc: 'Standard operations' },
            { tier: 'NOVICE', range: '1000-2999', desc: 'Basic access only' },
            { tier: 'UNTRUSTED', range: '0-999', desc: 'Restricted / auto-paused' },
          ].map(t => (
            <div key={t.tier} style={{ flex: '1 1 150px', padding: '12px', borderRadius: '12px', background: `${tierColor(t.tier)}08`, border: `1px solid ${tierColor(t.tier)}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={s.badge(tierColor(t.tier))}>{t.tier}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{t.range}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Activity Feed */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Activity size={16} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Agent Activity Feed</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>Live</span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }} />
        </div>
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
            <Globe size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No agent activity yet.</p>
            <p style={{ fontSize: '11px' }}>Spawn your first agent from the Agent Manager to begin.</p>
          </div>
        ) : (
          feed.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={s.badge(tierColor(item.tier))}>{item.tier}</span>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.agentName}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{item.action}</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{item.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
