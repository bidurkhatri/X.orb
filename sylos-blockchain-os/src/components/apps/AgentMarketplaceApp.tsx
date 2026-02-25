/**
 * AgentMarketplaceApp — Hire, List, and Trade Agent Services
 *
 * The job market for AI agents. Sponsors can:
 * - List their agents as available for hire
 * - Browse and hire other agents
 * - View engagement history and ratings
 * - Complete/dispute engagements
 *
 * Reads from the AgentMarketplace contract when deployed,
 * falls back to localStorage otherwise.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ShoppingBag, Star, Clock, Zap, Search, Filter, ChevronDown,
  CheckCircle, XCircle, AlertTriangle, DollarSign, Users, TrendingUp
} from 'lucide-react'
import { useAccount } from 'wagmi'
import { useAgentRegistry, getReputationColor, ROLE_META } from '../../hooks/useAgentContracts'
import { citizenIdentity } from '../../services/agent/CitizenIdentity'

/* ─── Styles ─── */
const s = {
  page: { height: '100%', padding: '24px', background: 'linear-gradient(180deg, #080c1a 0%, #0f1328 100%)', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px', marginBottom: '12px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: `${color}20`, color, letterSpacing: '0.5px' }) as React.CSSProperties,
  btn: (color: string) => ({
    padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
    background: `${color}20`, color, transition: 'all 0.2s',
  }) as React.CSSProperties,
  input: { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } as React.CSSProperties,
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s', fontFamily: 'inherit',
  }) as React.CSSProperties,
}

const MARKETPLACE_KEY = 'sylos_marketplace_listings'
const ENGAGEMENTS_KEY = 'sylos_marketplace_engagements'

interface Listing {
  agentId: string
  agentName: string
  role: string
  owner: string
  pricePerHour: number    // in wSYLOS tokens
  pricingModel: 'hourly' | 'daily' | 'per_task'
  description: string
  active: boolean
  maxConcurrent: number
  currentEngagements: number
  totalCompleted: number
  avgRating: number
  ratingCount: number
  capabilities: string[]
  reputation: number
  reputationTier: string
  listedAt: number
}

interface Engagement {
  id: string
  agentId: string
  agentName: string
  hirer: string
  amount: number
  startedAt: number
  endedAt: number
  status: 'ACTIVE' | 'COMPLETED' | 'DISPUTED' | 'CANCELED'
  rating: number
  feedback: string
  tasksCompleted: number
}

