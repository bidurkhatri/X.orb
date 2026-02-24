import { useState, useEffect, useCallback } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseEther } from 'viem'
import { ArrowLeftRight, Clock, CheckCircle, AlertTriangle, ExternalLink, Loader2, ArrowDown, Shield, Zap } from 'lucide-react'

// Polygon PoS Bridge (RootChainManager) for ETH → Polygon deposits
const POLYGON_BRIDGE_URL = 'https://portal.polygon.technology/bridge'
const POLYGON_DEPOSIT_MANAGER = '0xA0c68C638235ee32657e8f720a23ceC1bFc77C77' // PoS Bridge DepositManager on Ethereum
const RPC_URL = () => (import.meta.env['VITE_POLYGON_RPC'] as string) || 'https://polygon-rpc.com'

const rpcCall = async (method: string, params: any[]) => {
  const res = await fetch(RPC_URL(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }) })
  return (await res.json()).result
}

interface BridgeTx { hash: string; from: string; to: string; value: string; timestamp: number; status: 'pending' | 'completed' | 'failed'; direction: 'deposit' | 'withdraw' }

const cs = {
  page: { height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

const chains = [
  { id: 1, name: 'Ethereum', color: '#627eea', icon: '⟠' },
  { id: 137, name: 'Polygon PoS', color: '#8247e5', icon: '⬡' },
  { id: 42161, name: 'Arbitrum', color: '#28a0f0', icon: '◆' },
  { id: 10, name: 'Optimism', color: '#ff0420', icon: '⊕' },
  { id: 8453, name: 'Base', color: '#0052ff', icon: '◉' },
]

const tokens = [
  { symbol: 'POL', name: 'Polygon', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', decimals: 6 },
  { symbol: 'WETH', name: 'Wrapped ETH', decimals: 18 },
  { symbol: 'DAI', name: 'Dai', decimals: 18 },
]

type Tab = 'bridge' | 'history' | 'info'

export default function BridgeInterface() {
  const { address, isConnected } = useAccount()
  const { sendTransaction, isPending } = useSendTransaction()
  const [tab, setTab] = useState<Tab>('bridge')
  const [fromChain, setFromChain] = useState(1)
  const [toChain, setToChain] = useState(137)
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState('POL')
  const [gasPrice, setGasPrice] = useState('—')
  const [bridgeTxs, setBridgeTxs] = useState<BridgeTx[]>([])

  const fromC = chains.find(c => c.id === fromChain)!
  const toC = chains.find(c => c.id === toChain)!

  // Fetch gas price
  useEffect(() => {
    const fetch = async () => {
      try {
        const hex = await rpcCall('eth_gasPrice', [])
        setGasPrice((parseInt(hex, 16) / 1e9).toFixed(1))
      } catch { }
    }
    fetch()
    const iv = setInterval(fetch, 15000)
    return () => clearInterval(iv)
  }, [])

  // Load bridge history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sylos_bridge_txs')
    if (saved) setBridgeTxs(JSON.parse(saved))
  }, [])

  const swapChains = () => { setFromChain(toChain); setToChain(fromChain) }

  const handleBridge = useCallback(() => {
    if (!amount || !address) return

    // For Polygon PoS native bridge (ETH→Polygon), we send to the deposit manager
    // For other routes, we redirect to Polygon Portal
    if (fromChain === 1 && toChain === 137 && selectedToken === 'POL') {
      sendTransaction({
        to: POLYGON_DEPOSIT_MANAGER as `0x${string}`,
        value: parseEther(amount),
      }, {
        onSuccess: (hash) => {
          const tx: BridgeTx = { hash, from: fromC.name, to: toC.name, value: amount, timestamp: Date.now(), status: 'pending', direction: 'deposit' }
          const updated = [tx, ...bridgeTxs]
          setBridgeTxs(updated)
          localStorage.setItem('sylos_bridge_txs', JSON.stringify(updated))
          setAmount('')
        }
      })
    } else {
      // For other routes, open Polygon Portal with pre-filled params
      window.open(`${POLYGON_BRIDGE_URL}?amount=${amount}&token=${selectedToken}&sourceNetwork=${fromChain}&destinationNetwork=${toChain}`, '_blank')
    }
  }, [amount, address, fromChain, toChain, selectedToken, sendTransaction, fromC, toC, bridgeTxs])

  const estimatedTime = fromChain === 1 && toChain === 137 ? '~7-8 min' : fromChain === 137 && toChain === 1 ? '~30 min (checkpoint)' : '~2-5 min'
  const estimatedFee = gasPrice !== '—' ? `~${(parseFloat(gasPrice) * 0.021).toFixed(2)} Gwei` : '...'

  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeftRight size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Cross-Chain Bridge</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: '380px', lineHeight: 1.5 }}>
            Bridge assets between Ethereum, Polygon, Arbitrum, Optimism & Base using Polygon PoS Bridge and portal.
          </p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const tabItems: { id: Tab; label: string }[] = [
    { id: 'bridge', label: 'Bridge' },
    { id: 'history', label: `History (${bridgeTxs.length})` },
    { id: 'info', label: 'Info' },
  ]

  return (
    <div style={cs.page}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 4px 0' }}>Bridge</h1>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            Polygon PoS Bridge • Gas: {gasPrice} Gwei
          </p>
        </div>

        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          {tabItems.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
              background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t.id ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* BRIDGE TAB */}
        {tab === 'bridge' && (
          <>
            <div style={cs.card}>
              {/* From Chain */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>From</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {chains.map(c => (
                    <button key={c.id} onClick={() => { setFromChain(c.id); if (c.id === toChain) setToChain(fromChain) }} style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: fromChain === c.id ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.04)',
                      background: fromChain === c.id ? `${c.color}15` : 'rgba(255,255,255,0.02)', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                      color: fromChain === c.id ? c.color : 'rgba(255,255,255,0.3)', fontFamily: 'inherit', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '16px', marginBottom: '2px' }}>{c.icon}</div>
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Swap button */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                <button onClick={swapChains} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                  <ArrowDown size={14} />
                </button>
              </div>

              {/* To Chain */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>To</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {chains.filter(c => c.id !== fromChain).map(c => (
                    <button key={c.id} onClick={() => setToChain(c.id)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: '8px', border: toChain === c.id ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.04)',
                      background: toChain === c.id ? `${c.color}15` : 'rgba(255,255,255,0.02)', cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                      color: toChain === c.id ? c.color : 'rgba(255,255,255,0.3)', fontFamily: 'inherit', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '16px', marginBottom: '2px' }}>{c.icon}</div>
                      {c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Token & Amount */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <select value={selectedToken} onChange={e => setSelectedToken(e.target.value)} style={{ ...cs.input, width: '110px', cursor: 'pointer' }}>
                  {tokens.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" type="number" style={{ ...cs.input, flex: 1 }} />
              </div>

              {/* Estimates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Est. Time', value: estimatedTime, icon: <Clock size={10} /> },
                  { label: 'Est. Fee', value: estimatedFee, icon: <Zap size={10} /> },
                  { label: 'Route', value: fromChain === 1 || toChain === 1 ? 'PoS Bridge' : 'Portal', icon: <Shield size={10} /> },
                ].map(e => (
                  <div key={e.label} style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginBottom: '3px' }}>{e.icon} {e.label}</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>{e.value}</div>
                  </div>
                ))}
              </div>

              {/* Bridge Button */}
              <button onClick={handleBridge} disabled={isPending || !amount} style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                cursor: !amount ? 'not-allowed' : 'pointer',
                background: amount ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
                color: '#fff', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit', opacity: !amount ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {isPending ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Bridging...</> :
                  <><ArrowLeftRight size={16} /> Bridge {amount || '0'} {selectedToken}: {fromC.name.split(' ')[0]} → {toC.name.split(' ')[0]}</>}
              </button>
            </div>

            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Shield size={10} /> ETH↔Polygon uses native PoS Bridge. Other routes open Polygon Portal.
            </div>
          </>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div style={cs.card}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Bridge Transactions</h3>
            {bridgeTxs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>
                No bridge transactions yet
              </div>
            ) : (
              bridgeTxs.map((tx, i) => (
                <a key={i} href={`https://${tx.direction === 'deposit' ? 'etherscan.io' : 'polygonscan.com'}/tx/${tx.hash}`} target="_blank" rel="noreferrer" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '8px', marginBottom: '6px',
                  background: 'rgba(255,255,255,0.02)', textDecoration: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: tx.status === 'completed' ? 'rgba(34,197,94,0.1)' : tx.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'
                    }}>
                      {tx.status === 'completed' ? <CheckCircle size={12} color="#22c55e" /> : tx.status === 'failed' ? <AlertTriangle size={12} color="#ef4444" /> : <Clock size={12} color="#f59e0b" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: '#fff' }}>{tx.from} → {tx.to}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)' }}>{new Date(tx.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>{tx.value} POL</div>
                </a>
              ))
            )}
          </div>
        )}

        {/* INFO TAB */}
        {tab === 'info' && (
          <>
            <div style={cs.card}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 10px' }}>Bridge Routes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { route: 'ETH → Polygon', method: 'Native PoS Bridge', time: '~7 min', security: 'Validator set (100+)' },
                  { route: 'Polygon → ETH', method: 'PoS Checkpoint', time: '~30 min', security: 'Checkpoint + validator proof' },
                  { route: 'L2 ↔ L2', method: 'Polygon Portal', time: '~2-5 min', security: 'Aggregated liquidity' },
                ].map(r => (
                  <div key={r.route} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{r.route}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '10px' }}>
                      <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>Method:</span> <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.method}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>Time:</span> <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.time}</span></div>
                      <div><span style={{ color: 'rgba(255,255,255,0.2)' }}>Security:</span> <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.security}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <a href="https://portal.polygon.technology" target="_blank" rel="noreferrer" style={{ ...cs.card, textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ExternalLink size={14} color="#8247e5" />
                <div><div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>Polygon Portal</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>Official bridge</div></div>
              </a>
              <a href="https://polygonscan.com/bridges" target="_blank" rel="noreferrer" style={{ ...cs.card, textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ExternalLink size={14} color="#818cf8" />
                <div><div style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>Bridge Explorer</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>Track bridges</div></div>
              </a>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}