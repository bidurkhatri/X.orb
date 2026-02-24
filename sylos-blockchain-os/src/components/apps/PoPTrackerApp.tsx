import { useState, useEffect, useCallback } from 'react'
import { Activity, Award, Zap, Plus, CheckCircle2, Clock, TrendingUp, BarChart3, RefreshCw, ExternalLink, Loader2, ChevronRight, Target, Timer, Brain, Users, Lightbulb, Gauge } from 'lucide-react'
import { useAccount, useReadContract, useWriteContract, useReadContracts } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { formatEther, parseEther } from 'viem'
import { CONTRACTS } from '../../config/contracts'

const POP_ADDRESS = CONTRACTS.POP_TRACKER as `0x${string}`

// Complete ABI for all PoPTracker contract functions we use
const POP_ABI = [
  // Read functions
  { inputs: [{ name: '', type: 'address' }], name: 'userProfiles', outputs: [{ name: 'totalTasks', type: 'uint256' }, { name: 'completedTasks', type: 'uint256' }, { name: 'totalScore', type: 'uint256' }, { name: 'averageScore', type: 'uint256' }, { name: 'lastUpdateTime', type: 'uint256' }, { name: 'consecutiveDaysActive', type: 'uint256' }, { name: 'isActive', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalUsers', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalTasksCompleted', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentCycleId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'nextTaskId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'cycleDuration', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'taskCompletionWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'codeQualityWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'collaborationWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'innovationWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'impactWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'efficiencyWeight', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'baseRewardRate', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'uint256' }], name: 'tasks', outputs: [{ name: 'taskId', type: 'uint256' }, { name: 'taskDescription', type: 'string' }, { name: 'estimatedHours', type: 'uint256' }, { name: 'actualHours', type: 'uint256' }, { name: 'complexity', type: 'uint256' }, { name: 'qualityScore', type: 'uint256' }, { name: 'completedAt', type: 'uint256' }, { name: 'deliverableHash', type: 'string' }], stateMutability: 'view', type: 'function' },
  // Write functions
  { inputs: [{ name: 'assignee', type: 'address' }, { name: 'taskDescription', type: 'string' }, { name: 'estimatedHours', type: 'uint256' }, { name: 'complexity', type: 'uint256' }], name: 'createTask', outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'taskId', type: 'uint256' }, { name: 'actualHours', type: 'uint256' }, { name: 'qualityScore', type: 'uint256' }, { name: 'deliverableHash', type: 'string' }], name: 'completeTask', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'withdrawRewards', outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const

