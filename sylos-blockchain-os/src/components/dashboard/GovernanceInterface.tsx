import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther, formatEther } from 'viem'
import { Vote, ThumbsUp, ThumbsDown, Clock, CheckCircle, XCircle, Plus, Users, Landmark, Lock, Unlock, AlertTriangle, ExternalLink, Loader2, Shield, Bot } from 'lucide-react'
import { CONTRACTS } from '../../config/contracts'

const GOV_ADDRESS = CONTRACTS.GOVERNANCE as `0x${string}`
const WSYLOS_ADDRESS = CONTRACTS.WSYLOS_TOKEN as `0x${string}`

// SylOSGovernance ABI
const GOV_ABI = [
  { inputs: [], name: 'proposalCount', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'uint256' }], name: 'proposals', outputs: [{ name: 'id', type: 'uint256' }, { name: 'proposer', type: 'address' }, { name: 'description', type: 'string' }, { name: 'isMicroOptimization', type: 'bool' }, { name: 'forVotesHuman', type: 'uint256' }, { name: 'againstVotesHuman', type: 'uint256' }, { name: 'forVotesAgent', type: 'uint256' }, { name: 'againstVotesAgent', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' }, { name: 'executed', type: 'bool' }, { name: 'canceled', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'veLocks', outputs: [{ name: 'amount', type: 'uint256' }, { name: 'unlockTime', type: 'uint256' }, { name: 'votingPower', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'uint256' }, { name: '', type: 'address' }], name: 'hasVoted', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  // Write
  { inputs: [{ name: '_amount', type: 'uint256' }, { name: '_weeks', type: 'uint256' }], name: 'createLock', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'withdrawLock', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_description', type: 'string' }, { name: '_isMicroOptimization', type: 'bool' }], name: 'propose', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_proposalId', type: 'uint256' }, { name: '_support', type: 'bool' }], name: 'castVote', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '_proposalId', type: 'uint256' }], name: 'executeProposal', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const

// ERC20 approve ABI
const ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const

const cs = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

type Tab = 'proposals' | 'lock' | 'create'

