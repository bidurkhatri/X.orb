import { useState, useEffect, useCallback } from 'react'
import { Coins, TrendingUp, ArrowUpRight, RefreshCw, ExternalLink, Copy, Check, Loader2 } from 'lucide-react'
import { useAccount, useBalance } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CONTRACTS, CHAIN } from '../../config/contracts'

const RPC_URL = () => CHAIN.RPC

// All SylOS + popular Polygon tokens
const TOKEN_LIST = [
  { symbol: 'POL', name: 'Polygon', address: null, decimals: 18, color: '#8247e5', native: true },
  { symbol: 'wSYLOS', name: 'Wrapped SYLOS', address: CONTRACTS.WSYLOS_TOKEN, decimals: 18, color: '#6366f1', native: false },
  { symbol: 'SYLOS', name: 'SylOS Token', address: CONTRACTS.SYLOS_TOKEN, decimals: 18, color: '#818cf8', native: false },
  { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, color: '#2775ca', native: false },
  { symbol: 'USDT', name: 'Tether', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, color: '#26a17b', native: false },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, color: '#627eea', native: false },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, color: '#f4b731', native: false },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, color: '#f7931a', native: false },
]

const SylOS_CONTRACTS = [
  { name: 'SylOSToken', address: CONTRACTS.SYLOS_TOKEN },
  { name: 'WrappedSYLOS', address: CONTRACTS.WSYLOS_TOKEN },
  { name: 'PoPTracker', address: CONTRACTS.POP_TRACKER },
  { name: 'Governance', address: CONTRACTS.GOVERNANCE },
  { name: 'Paymaster', address: CONTRACTS.PAYMASTER },
]

/* RPC balance fetch */
async function fetchERC20Balance(tokenAddr: string, walletAddr: string, decimals: number): Promise<string> {
  const data = '0x70a08231' + walletAddr.slice(2).padStart(64, '0')
  const res = await fetch(RPC_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_call', params: [{ to: tokenAddr, data }, 'latest'] }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  const balance = Number(BigInt(json.result)) / Math.pow(10, decimals)
  return balance.toFixed(decimals > 8 ? 6 : decimals === 6 ? 2 : 4)
}

async function fetchGasPrice(): Promise<string> {
  const res = await fetch(RPC_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
  })
  const json = await res.json()
  return (Number(BigInt(json.result)) / 1e9).toFixed(2)
}

async function fetchBlockNumber(): Promise<number> {
  const res = await fetch(RPC_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  })
  const json = await res.json()
  return parseInt(json.result, 16)
}

const cs = {
  page: { height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
}

export default function TokenDashboardApp() {
  const { address, isConnected } = useAccount()
  const { data: polBal, refetch: refetchPol } = useBalance({ address })

  const [balances, setBalances] = useState<Record<string, string>>({})
  const [gasPrice, setGasPrice] = useState<string>('')
  const [blockNum, setBlockNum] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  const [copied, setCopied] = useState('')

  const fetchAllBalances = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const results: Record<string, string> = {}
      const [gas, block] = await Promise.all([fetchGasPrice(), fetchBlockNumber()])
      setGasPrice(gas)
      setBlockNum(block)

      // Fetch ERC-20 balances in parallel
      const erc20Tokens = TOKEN_LIST.filter(t => !t.native && t.address)
      const fetchPromises = erc20Tokens.map(t =>
        fetchERC20Balance(t.address!, address, t.decimals)
          .then(bal => { results[t.symbol] = bal })
          .catch(() => { results[t.symbol] = '0.00' })
      )
      await Promise.all(fetchPromises)
      setBalances(results)
      setLastUpdate(Date.now())
    } catch (e) { console.error('[Tokens] Fetch error:', e) }
    finally { setLoading(false) }
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchAllBalances()
  }, [isConnected, address, fetchAllBalances])

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(addr)
    setTimeout(() => setCopied(''), 2000)
  }

  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Coins size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Token Dashboard</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Connect to view real on-chain token balances across 8 assets</p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  const polFormatted = polBal ? Number(polBal.formatted).toFixed(4) : '—'
  const allTokens = TOKEN_LIST.map(t => ({
    ...t,
    balance: t.native ? polFormatted : (balances[t.symbol] || '—'),
    isZero: t.native ? polFormatted === '0.0000' : (balances[t.symbol] || '0') === '0.00' || (balances[t.symbol] || '0') === '0.000000',
  }))

  const nonZero = allTokens.filter(t => !t.isZero)
  const zero = allTokens.filter(t => t.isZero)

  return (
    <div style={cs.page}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Header card */}
        <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.15))', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Portfolio — {allTokens.length} tokens tracked</span>
            <button onClick={() => { refetchPol(); fetchAllBalances() }} disabled={loading} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            </button>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            {polFormatted} <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{polBal?.symbol || 'POL'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={12} /> Block #{blockNum.toLocaleString()}</span>
            <span>Gas: {gasPrice} Gwei</span>
            {lastUpdate > 0 && <span>Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago</span>}
          </div>
        </div>

        {/* Token list — Non-zero first */}
        {nonZero.length > 0 && (
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 4px 0' }}>Holdings</div>
        )}
        {nonZero.map(t => (
          <div key={t.symbol} style={cs.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `linear-gradient(135deg, ${t.color}, ${t.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                  {t.symbol.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{t.symbol}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{t.name}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '2px', fontFamily: "'JetBrains Mono', monospace" }}>{t.balance}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '10px', fontWeight: 600 }}>
                <ArrowUpRight size={11} /> On-chain
              </div>
            </div>
            {t.address && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{t.address}</span>
                <button onClick={() => copyAddr(t.address!)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'rgba(255,255,255,0.2)' }}>
                  {copied === t.address ? <Check size={10} color="#22c55e" /> : <Copy size={10} />}
                </button>
                <a href={`https://polygonscan.com/token/${t.address}`} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        ))}

        {/* Zero balance tokens */}
        {zero.length > 0 && (
          <>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.15)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 4px 0' }}>Zero Balance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {zero.map(t => (
                <div key={t.symbol} style={{ ...cs.card, padding: '12px 14px', opacity: 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${t.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, fontWeight: 700, fontSize: '11px' }}>{t.symbol.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{t.symbol}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>0.00</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* SylOS Contracts */}
        <div style={{ ...cs.card, marginTop: '4px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Coins size={14} color="#818cf8" /> SylOS Contracts
          </h3>
          {SylOS_CONTRACTS.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>{c.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>{c.address.slice(0, 6)}...{c.address.slice(-4)}</span>
                <button onClick={() => copyAddr(c.address)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'rgba(255,255,255,0.2)' }}>
                  {copied === c.address ? <Check size={10} color="#22c55e" /> : <Copy size={10} />}
                </button>
                <a href={`https://polygonscan.com/address/${c.address}`} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
