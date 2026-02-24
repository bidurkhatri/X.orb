import { useState } from 'react'
import { useAccount, useReadContract, useReadContracts, useWriteContract } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther, formatEther } from 'viem'
import { Coins, TrendingUp, Lock, Unlock, Award, Timer, Zap, ExternalLink, Loader2, ArrowLeftRight } from 'lucide-react'
import { CONTRACTS } from '../../config/contracts'

const WSYLOS_ADDRESS = CONTRACTS.WSYLOS_TOKEN as `0x${string}`
const SYLOS_ADDRESS = CONTRACTS.SYLOS_TOKEN as `0x${string}`

// WrappedSYLOS Full ABI
const WSYLOS_ABI = [
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'wrap', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }], name: 'unwrap', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'amount', type: 'uint256' }, { name: 'lockDurationIndex', type: 'uint256' }], name: 'timeLock', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'lockDurationIndex', type: 'uint256' }], name: 'claimTimeLocked', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'claimRewards', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'pendingReward', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getStakingMultiplier', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalRewardsAccrued', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getTimeLockAmounts', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
] as const

const SYLOS_ABI = [
  { inputs: [{ name: '', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
] as const

const cs = {
  page: { height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

type Tab = 'wrap' | 'timelock' | 'rewards'

export default function StakingInterface() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending } = useWriteContract()
  const [tab, setTab] = useState<Tab>('wrap')
  const [wrapAmount, setWrapAmount] = useState('')
  const [unwrapAmount, setUnwrapAmount] = useState('')
  const [lockAmount, setLockAmount] = useState('')
  const [lockTier, setLockTier] = useState('0')

  // Read balances
  const { data: sylosBal, refetch: refetchSylos } = useReadContract({ address: SYLOS_ADDRESS, abi: SYLOS_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } })
  const { data: wSylosBal, refetch: refetchWSylos } = useReadContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } })
  const { data: pendingReward, refetch: refetchReward } = useReadContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'pendingReward', args: address ? [address] : undefined, query: { enabled: !!address } })
  const { data: multiplier } = useReadContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'getStakingMultiplier', args: address ? [address] : undefined, query: { enabled: !!address } })
  const { data: timeLockAmounts } = useReadContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'getTimeLockAmounts', args: address ? [address] : undefined, query: { enabled: !!address } })

  // Global stats
  const { data: globalStats } = useReadContracts({
    contracts: [
      { address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'totalSupply' },
      { address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'totalRewardsAccrued' },
    ]
  })

  const sylos = sylosBal ? Number(formatEther(sylosBal as bigint)) : 0
  const wsylos = wSylosBal ? Number(formatEther(wSylosBal as bigint)) : 0
  const pending = pendingReward ? Number(formatEther(pendingReward as bigint)) : 0
  const mult = multiplier ? Number(multiplier) / 10000 : 1
  const totalSupply = globalStats?.[0]?.result ? Number(formatEther(globalStats[0].result as bigint)) : 0
  const totalRewards = globalStats?.[1]?.result ? Number(formatEther(globalStats[1].result as bigint)) : 0
  const lockAmts = (timeLockAmounts as bigint[]) || []

  const refetchAll = () => { refetchSylos(); refetchWSylos(); refetchReward() }

  const tiers = [
    { name: '30 Days', bonus: '2%', days: 30, color: '#22c55e' },
    { name: '90 Days', bonus: '5%', days: 90, color: '#818cf8' },
    { name: '180 Days', bonus: '10%', days: 180, color: '#f59e0b' },
    { name: '365 Days', bonus: '20%', days: 365, color: '#ef4444' },
  ]

  const handleWrap = () => {
    if (!wrapAmount) return
    const amt = parseEther(wrapAmount)
    writeContract({
      address: SYLOS_ADDRESS, abi: SYLOS_ABI, functionName: 'approve',
      args: [WSYLOS_ADDRESS, amt]
    }, {
      onSuccess: () => {
        writeContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'wrap', args: [amt] },
          { onSuccess: () => { setWrapAmount(''); refetchAll() } })
      }
    })
  }

  const handleUnwrap = () => {
    if (!unwrapAmount) return
    writeContract({
      address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'unwrap',
      args: [parseEther(unwrapAmount)],
    }, { onSuccess: () => { setUnwrapAmount(''); refetchAll() } })
  }

  const handleTimeLock = () => {
    if (!lockAmount) return
    writeContract({
      address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'timeLock',
      args: [parseEther(lockAmount), BigInt(parseInt(lockTier))],
    }, { onSuccess: () => { setLockAmount(''); refetchAll() } })
  }

  const handleClaimTimeLock = (tierIdx: number) => {
    writeContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'claimTimeLocked', args: [BigInt(tierIdx)] },
      { onSuccess: refetchAll })
  }

  const handleClaimRewards = () => {
    writeContract({ address: WSYLOS_ADDRESS, abi: WSYLOS_ABI, functionName: 'claimRewards' },
      { onSuccess: refetchAll })
  }

  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Coins size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>SYLOS Staking</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: '360px', lineHeight: 1.5 }}>
            Wrap SYLOS → wSYLOS. Time-lock for bonus rewards (5-20%).
            Staking earns passive rewards and boosts governance power.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'wrap', label: 'Wrap / Unwrap' },
    { id: 'timelock', label: 'Time Lock' },
    { id: 'rewards', label: 'Rewards' },
  ]

  return (
    <div style={cs.page}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Staking</h1>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              <a href={`https://polygonscan.com/address/${WSYLOS_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>WrappedSYLOS</a>
            </p>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: '100px', fontSize: '10px', fontWeight: 700, color: mult > 1 ? '#22c55e' : '#818cf8', background: mult > 1 ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${mult > 1 ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)'}` }}>
            {mult.toFixed(2)}x Multiplier
          </span>
        </div>

        {/* Balances */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'SYLOS', value: sylos.toFixed(2), color: '#818cf8' },
            { label: 'wSYLOS', value: wsylos.toFixed(2), color: '#a78bfa' },
            { label: 'Pending', value: `${pending.toFixed(4)}`, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={cs.card}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
              background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t.id ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* WRAP TAB */}
        {tab === 'wrap' && (
          <>
            <div style={cs.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ArrowLeftRight size={16} color="#818cf8" />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Wrap SYLOS → wSYLOS</h3>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '0 0 12px' }}>1:1 wrap. wSYLOS is needed for staking, governance, and earning rewards.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={wrapAmount} onChange={e => setWrapAmount(e.target.value)} placeholder={`Amount (${sylos.toFixed(2)} SYLOS available)`} type="number" style={{ ...cs.input, flex: 1 }} />
                <button onClick={handleWrap} disabled={isPending || !wrapAmount} style={{
                  padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: !wrapAmount ? 'not-allowed' : 'pointer',
                  background: wrapAmount ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                  color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: !wrapAmount ? 0.4 : 1,
                }}>{isPending ? '...' : 'Wrap'}</button>
              </div>
            </div>

            <div style={cs.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ArrowLeftRight size={16} color="#a78bfa" />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Unwrap wSYLOS → SYLOS</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={unwrapAmount} onChange={e => setUnwrapAmount(e.target.value)} placeholder={`Amount (${wsylos.toFixed(2)} wSYLOS available)`} type="number" style={{ ...cs.input, flex: 1 }} />
                <button onClick={handleUnwrap} disabled={isPending || !unwrapAmount} style={{
                  padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: !unwrapAmount ? 'not-allowed' : 'pointer',
                  background: unwrapAmount ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                  color: unwrapAmount ? '#ef4444' : 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: !unwrapAmount ? 0.4 : 1,
                }}>{isPending ? '...' : 'Unwrap'}</button>
              </div>
            </div>

            {/* Global stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ ...cs.card, padding: '12px 16px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginBottom: '4px' }}>Total wSYLOS Supply</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{totalSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
              <div style={{ ...cs.card, padding: '12px 16px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginBottom: '4px' }}>Total Rewards Accrued</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{totalRewards.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </>
        )}

        {/* TIME LOCK TAB */}
        {tab === 'timelock' && (
          <>
            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>Time-Lock for Bonus Rewards</h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '0 0 14px', lineHeight: 1.5 }}>
                Lock wSYLOS for a fixed period to earn bonus tokens on top of standard staking rewards.
              </p>

              {/* Tiers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {tiers.map((t, i) => {
                  const locked = lockAmts[i] ? Number(formatEther(lockAmts[i])) : 0
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${t.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Timer size={16} color={t.color} />
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{t.name}</div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>+{t.bonus} bonus on locked amount</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: locked > 0 ? t.color : 'rgba(255,255,255,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {locked.toFixed(2)} wSYLOS
                        </div>
                        {locked > 0 && (
                          <button onClick={() => handleClaimTimeLock(i)} disabled={isPending} style={{
                            marginTop: '4px', padding: '3px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '9px', fontWeight: 600, fontFamily: 'inherit',
                          }}>Claim</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Lock form */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input value={lockAmount} onChange={e => setLockAmount(e.target.value)} placeholder={`Amount (${wsylos.toFixed(2)} available)`} type="number" style={{ ...cs.input, flex: 1 }} />
                <select value={lockTier} onChange={e => setLockTier(e.target.value)} style={{ ...cs.input, width: '120px', cursor: 'pointer' }}>
                  {tiers.map((t, i) => <option key={i} value={i}>{t.name} (+{t.bonus})</option>)}
                </select>
              </div>
              <button onClick={handleTimeLock} disabled={isPending || !lockAmount} style={{
                width: '100%', marginTop: '8px', padding: '12px', borderRadius: '10px', border: 'none',
                cursor: !lockAmount ? 'not-allowed' : 'pointer',
                background: lockAmount ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: !lockAmount ? 0.4 : 1,
              }}>
                {isPending ? 'Locking...' : `🔒 Time-Lock wSYLOS for ${tiers[parseInt(lockTier)].name}`}
              </button>
            </div>
          </>
        )}

        {/* REWARDS TAB */}
        {tab === 'rewards' && (
          <>
            <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.05))', borderColor: 'rgba(245,158,11,0.15)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Pending Rewards</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{pending.toFixed(6)}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>wSYLOS tokens</div>
              </div>
            </div>

            <button onClick={handleClaimRewards} disabled={isPending || pending === 0} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              cursor: isPending || pending === 0 ? 'not-allowed' : 'pointer',
              background: pending > 0 ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              opacity: isPending || pending === 0 ? 0.4 : 1,
            }}>
              {isPending ? 'Claiming...' : pending > 0 ? `Claim ${pending.toFixed(4)} wSYLOS` : 'No rewards to claim'}
            </button>

            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 10px' }}>How Rewards Work</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: '#818cf8', fontWeight: 700, minWidth: '16px' }}>1.</span>
                  <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Base staking</strong> — Hold wSYLOS to accrue rewards proportional to your share of total supply</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: '#818cf8', fontWeight: 700, minWidth: '16px' }}>2.</span>
                  <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Time-lock bonus</strong> — Lock wSYLOS for 30/90/365 days to earn 5%/10%/20% bonus on top</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: '#818cf8', fontWeight: 700, minWidth: '16px' }}>3.</span>
                  <span><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Staking multiplier</strong> — Your current multiplier is <strong style={{ color: '#22c55e' }}>{mult.toFixed(2)}x</strong>, boosting governance power and rewards</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}