export default function GovernanceInterface() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending } = useWriteContract()
  const [tab, setTab] = useState<Tab>('proposals')
  const [newProp, setNewProp] = useState({ description: '', isMicro: false })
  const [lockForm, setLockForm] = useState({ amount: '', weeks: '4' })

  // Read proposal count
  const { data: proposalCount } = useReadContract({ address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'proposalCount' })
  const count = proposalCount ? Number(proposalCount) : 0

  // Read user veLock
  const { data: veLock, refetch: refetchLock } = useReadContract({
    address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'veLocks',
    args: address ? [address] : undefined, query: { enabled: !!address },
  })

  // Read user wSYLOS balance
  const { data: wSylosBalance } = useReadContract({
    address: WSYLOS_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined, query: { enabled: !!address },
  })

  // Read proposals (up to 10 latest)
  const proposalIds = Array.from({ length: Math.min(count, 10) }, (_, i) => count - i)
  const { data: proposalsData, refetch: refetchProposals } = useReadContracts({
    contracts: proposalIds.map(id => ({
      address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'proposals' as const, args: [BigInt(id)] as const,
    })),
    query: { enabled: count > 0 },
  })

  const lockAmount = veLock ? Number(formatEther((veLock as any)[0] || 0n)) : 0
  const unlockTime = veLock ? Number((veLock as any)[1] || 0n) : 0
  const votingPower = veLock ? Number(formatEther((veLock as any)[2] || 0n)) : 0
  const isLocked = lockAmount > 0 && unlockTime > Date.now() / 1000
  const wSylosBal = wSylosBalance ? Number(formatEther(wSylosBalance as bigint)) : 0

  const now = Date.now() / 1000

  const handleApproveAndLock = async () => {
    if (!lockForm.amount || !lockForm.weeks) return
    const amt = parseEther(lockForm.amount)
    // First approve, then lock
    writeContract({
      address: WSYLOS_ADDRESS, abi: ERC20_ABI, functionName: 'approve',
      args: [GOV_ADDRESS, amt],
    }, {
      onSuccess: () => {
        writeContract({
          address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'createLock',
          args: [amt, BigInt(parseInt(lockForm.weeks))],
        }, { onSuccess: () => { refetchLock(); setLockForm({ amount: '', weeks: '4' }) } })
      }
    })
  }

  const handleWithdrawLock = () => {
    writeContract({ address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'withdrawLock' },
      { onSuccess: () => refetchLock() })
  }

  const handlePropose = () => {
    if (!newProp.description) return
    writeContract({
      address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'propose',
      args: [newProp.description, newProp.isMicro],
    }, { onSuccess: () => { setNewProp({ description: '', isMicro: false }); refetchProposals() } })
  }

  const handleVote = (proposalId: number, support: boolean) => {
    writeContract({
      address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'castVote',
      args: [BigInt(proposalId), support],
    }, { onSuccess: () => refetchProposals() })
  }

  const handleExecute = (proposalId: number) => {
    writeContract({
      address: GOV_ADDRESS, abi: GOV_ABI, functionName: 'executeProposal',
      args: [BigInt(proposalId)],
    }, { onSuccess: () => refetchProposals() })
  }

  if (!isConnected) {
    return (
      <div style={{ height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Vote size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>SylOS Governance</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
            Dual-layer governance with veSYLOS vote-escrow. Humans propose constitutional changes.
            AI agents vote on micro-optimizations only.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'proposals', label: 'Proposals', icon: <Vote size={14} /> },
    { id: 'lock', label: 'veSYLOS Lock', icon: <Lock size={14} /> },
    { id: 'create', label: 'Create Proposal', icon: <Plus size={14} /> },
  ]

  return (
    <div style={{ height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Governance</h1>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              <a href={`https://polygonscan.com/address/${GOV_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>{GOV_ADDRESS.slice(0, 10)}...{GOV_ADDRESS.slice(-4)}</a> · {count} proposals
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {votingPower > 0 && (
              <span style={{ padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                {votingPower.toFixed(1)} veSYLOS
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
              background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t.id ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* PROPOSALS TAB */}
        {tab === 'proposals' && (
          <>
            {/* Dual-layer explanation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ ...cs.card, padding: '12px 14px', background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Users size={14} color="#818cf8" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#818cf8' }}>Human Layer</span>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>Constitutional changes. Requires veSYLOS. Full voting power.</div>
              </div>
              <div style={{ ...cs.card, padding: '12px 14px', background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Bot size={14} color="#f59e0b" />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>Agent Layer</span>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>Micro-optimizations only. Fixed weight votes. Cannot propose.</div>
              </div>
            </div>

            {/* Proposal list */}
            {proposalIds.length === 0 ? (
              <div style={{ ...cs.card, textAlign: 'center', padding: '40px 20px' }}>
                <Vote size={32} color="rgba(255,255,255,0.1)" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>No proposals yet</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', marginTop: '4px' }}>Lock wSYLOS to gain voting power and create proposals</div>
              </div>
            ) : (
              proposalIds.map((id, i) => {
                const p = proposalsData?.[i]?.result as any
                if (!p || !p[0]) return null
                const forH = Number(formatEther(p[4] || 0n))
                const againstH = Number(formatEther(p[5] || 0n))
                const forA = Number(formatEther(p[6] || 0n))
                const againstA = Number(formatEther(p[7] || 0n))
                const start = Number(p[8] || 0n)
                const end = Number(p[9] || 0n)
                const executed = Boolean(p[10])
                const canceled = Boolean(p[11])
                const isMicro = Boolean(p[3])
                const isActive = now >= start && now <= end && !executed && !canceled
                const totalFor = forH + forA
                const totalAgainst = againstH + againstA
                const total = totalFor + totalAgainst
                const forPct = total > 0 ? (totalFor / total * 100).toFixed(0) : '0'

                return (
                  <div key={id} style={cs.card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>#{Number(p[0])}</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '100px', fontSize: '9px', fontWeight: 700,
                          background: isMicro ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                          color: isMicro ? '#f59e0b' : '#818cf8',
                        }}>{isMicro ? 'MICRO-OPT' : 'CONSTITUTIONAL'}</span>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: '100px', fontSize: '9px', fontWeight: 700,
                        background: executed ? 'rgba(34,197,94,0.1)' : canceled ? 'rgba(239,68,68,0.1)' : isActive ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                        color: executed ? '#22c55e' : canceled ? '#ef4444' : isActive ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                      }}>{executed ? 'EXECUTED' : canceled ? 'CANCELED' : isActive ? 'ACTIVE' : 'ENDED'}</span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#fff', fontWeight: 500, marginBottom: '10px', lineHeight: 1.4 }}>{p[2]}</div>

                    {/* Vote bars */}
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>
                        <span>For: {totalFor.toFixed(1)}</span>
                        <span>{forPct}%</span>
                        <span>Against: {totalAgainst.toFixed(1)}</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ height: '100%', width: `${forPct}%`, background: '#22c55e', transition: 'width 0.3s' }} />
                        <div style={{ height: '100%', flex: 1, background: total > 0 ? '#ef4444' : 'transparent' }} />
                      </div>
                    </div>

                    {/* Dual-layer tallies */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                      <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(99,102,241,0.05)', fontSize: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Human:</span>
                        <span style={{ color: '#22c55e', marginLeft: '4px' }}>+{forH.toFixed(1)}</span>
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>-{againstH.toFixed(1)}</span>
                      </div>
                      <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(245,158,11,0.05)', fontSize: '10px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>Agent:</span>
                        <span style={{ color: '#22c55e', marginLeft: '4px' }}>+{forA.toFixed(1)}</span>
                        <span style={{ color: '#ef4444', marginLeft: '4px' }}>-{againstA.toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {isActive && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleVote(Number(p[0]), true)} disabled={isPending} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <ThumbsUp size={12} /> Vote For
                        </button>
                        <button onClick={() => handleVote(Number(p[0]), false)} disabled={isPending} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <ThumbsDown size={12} /> Vote Against
                        </button>
                      </div>
                    )}
                    {!isActive && !executed && !canceled && now > end && (
                      <button onClick={() => handleExecute(Number(p[0]))} disabled={isPending} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}>
                        Execute Proposal
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {/* veSYLOS LOCK TAB */}
        {tab === 'lock' && (
          <>
            <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.1))', borderColor: 'rgba(99,102,241,0.15)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>Vote-Escrow Lock (veSYLOS)</h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Lock wSYLOS to gain voting power. Longer locks = more power (1x at 1wk, up to 4x at 52wk).
                Anti-flash-loan protection built in.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{lockAmount.toFixed(2)}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>wSYLOS Locked</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>{votingPower.toFixed(2)}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>Voting Power</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: isLocked ? '#f59e0b' : '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>
                    {isLocked ? `${Math.ceil((unlockTime - now) / 86400)}d` : 'Free'}
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>{isLocked ? 'Until Unlock' : 'Status'}</div>
                </div>
              </div>

              {!isLocked ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input value={lockForm.amount} onChange={e => setLockForm(p => ({ ...p, amount: e.target.value }))} placeholder={`Amount (${wSylosBal.toFixed(2)} available)`} type="number" style={cs.input} />
                    <select value={lockForm.weeks} onChange={e => setLockForm(p => ({ ...p, weeks: e.target.value }))} style={{ ...cs.input, appearance: 'none' as any, cursor: 'pointer' }}>
                      <option value="1">1 week (1x)</option>
                      <option value="4">4 weeks (1.2x)</option>
                      <option value="12">12 weeks (1.7x)</option>
                      <option value="26">26 weeks (2.5x)</option>
                      <option value="52">52 weeks (4x)</option>
                    </select>
                  </div>
                  <button onClick={handleApproveAndLock} disabled={isPending || !lockForm.amount} style={{
                    width: '100%', padding: '12px', borderRadius: '10px', border: 'none', cursor: !lockForm.amount ? 'not-allowed' : 'pointer',
                    background: lockForm.amount ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                    color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: !lockForm.amount ? 0.4 : 1,
                  }}>
                    {isPending ? 'Processing...' : '🔒 Approve & Lock wSYLOS'}
                  </button>
                </div>
              ) : (
                <button onClick={handleWithdrawLock} disabled={isPending || isLocked} style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  background: isLocked ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: isLocked ? 0.4 : 1,
                }}>
                  {isLocked ? `Locked for ${Math.ceil((unlockTime - now) / 86400)} more days` : '🔓 Withdraw Lock'}
                </button>
              )}
            </div>

            {/* Multiplier info */}
            <div style={cs.card}>
              <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>Lock Duration → Voting Multiplier</h4>
              {[
                { weeks: 1, mult: '1.06x', color: 'rgba(255,255,255,0.2)' },
                { weeks: 4, mult: '1.23x', color: 'rgba(255,255,255,0.3)' },
                { weeks: 12, mult: '1.69x', color: '#818cf8' },
                { weeks: 26, mult: '2.50x', color: '#6366f1' },
                { weeks: 52, mult: '4.00x', color: '#4f46e5' },
              ].map(m => (
                <div key={m.weeks} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{m.weeks} week{m.weeks > 1 ? 's' : ''}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.mult}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CREATE PROPOSAL TAB */}
        {tab === 'create' && (
          <div style={cs.card}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>Create Proposal</h3>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Requires ≥1,000 veSYLOS voting power. Voting period: 3 days. AI agents can <strong>only</strong> vote on micro-optimization proposals.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea value={newProp.description} onChange={e => setNewProp(p => ({ ...p, description: e.target.value }))} placeholder="Proposal description..." rows={4} style={{ ...cs.input, resize: 'vertical', lineHeight: 1.5 }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <input type="checkbox" checked={newProp.isMicro} onChange={e => setNewProp(p => ({ ...p, isMicro: e.target.checked }))} style={{ accentColor: '#818cf8' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Micro-Optimization</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>If checked, AI agents can vote on this proposal. Otherwise, human-only voting.</div>
                </div>
              </label>

              <button onClick={handlePropose} disabled={isPending || !newProp.description || votingPower < 1000} style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                cursor: !newProp.description || votingPower < 1000 ? 'not-allowed' : 'pointer',
                background: newProp.description && votingPower >= 1000 ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                opacity: !newProp.description || votingPower < 1000 ? 0.4 : 1,
              }}>
                {isPending ? 'Submitting...' : votingPower < 1000 ? `Need ≥1,000 veSYLOS (you have ${votingPower.toFixed(0)})` : 'Submit Proposal On-Chain'}
              </button>
            </div>

            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', fontSize: '10px', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <Shield size={12} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Anti-flash-loan: Proposals require locked tokens, not spot holdings. Attackers can't borrow to vote.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}