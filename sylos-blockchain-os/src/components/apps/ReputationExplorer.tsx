/**
 * ReputationExplorer — Agent reputation leaderboard
 *
 * Reads agent data from the shared useAgentRegistry hook (on-chain when
 * deployed, localStorage when not). Shows tier distribution, search/filter,
 * and expandable agent detail cards.
 */

import { useState } from 'react'
import { TrendingUp, TrendingDown, Crown, Shield, Eye, Users, AlertTriangle, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useAgentRegistry, getReputationColor, getReputationTier, ROLE_META, type ReputationTier, type CivilizationAgent } from '../../hooks/useAgentContracts'
import { formatEther } from 'viem'

const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { fontSize: '28px', fontWeight: 700, letterSpacing: '-1px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px 10px 36px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

const TIER_ORDER: ReputationTier[] = ['ELITE', 'TRUSTED', 'RELIABLE', 'NOVICE', 'UNTRUSTED']
const TIER_INFO: Record<ReputationTier, { range: string; desc: string; icon: typeof Crown }> = {
  ELITE: { range: '8500-10000', desc: 'Maximum trust — unrestricted operations', icon: Crown },
  TRUSTED: { range: '6000-8499', desc: 'Elevated privileges and higher limits', icon: Shield },
  RELIABLE: { range: '3000-5999', desc: 'Standard operations within role scope', icon: TrendingUp },
  NOVICE: { range: '1000-2999', desc: 'Basic access, learning phase', icon: Eye },
  UNTRUSTED: { range: '0-999', desc: 'Restricted — auto-paused', icon: AlertTriangle },
}

function TierBar({ count, total, tier }: { count: number; total: number; tier: ReputationTier }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const color = getReputationColor(tier)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <span style={{ ...s.badge(color), minWidth: '80px', textAlign: 'center' }}>{tier}</span>
      <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${color}80, ${color})`, transition: 'width 0.5s ease', minWidth: count > 0 ? '4px' : '0' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, minWidth: '30px', textAlign: 'right' }}>{count}</span>
    </div>
  )
}

function RepBar({ score, width = '100%' }: { score: number; width?: string }) {
  const pct = Math.min(100, score / 100)
  const tier = getReputationTier(score)
  const color = getReputationColor(tier)
  return (
    <div style={{ width, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: `linear-gradient(90deg, ${color}80, ${color})`, transition: 'width 0.3s ease' }} />
    </div>
  )
}

function AgentRow({ agent, rank, expanded, onToggle }: { agent: CivilizationAgent; rank: number; expanded: boolean; onToggle: () => void }) {
  const meta = ROLE_META[agent.role]
  const tierColor = getReputationColor(agent.reputationTier)
  const statusColors: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', revoked: '#ef4444', expired: '#6b7280' }
  const trendIcon = agent.reputation >= 5000 ? <TrendingUp size={12} style={{ color: '#22c55e' }} /> : <TrendingDown size={12} style={{ color: '#ef4444' }} />

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', cursor: 'pointer', transition: 'background 0.15s', background: expanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: rank <= 3 ? '#f59e0b' : 'rgba(255,255,255,0.3)', minWidth: '24px', textAlign: 'center' }}>
          {rank <= 3 ? ['', '1', '2', '3'][rank] : `${rank}`}
        </span>
        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{agent.name}</span>
            <span style={s.badge(tierColor)}>{agent.reputationTier}</span>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColors[agent.status] }} />
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
            {meta.label} · {agent.totalActions} actions · {agent.status}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <RepBar score={agent.reputation} width="80px" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {trendIcon}
            <span style={{ fontSize: '16px', fontWeight: 700, color: tierColor, minWidth: '50px', textAlign: 'right' }}>{agent.reputation}</span>
          </div>
          {expanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 14px 14px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={s.label}>Reputation Score</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: tierColor, marginTop: '4px' }}>{agent.reputation} / 10,000</div>
            <RepBar score={agent.reputation} />
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={s.label}>Stake Bond</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>{formatEther(agent.stakeBond)} wSYLOS</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              Slashed: {formatEther(agent.slashedAmount)} wSYLOS
            </div>
          </div>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={s.label}>Activity</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#818cf8', marginTop: '4px' }}>{agent.totalActions}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
              {agent.source === 'chain' ? 'On-chain verified' : 'Local tracking'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReputationExplorer() {
  const { agents, myAgents, loading, contractsDeployed, refresh } = useAgentRegistry()
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState<ReputationTier | 'ALL'>('ALL')
  const [sortBy, setSortBy] = useState<'reputation' | 'actions' | 'name'>('reputation')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = agents
    .filter(a => filterTier === 'ALL' || a.reputationTier === filterTier)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'reputation') return b.reputation - a.reputation
      if (sortBy === 'actions') return b.totalActions - a.totalActions
      return a.name.localeCompare(b.name)
    })

  const tierCounts = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = agents.filter(a => a.reputationTier === tier).length
    return acc
  }, {} as Record<ReputationTier, number>)

  const avgRep = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.reputation, 0) / agents.length) : 0
  const myAvgRep = myAgents.length > 0 ? Math.round(myAgents.reduce((sum, a) => sum + a.reputation, 0) / myAgents.length) : 0

  return (
    <div style={s.page}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <TrendingUp size={28} style={{ color: '#22c55e' }} />
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 2px 0', letterSpacing: '-0.5px' }}>Reputation Explorer</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            Agent trust scores, tier distribution, and leaderboard
            {contractsDeployed ? ' (on-chain)' : ' (local)'}
          </p>
        </div>
        <button onClick={refresh} style={{ marginLeft: 'auto', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, #818cf810, #818cf805)', border: '1px solid #818cf820', borderRadius: '16px', padding: '16px' }}>
          <div style={s.label}>Total Agents</div>
          <div style={{ ...s.value, color: '#818cf8', marginTop: '4px' }}>{agents.length}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #22c55e10, #22c55e05)', border: '1px solid #22c55e20', borderRadius: '16px', padding: '16px' }}>
          <div style={s.label}>Avg Reputation</div>
          <div style={{ ...s.value, color: '#22c55e', marginTop: '4px' }}>{avgRep}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f59e0b10, #f59e0b05)', border: '1px solid #f59e0b20', borderRadius: '16px', padding: '16px' }}>
          <div style={s.label}>Elite Agents</div>
          <div style={{ ...s.value, color: '#f59e0b', marginTop: '4px' }}>{tierCounts['ELITE']}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #ef444410, #ef444405)', border: '1px solid #ef444420', borderRadius: '16px', padding: '16px' }}>
          <div style={s.label}>Your Avg Rep</div>
          <div style={{ ...s.value, color: myAgents.length > 0 ? getReputationColor(getReputationTier(myAvgRep)) : 'rgba(255,255,255,0.2)', marginTop: '4px' }}>{myAgents.length > 0 ? myAvgRep : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px' }}>
        <div>
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Crown size={14} style={{ color: '#f59e0b' }} />
              Tier Distribution
            </div>
            {TIER_ORDER.map(tier => (
              <TierBar key={tier} tier={tier} count={tierCounts[tier]} total={agents.length} />
            ))}
          </div>
          <div style={s.card}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Tier Guide</div>
            {TIER_ORDER.map(tier => {
              const info = TIER_INFO[tier]
              const Icon = info.icon
              const color = getReputationColor(tier)
              return (
                <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <Icon size={14} style={{ color, marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color }}>{tier}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{info.range} — {info.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users size={14} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Agent Leaderboard</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{filtered.length} agents</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..." style={s.input} />
            </div>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value as ReputationTier | 'ALL')} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '12px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
              <option value="ALL">All Tiers</option>
              {TIER_ORDER.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'reputation' | 'actions' | 'name')} style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '12px', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
              <option value="reputation">By Reputation</option>
              <option value="actions">By Actions</option>
              <option value="name">By Name</option>
            </select>
          </div>
          <div style={{ border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading agents...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
                {agents.length === 0 ? 'No agents spawned yet. Go to AI Agents to spawn your first.' : 'No agents match your filters.'}
              </div>
            ) : (
              filtered.map((agent, i) => (
                <AgentRow key={agent.agentId} agent={agent} rank={i + 1} expanded={expandedId === agent.agentId} onToggle={() => setExpandedId(expandedId === agent.agentId ? null : agent.agentId)} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
