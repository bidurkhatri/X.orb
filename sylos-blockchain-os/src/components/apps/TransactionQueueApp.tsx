/**
 * TransactionQueueApp — Sponsor Approval Queue for Agent Transactions
 *
 * When agents use submit_transaction_proposal, the tx goes here.
 * The sponsor reviews, approves, or rejects each pending transaction.
 * Approved txs get signed by the sponsor's wallet via wagmi.
 *
 * Also shows proposal drafts from governance agents.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Send, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, Shield, Zap, FileText, ExternalLink
} from 'lucide-react'
import { useAccount, useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'
import { useAgentRegistry, ROLE_META } from '../../hooks/useAgentContracts'
import { citizenIdentity } from '../../services/agent/CitizenIdentity'
import { eventBus } from '../../services/EventBus'

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
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
    background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.2s', fontFamily: 'inherit',
  }) as React.CSSProperties,
}

interface TxProposal {
  id: string
  agentId: string
  agentName: string
  tx: {
    from: string
    to: string
    value: string
    gas: string
    gasPrice: string
    nonce: string
  }
  reason: string
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED'
  createdAt: number
  valuePol: number
  reviewedAt?: number
  txHash?: string
}

interface ProposalDraft {
  id: string
  agentId: string
  agentName: string
  title: string
  description: string
  actionType: string
  status: string
  createdAt: number
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

/* ─── Transaction Card ─── */
function TxCard({ proposal, onApprove, onReject, sending }: {
  proposal: TxProposal
  onApprove: (p: TxProposal) => void
  onReject: (p: TxProposal) => void
  sending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const profile = citizenIdentity.getProfileSummary(proposal.agentId)
  const isPending = proposal.status === 'PENDING_APPROVAL'

  const statusColor = {
    PENDING_APPROVAL: '#f59e0b',
    APPROVED: '#22c55e',
    REJECTED: '#ef4444',
    EXECUTED: '#3b82f6',
    FAILED: '#ef4444',
  }[proposal.status]

  return (
    <div style={{
      ...s.card,
      borderColor: isPending ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)',
      background: isPending ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.03)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Send size={16} color={statusColor} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{proposal.valuePol} POL</span>
            <span style={s.badge(statusColor)}>{proposal.status.replace(/_/g, ' ')}</span>
            {profile && (
              <span style={s.badge(ROLE_META[profile.role]?.color || '#6b7280')}>
                {proposal.agentName}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            {proposal.reason}
          </div>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(proposal.createdAt)}</span>
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          <div style={s.grid2}>
            <div><div style={s.label}>From</div><div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}>{proposal.tx.from}</div></div>
            <div><div style={s.label}>To</div><div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#e2e8f0' }}>{proposal.tx.to}</div></div>
            <div><div style={s.label}>Value</div><div style={{ fontSize: '13px', fontWeight: 600 }}>{proposal.valuePol} POL</div></div>
            <div><div style={s.label}>Gas Limit</div><div style={{ fontSize: '13px' }}>{parseInt(proposal.tx.gas, 16)}</div></div>
          </div>
          {profile && (
            <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <div style={s.label}>Agent Identity</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                {profile.designation} — Rep: {profile.reputation}/10000 — KYC: {profile.kycLevel} — Criminal: {profile.criminalStatus}
              </div>
            </div>
          )}
          {proposal.txHash && (
            <div style={{ marginTop: '8px' }}>
              <div style={s.label}>Transaction Hash</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#3b82f6' }}>{proposal.txHash}</div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {isPending && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => onApprove(proposal)}
            disabled={sending}
            style={{ ...s.btn('#22c55e'), opacity: sending ? 0.5 : 1 }}
          >
            <CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {sending ? 'Signing...' : 'Approve & Sign'}
          </button>
          <button
            onClick={() => onReject(proposal)}
            disabled={sending}
            style={s.btn('#ef4444')}
          >
            <XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Governance Draft Card ─── */
function DraftCard({ draft, onApprove, onReject }: {
  draft: ProposalDraft
  onApprove: (d: ProposalDraft) => void
  onReject: (d: ProposalDraft) => void
}) {
  const isPending = draft.status === 'DRAFT_PENDING_REVIEW'
  const statusColor = isPending ? '#f59e0b' : draft.status === 'APPROVED' ? '#22c55e' : '#ef4444'

  return (
    <div style={{ ...s.card, borderColor: isPending ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <FileText size={16} color="#a855f7" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{draft.title}</span>
            <span style={s.badge(statusColor)}>{draft.status.replace(/_/g, ' ')}</span>
            <span style={s.badge('#a855f7')}>{draft.actionType.replace(/_/g, ' ')}</span>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
            {draft.description.slice(0, 120)}{draft.description.length > 120 ? '...' : ''}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
            By {draft.agentName} — {timeAgo(draft.createdAt)}
          </div>
        </div>
      </div>
      {isPending && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => onApprove(draft)} style={s.btn('#22c55e')}>
            <CheckCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Approve Draft
          </button>
          <button onClick={() => onReject(draft)} style={s.btn('#ef4444')}>
            <XCircle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ══════════
   ═══════════════════════════════ */

type Tab = 'transactions' | 'drafts'

export default function TransactionQueueApp() {
  const { address } = useAccount()
  const { sendTransaction, isPending: txSending } = useSendTransaction()
  const [proposals, setProposals] = useState<TxProposal[]>([])
  const [drafts, setDrafts] = useState<ProposalDraft[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('transactions')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  // Load from localStorage
  const refresh = useCallback(() => {
    try {
      const raw = localStorage.getItem('sylos_tx_proposals')
      setProposals(raw ? JSON.parse(raw) : [])
    } catch { setProposals([]) }
    try {
      const raw = localStorage.getItem('sylos_proposal_drafts')
      setDrafts(raw ? JSON.parse(raw) : [])
    } catch { setDrafts([]) }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [refresh])

  const saveProposals = useCallback((updated: TxProposal[]) => {
    localStorage.setItem('sylos_tx_proposals', JSON.stringify(updated))
    setProposals(updated)
  }, [])

  const saveDrafts = useCallback((updated: ProposalDraft[]) => {
    localStorage.setItem('sylos_proposal_drafts', JSON.stringify(updated))
    setDrafts(updated)
  }, [])

  // Approve tx — actually sends via wagmi
  const handleApprove = useCallback((proposal: TxProposal) => {
    const updated = proposals.map(p => {
      if (p.id === proposal.id) {
        return { ...p, status: 'APPROVED' as const, reviewedAt: Date.now() }
      }
      return p
    })
    saveProposals(updated)

    // Actually send the transaction
    try {
      sendTransaction({
        to: proposal.tx.to as `0x${string}`,
        value: BigInt(proposal.tx.value),
      }, {
        onSuccess: (hash) => {
          const executed = updated.map(p =>
            p.id === proposal.id ? { ...p, status: 'EXECUTED' as const, txHash: hash } : p
          )
          saveProposals(executed)

          // Record in citizen identity
          citizenIdentity.recordAction(proposal.agentId, {
            type: 'FINANCIAL_TX',
            description: `Transaction approved and executed: ${proposal.valuePol} POL to ${proposal.tx.to}`,
            timestamp: Date.now(),
            metadata: { txHash: hash, valuePol: proposal.valuePol },
            reputationDelta: 2,
            financialImpact: proposal.tx.value,
          })
        },
        onError: () => {
          const failed = updated.map(p =>
            p.id === proposal.id ? { ...p, status: 'FAILED' as const } : p
          )
          saveProposals(failed)
        },
      })
    } catch {
      // sendTransaction might throw synchronously if wallet not connected
    }
  }, [proposals, saveProposals, sendTransaction])

  const handleReject = useCallback((proposal: TxProposal) => {
    const updated = proposals.map(p =>
      p.id === proposal.id ? { ...p, status: 'REJECTED' as const, reviewedAt: Date.now() } : p
    )
    saveProposals(updated)

    citizenIdentity.recordAction(proposal.agentId, {
      type: 'PERMISSION_DENIED',
      description: `Transaction rejected by sponsor: ${proposal.valuePol} POL to ${proposal.tx.to}`,
      timestamp: Date.now(),
      metadata: { reason: 'SPONSOR_REJECTED' },
      reputationDelta: 0,
      financialImpact: '0',
    })

    eventBus.emit('tx:rejected', proposal.agentId, proposal.agentName, {
      proposalId: proposal.id, valuePol: proposal.valuePol,
    })
  }, [proposals, saveProposals])

  const handleApproveDraft = useCallback((draft: ProposalDraft) => {
    const updated = drafts.map(d =>
      d.id === draft.id ? { ...d, status: 'APPROVED_BY_SPONSOR' } : d
    )
    saveDrafts(updated)
  }, [drafts, saveDrafts])

  const handleRejectDraft = useCallback((draft: ProposalDraft) => {
    const updated = drafts.map(d =>
      d.id === draft.id ? { ...d, status: 'REJECTED_BY_SPONSOR' } : d
    )
    saveDrafts(updated)
  }, [drafts, saveDrafts])

  // Filter proposals
  const filteredProposals = useMemo(() => {
    if (filter === 'all') return proposals
    const statusMap: Record<string, string> = {
      pending: 'PENDING_APPROVAL', approved: 'APPROVED', rejected: 'REJECTED',
    }
    return proposals.filter(p => p.status === statusMap[filter] || (filter === 'approved' && (p.status === 'APPROVED' || p.status === 'EXECUTED')))
  }, [proposals, filter])

  const pendingCount = proposals.filter(p => p.status === 'PENDING_APPROVAL').length
  const pendingDrafts = drafts.filter(d => d.status === 'DRAFT_PENDING_REVIEW').length

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Shield size={20} color="#f59e0b" />
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Approval Queue</h2>
        {pendingCount > 0 && (
          <span style={{ ...s.badge('#f59e0b'), fontSize: '11px', padding: '3px 10px' }}>
            {pendingCount} PENDING
          </span>
        )}
        <button onClick={refresh} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '4px' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {!address && (
        <div style={{ ...s.card, textAlign: 'center', padding: '30px', borderColor: 'rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={32} color="#f59e0b" />
          <div style={{ marginTop: '8px', fontWeight: 600 }}>Wallet Not Connected</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            Connect your wallet to approve agent transactions
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        <button onClick={() => setActiveTab('transactions')} style={s.tab(activeTab === 'transactions')}>
          Transactions {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button onClick={() => setActiveTab('drafts')} style={s.tab(activeTab === 'drafts')}>
          Governance Drafts {pendingDrafts > 0 && `(${pendingDrafts})`}
        </button>
      </div>

      {activeTab === 'transactions' && (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                ...s.tab(filter === f), fontSize: '11px', padding: '4px 12px',
              }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            {[
              { label: 'Pending', value: proposals.filter(p => p.status === 'PENDING_APPROVAL').length, color: '#f59e0b' },
              { label: 'Approved', value: proposals.filter(p => p.status === 'APPROVED' || p.status === 'EXECUTED').length, color: '#22c55e' },
              { label: 'Rejected', value: proposals.filter(p => p.status === 'REJECTED').length, color: '#ef4444' },
              { label: 'Total Value', value: `${proposals.filter(p => p.status !== 'REJECTED').reduce((s, p) => s + p.valuePol, 0).toFixed(2)} POL`, color: '#3b82f6' },
            ].map(stat => (
              <div key={stat.label} style={{ ...s.card, padding: '12px', marginBottom: 0 }}>
                <div style={s.label}>{stat.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color, marginTop: '4px' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Transaction list */}
          {filteredProposals.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <Clock size={32} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '8px', fontSize: '13px' }}>
                {proposals.length === 0 ? 'No transaction proposals yet' : 'No matching proposals'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', marginTop: '4px', fontSize: '11px' }}>
                Agent transactions will appear here for your approval
              </div>
            </div>
          )}

          {filteredProposals.map(p => (
            <TxCard
              key={p.id}
              proposal={p}
              onApprove={handleApprove}
              onReject={handleReject}
              sending={txSending}
            />
          ))}
        </>
      )}

      {activeTab === 'drafts' && (
        <>
          {drafts.length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', padding: '40px' }}>
              <FileText size={32} color="rgba(255,255,255,0.1)" />
              <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '8px', fontSize: '13px' }}>
                No governance drafts yet
              </div>
              <div style={{ color: 'rgba(255,255,255,0.2)', marginTop: '4px', fontSize: '11px' }}>
                Governance agents will propose drafts for your review
              </div>
            </div>
          )}

          {drafts.map(d => (
            <DraftCard
              key={d.id}
              draft={d}
              onApprove={handleApproveDraft}
              onReject={handleRejectDraft}
            />
          ))}
        </>
      )}
    </div>
  )
}