/* ─── Listing Card ─── */
function ListingCard({ listing, onHire, isOwn }: {
  listing: Listing
  onHire: (l: Listing) => void
  isOwn: boolean
}) {
  const meta = ROLE_META[listing.role as keyof typeof ROLE_META]
  const tierColor = getReputationColor(listing.reputationTier as any)

  return (
    <div style={{
      ...s.card, cursor: isOwn ? 'default' : 'pointer',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => { if (!isOwn) (e.currentTarget.style.borderColor = 'rgba(96,165,250,0.3)') }}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
    >
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: `linear-gradient(135deg, ${meta?.color || '#6b7280'}40, ${meta?.color || '#6b7280'}10)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0,
        }}>
          {meta?.icon || '?'}
        </div>

        <div style={{ flex: 1 }}>
          {/* Name and badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '15px' }}>{listing.agentName}</span>
            <span style={s.badge(meta?.color || '#6b7280')}>{meta?.label || listing.role}</span>
            <span style={s.badge(tierColor)}>{listing.reputationTier}</span>
            {listing.active && <span style={s.badge('#22c55e')}>AVAILABLE</span>}
            {isOwn && <span style={s.badge('#3b82f6')}>YOUR AGENT</span>}
          </div>

          {/* Description */}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
            {listing.description}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <DollarSign size={12} color="#f59e0b" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                {listing.pricePerHour} wSYLOS/{listing.pricingModel === 'hourly' ? 'hr' : listing.pricingModel === 'daily' ? 'day' : 'task'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Star size={12} color="#f59e0b" />
              <span style={{ fontSize: '12px' }}>
                {listing.avgRating > 0 ? `${listing.avgRating.toFixed(1)}/5` : 'No ratings'}
                {listing.ratingCount > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}> ({listing.ratingCount})</span>}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={12} color="#22c55e" />
              <span style={{ fontSize: '12px' }}>{listing.totalCompleted} completed</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} color="#3b82f6" />
              <span style={{ fontSize: '12px' }}>Rep: {listing.reputation}/10000</span>
            </div>
          </div>

          {/* Capabilities */}
          {listing.capabilities.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              {listing.capabilities.slice(0, 5).map((cap, i) => (
                <span key={i} style={{ ...s.badge('#3b82f6'), fontSize: '9px' }}>{cap}</span>
              ))}
            </div>
          )}
        </div>

        {/* Hire button */}
        {!isOwn && listing.active && (
          <button onClick={(e) => { e.stopPropagation(); onHire(listing) }} style={s.btn('#22c55e')}>
            <Zap size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Hire
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── List Agent Modal ─── */
function ListAgentForm({ agents, onList, onClose }: {
  agents: { agentId: string; name: string; role: string; reputation: number; reputationTier: string }[]
  onList: (listing: Partial<Listing>) => void
  onClose: () => void
}) {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.agentId || '')
  const [price, setPrice] = useState('10')
  const [model, setModel] = useState<'hourly' | 'daily' | 'per_task'>('per_task')
  const [desc, setDesc] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: '440px', borderRadius: '18px', background: 'rgba(15,19,40,0.98)', border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>List Agent on Marketplace</h3>

        <div style={{ marginBottom: '12px' }}>
          <div style={s.label}>Select Agent</div>
          <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ ...s.input, marginTop: '4px' }}>
            {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name} ({a.role})</option>)}
          </select>
        </div>

        <div style={{ ...s.grid2, marginBottom: '12px' }}>
          <div>
            <div style={s.label}>Price (wSYLOS)</div>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} style={{ ...s.input, marginTop: '4px' }} />
          </div>
          <div>
            <div style={s.label}>Pricing Model</div>
            <select value={model} onChange={e => setModel(e.target.value as any)} style={{ ...s.input, marginTop: '4px' }}>
              <option value="hourly">Per Hour</option>
              <option value="daily">Per Day</option>
              <option value="per_task">Per Task</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={s.label}>Description</div>
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="What can this agent do for hirers?"
            rows={3}
            style={{ ...s.input, marginTop: '4px', resize: 'vertical' as const }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={s.btn('#6b7280')}>Cancel</button>
          <button onClick={() => {
            const agent = agents.find(a => a.agentId === selectedAgent)
            if (!agent) return
            onList({
              agentId: agent.agentId, agentName: agent.name, role: agent.role,
              pricePerHour: parseFloat(price) || 10, pricingModel: model,
              description: desc || `${agent.role} agent available for hire`,
              reputation: agent.reputation, reputationTier: agent.reputationTier,
            })
            onClose()
          }} style={s.btn('#22c55e')}>
            <ShoppingBag size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            List Agent
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

export default function AgentMarketplaceApp() {
  const { address } = useAccount()
  const { agents: allAgents, myAgents } = useAgentRegistry()
  const [listings, setListings] = useState<Listing[]>([])
  const [engagements, setEngagements] = useState<Engagement[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [showListForm, setShowListForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'browse' | 'my_listings' | 'engagements'>('browse')

  // Load from localStorage
  useEffect(() => {
    try { setListings(JSON.parse(localStorage.getItem(MARKETPLACE_KEY) || '[]')) } catch { /* */ }
    try { setEngagements(JSON.parse(localStorage.getItem(ENGAGEMENTS_KEY) || '[]')) } catch { /* */ }
  }, [])

  const saveListings = useCallback((updated: Listing[]) => {
    localStorage.setItem(MARKETPLACE_KEY, JSON.stringify(updated))
    setListings(updated)
  }, [])

  const saveEngagements = useCallback((updated: Engagement[]) => {
    localStorage.setItem(ENGAGEMENTS_KEY, JSON.stringify(updated))
    setEngagements(updated)
  }, [])

  // List a new agent
  const handleList = useCallback((partial: Partial<Listing>) => {
    const profile = citizenIdentity.getProfile(partial.agentId!)
    const newListing: Listing = {
      agentId: partial.agentId!,
      agentName: partial.agentName!,
      role: partial.role!,
      owner: address || '0x0',
      pricePerHour: partial.pricePerHour || 10,
      pricingModel: partial.pricingModel || 'per_task',
      description: partial.description || '',
      active: true,
      maxConcurrent: 3,
      currentEngagements: 0,
      totalCompleted: 0,
      avgRating: 0,
      ratingCount: 0,
      capabilities: profile?.background.capabilities || [],
      reputation: partial.reputation || 0,
      reputationTier: partial.reputationTier || 'NOVICE',
      listedAt: Date.now(),
    }
    saveListings([newListing, ...listings])
  }, [address, listings, saveListings])

  // Hire an agent
  const handleHire = useCallback((listing: Listing) => {
    const engagement: Engagement = {
      id: `eng_${Date.now()}`,
      agentId: listing.agentId,
      agentName: listing.agentName,
      hirer: address || '0x0',
      amount: listing.pricePerHour,
      startedAt: Date.now(),
      endedAt: 0,
      status: 'ACTIVE',
      rating: 0,
      feedback: '',
      tasksCompleted: 0,
    }
    saveEngagements([engagement, ...engagements])

    // Update listing engagement count
    const updated = listings.map(l =>
      l.agentId === listing.agentId ? { ...l, currentEngagements: l.currentEngagements + 1 } : l
    )
    saveListings(updated)

    citizenIdentity.recordAction(listing.agentId, {
      type: 'ENGAGEMENT_START',
      description: `Hired by ${address?.slice(0, 8)}... via marketplace`,
      timestamp: Date.now(),
      metadata: { engagementId: engagement.id, amount: listing.pricePerHour },
      reputationDelta: 0,
      financialImpact: listing.pricePerHour.toString(),
    })
  }, [address, engagements, listings, saveEngagements, saveListings])

  // Complete an engagement
  const handleComplete = useCallback((eng: Engagement, rating: number) => {
    const updated = engagements.map(e =>
      e.id === eng.id ? { ...e, status: 'COMPLETED' as const, endedAt: Date.now(), rating } : e
    )
    saveEngagements(updated)

    // Update listing stats
    const listUpdated = listings.map(l => {
      if (l.agentId === eng.agentId) {
        const newTotal = l.totalCompleted + 1
        const newAvg = ((l.avgRating * l.ratingCount) + rating) / (l.ratingCount + 1)
        return {
          ...l, totalCompleted: newTotal, avgRating: newAvg,
          ratingCount: l.ratingCount + 1, currentEngagements: Math.max(0, l.currentEngagements - 1),
        }
      }
      return l
    })
    saveListings(listUpdated)

    citizenIdentity.recordAction(eng.agentId, {
      type: 'ENGAGEMENT_END',
      description: `Engagement completed — rated ${rating}/5 stars`,
      timestamp: Date.now(),
      metadata: { engagementId: eng.id, rating },
      reputationDelta: rating >= 4 ? 10 : rating >= 3 ? 5 : -5,
      financialImpact: eng.amount.toString(),
    })
  }, [engagements, listings, saveEngagements, saveListings])

  // Filter listings
  const filteredListings = useMemo(() => {
    let result = listings.filter(l => l.active)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.agentName.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || l.role.toLowerCase().includes(q)
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter(l => l.role === roleFilter)
    }
    return result
  }, [listings, search, roleFilter])

  const myListings = listings.filter(l => l.owner.toLowerCase() === (address || '').toLowerCase())
  const myEngagements = engagements.filter(e => e.hirer.toLowerCase() === (address || '').toLowerCase())
  const roles = ['all', ...Object.keys(ROLE_META)]

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <ShoppingBag size={20} color="#a855f7" />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Agent Marketplace</h2>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
          {listings.filter(l => l.active).length} agents available
        </span>
        {myAgents.length > 0 && (
          <button onClick={() => setShowListForm(true)} style={{ ...s.btn('#a855f7'), marginLeft: 'auto' }}>
            <ShoppingBag size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            List My Agent
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Listed', value: listings.filter(l => l.active).length, color: '#a855f7' },
          { label: 'Active Jobs', value: engagements.filter(e => e.status === 'ACTIVE').length, color: '#22c55e' },
          { label: 'Completed', value: engagements.filter(e => e.status === 'COMPLETED').length, color: '#3b82f6' },
          { label: 'Avg Rating', value: listings.length > 0 ? (listings.reduce((s, l) => s + l.avgRating, 0) / Math.max(1, listings.filter(l => l.avgRating > 0).length)).toFixed(1) : '—', color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.card, padding: '12px', marginBottom: 0 }}>
            <div style={s.label}>{stat.label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color, marginTop: '4px' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('browse')} style={s.tab(activeTab === 'browse')}>
          Browse ({filteredListings.length})
        </button>
        <button onClick={() => setActiveTab('my_listings')} style={s.tab(activeTab === 'my_listings')}>
          My Listings ({myListings.length})
        </button>
        <button onClick={() => setActiveTab('engagements')} style={s.tab(activeTab === 'engagements')}>
          My Engagements ({myEngagements.length})
        </button>
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search & Filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                style={{ ...s.input, paddingLeft: '36px' }}
                placeholder="Search agents by name, role, or skill..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ ...s.input, width: '160px' }}>
              {roles.map(r => <option key={r} value={r}>{r === 'all' ? 'All Roles' : ROLE_META[r as keyof typeof ROLE_META]?.label || r}</option>)}
            </select>
          </div>

          {filteredListings.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <ShoppingBag size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                {listings.length === 0 ? 'No agents listed yet — be the first to list one' : 'No agents match your search'}
              </div>
            </div>
          )}

          {filteredListings.map(l => (
            <ListingCard
              key={l.agentId}
              listing={l}
              onHire={handleHire}
              isOwn={l.owner.toLowerCase() === (address || '').toLowerCase()}
            />
          ))}
        </>
      )}

      {activeTab === 'my_listings' && (
        <>
          {myListings.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Users size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                You haven't listed any agents yet
              </div>
            </div>
          )}
          {myListings.map(l => (
            <ListingCard key={l.agentId} listing={l} onHire={() => {}} isOwn />
          ))}
        </>
      )}

      {activeTab === 'engagements' && (
        <>
          {myEngagements.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Clock size={40} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '12px', fontSize: '13px' }}>
                No engagements yet — hire an agent to get started
              </div>
            </div>
          )}
          {myEngagements.map(eng => (
            <div key={eng.id} style={{ ...s.card, borderColor: eng.status === 'ACTIVE' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={16} color={eng.status === 'ACTIVE' ? '#22c55e' : '#3b82f6'} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700 }}>{eng.agentName}</span>
                    <span style={s.badge(eng.status === 'ACTIVE' ? '#22c55e' : eng.status === 'COMPLETED' ? '#3b82f6' : '#ef4444')}>
                      {eng.status}
                    </span>
                    <span style={{ fontSize: '12px', color: '#f59e0b' }}>{eng.amount} wSYLOS</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                    Started {new Date(eng.startedAt).toLocaleDateString()}
                    {eng.endedAt > 0 && ` — Ended ${new Date(eng.endedAt).toLocaleDateString()}`}
                  </div>
                </div>
                {eng.status === 'ACTIVE' && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4, 5].map(stars => (
                      <button key={stars} onClick={() => handleComplete(eng, stars)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      }}>
                        <Star size={16} color="#f59e0b" fill={stars <= 3 ? 'transparent' : '#f59e0b'} />
                      </button>
                    ))}
                  </div>
                )}
                {eng.rating > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {Array.from({ length: eng.rating }).map((_, i) => (
                      <Star key={i} size={12} color="#f59e0b" fill="#f59e0b" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* List Agent Form Modal */}
      {showListForm && myAgents.length > 0 && (
        <ListAgentForm
          agents={myAgents.map(a => ({
            agentId: a.agentId, name: a.name, role: a.role,
            reputation: a.reputation, reputationTier: a.reputationTier,
          }))}
          onList={handleList}
          onClose={() => setShowListForm(false)}
        />
      )}
    </div>
  )
}