const cs = {
  page: { height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  btn: (active: boolean) => ({ padding: '10px 16px', borderRadius: '10px', border: 'none', cursor: active ? 'pointer' : 'not-allowed', background: active ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: active ? 1 : 0.4, width: '100%' }) as React.CSSProperties,
}

type Tab = 'overview' | 'tasks' | 'submit' | 'weights'

export default function PoPTrackerApp() {
  const { address, isConnected } = useAccount()
  const { writeContract, isPending } = useWriteContract()
  const [tab, setTab] = useState<Tab>('overview')
  const [newTask, setNewTask] = useState({ description: '', hours: '', complexity: '5' })
  const [completeForm, setCompleteForm] = useState({ taskId: '', actualHours: '', qualityScore: '', deliverable: '' })

  // Read user profile from contract
  const { data: userProfile, refetch: refetchProfile } = useReadContract({
    address: POP_ADDRESS, abi: POP_ABI, functionName: 'userProfiles',
    args: address ? [address] : undefined, query: { enabled: !!address },
  })

  // Read global stats
  const { data: globalStats } = useReadContracts({
    contracts: [
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'totalUsers' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'totalTasksCompleted' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'currentCycleId' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'nextTaskId' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'baseRewardRate' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'taskCompletionWeight' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'codeQualityWeight' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'collaborationWeight' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'innovationWeight' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'impactWeight' },
      { address: POP_ADDRESS, abi: POP_ABI, functionName: 'efficiencyWeight' },
    ],
  })

  const g = (i: number) => globalStats?.[i]?.result ? Number(globalStats[i].result) : 0
  const totalUsers = g(0)
  const totalTasks = g(1)
  const cycleId = g(2)
  const nextTaskId = g(3)
  const rewardRate = g(4)
  const weights = [
    { label: 'Task Completion', value: g(5), icon: <Target size={14} />, color: '#6366f1' },
    { label: 'Code Quality', value: g(6), icon: <Brain size={14} />, color: '#8b5cf6' },
    { label: 'Collaboration', value: g(7), icon: <Users size={14} />, color: '#22c55e' },
    { label: 'Innovation', value: g(8), icon: <Lightbulb size={14} />, color: '#f59e0b' },
    { label: 'Impact', value: g(9), icon: <TrendingUp size={14} />, color: '#ef4444' },
    { label: 'Efficiency', value: g(10), icon: <Gauge size={14} />, color: '#06b6d4' },
  ]

  // Extract user profile
  const profile = userProfile as any
  const totalScore = profile ? Number(profile[2] || 0) : 0
  const avgScore = profile ? Number(profile[3] || 0) : 0
  const userTasks = profile ? Number(profile[0] || 0) : 0
  const completed = profile ? Number(profile[1] || 0) : 0
  const streak = profile ? Number(profile[5] || 0) : 0
  const isActive = profile ? Boolean(profile[6]) : false

  const rank = totalScore > 10000 ? 'Diamond' : totalScore > 5000 ? 'Platinum' : totalScore > 1000 ? 'Gold' : totalScore > 100 ? 'Silver' : 'Bronze'
  const rankColors: Record<string, string> = { Diamond: '#06b6d4', Platinum: '#a78bfa', Gold: '#f59e0b', Silver: '#94a3b8', Bronze: '#cd7f32' }

  const handleCreateTask = () => {
    if (!newTask.description || !newTask.hours || !address) return
    writeContract({
      address: POP_ADDRESS, abi: POP_ABI, functionName: 'createTask',
      args: [address, newTask.description, BigInt(parseInt(newTask.hours)), BigInt(parseInt(newTask.complexity))],
    }, { onSuccess: () => { setNewTask({ description: '', hours: '', complexity: '5' }); refetchProfile() } })
  }

  const handleCompleteTask = () => {
    if (!completeForm.taskId || !completeForm.actualHours || !completeForm.qualityScore) return
    writeContract({
      address: POP_ADDRESS, abi: POP_ABI, functionName: 'completeTask',
      args: [BigInt(parseInt(completeForm.taskId)), BigInt(parseInt(completeForm.actualHours)), BigInt(parseInt(completeForm.qualityScore)), completeForm.deliverable || ''],
    }, { onSuccess: () => { setCompleteForm({ taskId: '', actualHours: '', qualityScore: '', deliverable: '' }); refetchProfile() } })
  }

  const handleWithdraw = () => {
    writeContract({ address: POP_ADDRESS, abi: POP_ABI, functionName: 'withdrawRewards' })
  }

  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Proof of Productivity</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: '360px', lineHeight: 1.5 }}>
            On-chain productivity tracking with Chainlink oracle verification,
            weighted scoring (6 dimensions), and token reward cycles.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'submit', label: 'Submit Work' },
    { id: 'weights', label: 'Scoring' },
  ]

  return (
    <div style={cs.page}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Proof of Productivity</h1>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              On-chain at <a href={`https://polygonscan.com/address/${POP_ADDRESS}`} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>{POP_ADDRESS.slice(0, 10)}...{POP_ADDRESS.slice(-4)}</a>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '4px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: 700, color: rankColors[rank], background: `${rankColors[rank]}15`, border: `1px solid ${rankColors[rank]}30` }}>
              {rank}
            </span>
            {isActive && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} title="Active" />}
          </div>
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

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <>
            {/* User Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { label: 'PoP Score', value: totalScore.toLocaleString(), icon: <Activity size={16} color="#6366f1" />, sub: `Avg: ${avgScore}` },
                { label: 'Tasks', value: `${completed}/${userTasks}`, icon: <CheckCircle2 size={16} color="#22c55e" />, sub: 'Completed' },
                { label: 'Streak', value: `${streak}d`, icon: <Zap size={16} color="#f59e0b" />, sub: 'Consecutive' },
              ].map(s => (
                <div key={s.label} style={cs.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                    {s.icon}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Network Stats */}
            <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.1))', borderColor: 'rgba(99,102,241,0.15)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Network Stats (from contract)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Total Users', value: totalUsers.toLocaleString() },
                  { label: 'Tasks Completed', value: totalTasks.toLocaleString() },
                  { label: 'Reward Cycle', value: `#${cycleId}` },
                  { label: 'Reward Rate', value: `${rewardRate} wSYLOS/1k pts` },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Withdraw */}
            <button onClick={handleWithdraw} disabled={isPending} style={cs.btn(!isPending)}>
              {isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />Withdrawing...</> : '💰 Withdraw Rewards from Previous Cycle'}
            </button>
          </>
        )}

        {/* TASKS TAB */}
        {tab === 'tasks' && (
          <>
            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Create New Task</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Task description (e.g., Implement auth module)" style={cs.input} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input value={newTask.hours} onChange={e => setNewTask(p => ({ ...p, hours: e.target.value }))} placeholder="Estimated hours" type="number" style={cs.input} />
                  <div style={{ position: 'relative' }}>
                    <input value={newTask.complexity} onChange={e => setNewTask(p => ({ ...p, complexity: e.target.value }))} placeholder="Complexity (1-10)" type="number" min="1" max="10" style={cs.input} />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>/10</span>
                  </div>
                </div>
                <button onClick={handleCreateTask} disabled={isPending || !newTask.description || !newTask.hours} style={cs.btn(!isPending && !!newTask.description && !!newTask.hours)}>
                  {isPending ? 'Creating...' : '+ Create Task On-Chain'}
                </button>
              </div>
            </div>

            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Complete Task</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input value={completeForm.taskId} onChange={e => setCompleteForm(p => ({ ...p, taskId: e.target.value }))} placeholder="Task ID" type="number" style={cs.input} />
                  <input value={completeForm.actualHours} onChange={e => setCompleteForm(p => ({ ...p, actualHours: e.target.value }))} placeholder="Actual hours spent" type="number" style={cs.input} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <input value={completeForm.qualityScore} onChange={e => setCompleteForm(p => ({ ...p, qualityScore: e.target.value }))} placeholder="Quality score (0-1000)" type="number" min="0" max="1000" style={cs.input} />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>/1000</span>
                  </div>
                  <input value={completeForm.deliverable} onChange={e => setCompleteForm(p => ({ ...p, deliverable: e.target.value }))} placeholder="IPFS hash (optional)" style={cs.input} />
                </div>
                <button onClick={handleCompleteTask} disabled={isPending || !completeForm.taskId || !completeForm.actualHours || !completeForm.qualityScore} style={cs.btn(!isPending && !!completeForm.taskId)}>
                  {isPending ? 'Submitting...' : '✓ Complete Task On-Chain'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={10} /> Next task ID: #{nextTaskId} • Tasks are immutably recorded on Polygon
            </div>
          </>
        )}

        {/* SUBMIT WORK TAB */}
        {tab === 'submit' && (
          <div style={cs.card}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>How PoP Scoring Works</h3>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '0 0 16px', lineHeight: 1.5 }}>
              When you complete a task, your productivity score is calculated across 6 weighted dimensions.
              Each dimension is scored 0-1000. Your final score is a weighted sum.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {weights.map(w => (
                <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: w.color, width: '20px', textAlign: 'center' }}>{w.icon}</span>
                  <span style={{ flex: 1, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{w.label}</span>
                  <div style={{ width: '120px', height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${w.value / 100}%`, borderRadius: '3px', background: w.color, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: w.color, fontFamily: "'JetBrains Mono', monospace", width: '40px', textAlign: 'right' }}>{(w.value / 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', fontSize: '11px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
              <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Chainlink Oracle Verification:</strong> Evidence URLs (GitHub PRs, commits, etc.) can be verified automatically via Chainlink Functions. The contract sends the URL to a Chainlink DON which validates the work and returns a verification score.
            </div>
          </div>
        )}

        {/* SCORING WEIGHTS TAB */}
        {tab === 'weights' && (
          <>
            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Live Scoring Weights (from contract)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {weights.map(w => (
                  <div key={w.label} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ color: w.color }}>{w.icon}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{w.label}</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: w.color, fontFamily: "'JetBrains Mono', monospace" }}>{(w.value / 100).toFixed(0)}%</div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', marginTop: '2px' }}>{w.value} / 10000 basis points</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...cs.card, background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Award size={16} color="#f59e0b" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Reward Economics</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Base Reward Rate</div>
                  <div style={{ fontWeight: 700, color: '#f59e0b', fontFamily: "'JetBrains Mono', monospace" }}>{rewardRate} wSYLOS / 1000 pts</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Cycle Duration</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>30 days</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Current Cycle</div>
                  <div style={{ fontWeight: 700, color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>#{cycleId}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Reward Token</div>
                  <div style={{ fontWeight: 700, color: '#fff' }}>wSYLOS (ERC20)</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
