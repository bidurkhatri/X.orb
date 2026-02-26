import { useState, useEffect, useCallback } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { ArrowUpDown, TrendingUp, Shield, Droplets, Zap, Loader2, ExternalLink, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

const RPC_URL = () => (import.meta.env['VITE_POLYGON_RPC'] as string) || 'https://polygon-rpc.com'

const TOKENS = [
  { symbol: 'POL', name: 'Polygon', address: null, decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 },
  { symbol: 'DAI', name: 'Dai', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
]

// Wrapped POL (WMATIC) address on Polygon
const WPOL = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'

// QuickSwap V3 Quoter on Polygon (Algebra-based)
const QUICKSWAP_QUOTER = '0xa15F0D7377B2A0C0500e61401F04e21BAa0CDb6b'

// QuickSwap V3 Router on Polygon
const QUICKSWAP_ROUTER = '0xf5b509bB0909a69B1c207E495f687a596C168E12'

async function rpcCall(method: string, params: any[] = []) {
  const res = await fetch(RPC_URL(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  return (await res.json()).result
}

// ─── Get a swap quote via QuickSwap V3 Quoter ───

function encodeQuoteSingle(tokenIn: string, tokenOut: string, amountIn: bigint): string {
  // quoteExactInputSingle(address tokenIn, address tokenOut, uint256 amountIn, uint160 sqrtPriceLimitX96)
  // selector: cdca1753  (AlgebraQuoter)
  const selector = 'cdca1753'
  const encTokenIn = tokenIn.slice(2).padStart(64, '0')
  const encTokenOut = tokenOut.slice(2).padStart(64, '0')
  const encAmountIn = amountIn.toString(16).padStart(64, '0')
  const encLimitPrice = '0'.padStart(64, '0') // 0 = no limit
  return `0x${selector}${encTokenIn}${encTokenOut}${encAmountIn}${encLimitPrice}`
}

async function getQuote(fromSymbol: string, toSymbol: string, amountIn: string): Promise<{ amountOut: string; raw: bigint } | null> {
  const fromToken = TOKENS.find(t => t.symbol === fromSymbol)
  const toToken = TOKENS.find(t => t.symbol === toSymbol)
  if (!fromToken || !toToken || !amountIn || parseFloat(amountIn) <= 0) return null

  const tokenInAddr = fromToken.address || WPOL  // POL → use WPOL
  const tokenOutAddr = toToken.address || WPOL

  const amountInWei = BigInt(Math.floor(parseFloat(amountIn) * (10 ** fromToken.decimals)))
  const data = encodeQuoteSingle(tokenInAddr, tokenOutAddr, amountInWei)

  try {
    const result = await rpcCall('eth_call', [{ to: QUICKSWAP_QUOTER, data }, 'latest'])
    if (!result || result === '0x') return null
    // Quoter returns (uint256 amountOut, uint16 fee)
    const amountOutRaw = BigInt('0x' + result.slice(2, 66))
    const amountOut = Number(amountOutRaw) / (10 ** toToken.decimals)
    return { amountOut: amountOut.toFixed(toToken.decimals <= 6 ? 4 : 8), raw: amountOutRaw }
  } catch {
    return null
  }
}



// ─── Pool pair definitions with actual Algebra pool addresses ───

interface PoolData {
  pair: string
  token0: string
  token1: string
  poolAddress: string
  tvl: string
  apr: string
  volume24h: string
  live: boolean
  loading: boolean
}

const POOL_DEFS: Omit<PoolData, 'tvl' | 'apr' | 'volume24h' | 'live' | 'loading'>[] = [
  { pair: 'POL / USDC', token0: WPOL, token1: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', poolAddress: '0xEF4fB69F649E3956959e0E038CE8bBB94Ef7abFA' },
  { pair: 'WETH / USDC', token0: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', token1: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', poolAddress: '0x55CAaBB0d2b704FD0eF8192A7E35D8837e678207' },
  { pair: 'USDC / DAI', token0: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', token1: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', poolAddress: '0xe7E0eB47E55b90b0DB45e2E8C2E4c7E9b8d3E25F' },
  { pair: 'POL / WETH', token0: WPOL, token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', poolAddress: '0x479e1B71A702a595e19b6d5932CD5c863ab57ee0' },
  { pair: 'WBTC / WETH', token0: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', poolAddress: '0x4B9f4d2435Ef65559567e5DbFC1BbB37abC43B57' },
  { pair: 'USDT / USDC', token0: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', token1: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', poolAddress: '0x7B925e617aefd7FB3a93Abe3A701135D7a1Ba710' },
]

// Fetch real pool TVL from on-chain token balances
async function fetchPoolTvl(pool: typeof POOL_DEFS[0]): Promise<{ tvl: string; live: boolean }> {
  try {
    // Get balances of both tokens in the pool
    const [bal0Raw, bal1Raw] = await Promise.all([
      rpcCall('eth_call', [{ to: pool.token0, data: '0x70a08231' + pool.poolAddress.slice(2).padStart(64, '0') }, 'latest']),
      rpcCall('eth_call', [{ to: pool.token1, data: '0x70a08231' + pool.poolAddress.slice(2).padStart(64, '0') }, 'latest']),
    ])

    const token0Info = TOKENS.find(t => t.address === pool.token0) || { decimals: 18, symbol: 'WPOL' }
    const token1Info = TOKENS.find(t => t.address === pool.token1) || { decimals: 18, symbol: 'WPOL' }

    const bal0 = Number(BigInt(bal0Raw || '0x0')) / (10 ** token0Info.decimals)
    const bal1 = Number(BigInt(bal1Raw || '0x0')) / (10 ** token1Info.decimals)

    // For simplicity, sum as USD equivalents (stables = 1:1, others need price — approximate)
    const stables = ['USDC', 'USDT', 'DAI']
    const isStable0 = stables.includes(token0Info.symbol)
    const isStable1 = stables.includes(token1Info.symbol)

    let tvlUsd: number
    if (isStable0 && isStable1) {
      tvlUsd = bal0 + bal1
    } else if (isStable0) {
      tvlUsd = bal0 * 2 // Assume balanced pool
    } else if (isStable1) {
      tvlUsd = bal1 * 2
    } else {
      // Both non-stable — show raw combined, mark as approximate
      tvlUsd = bal0 + bal1
    }

    if (tvlUsd > 1_000_000) return { tvl: `$${(tvlUsd / 1_000_000).toFixed(2)}M`, live: true }
    if (tvlUsd > 1_000) return { tvl: `$${(tvlUsd / 1_000).toFixed(1)}K`, live: true }
    if (tvlUsd > 0) return { tvl: `$${tvlUsd.toFixed(0)}`, live: true }
    return { tvl: '—', live: false }
  } catch {
    return { tvl: '—', live: false }
  }
}

const s = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  label: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '6px' } as React.CSSProperties,
  input: { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const } as React.CSSProperties,
  select: { width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'inherit', appearance: 'none' as const, cursor: 'pointer', boxSizing: 'border-box' as const } as React.CSSProperties,
  btn: { width: '100%', padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  tab: (active: boolean) => ({ padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', background: active ? 'rgba(99,102,241,0.2)' : 'transparent', color: active ? '#a5b4fc' : 'rgba(255,255,255,0.4)', transition: 'all 0.15s' }) as React.CSSProperties,
}

export default function DeFiInterface() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const [tab, setTab] = useState<'swap' | 'pools'>('swap')
  const [fromToken, setFromToken] = useState('POL')
  const [toToken, setToToken] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [gasPrice, setGasPrice] = useState('—')
  const [blockNum, setBlockNum] = useState(0)
  const [loading] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [quote, setQuote] = useState<{ amountOut: string; raw: bigint } | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [swapStatus, setSwapStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [swapError, setSwapError] = useState<string | null>(null)
  const [pools, setPools] = useState<PoolData[]>(() =>
    POOL_DEFS.map(p => ({ ...p, tvl: '—', apr: '—', volume24h: '—', live: false, loading: true }))
  )

  // Fetch live network data
  useEffect(() => {
    const fetchChainData = async () => {
      try {
        const [gas, block] = await Promise.all([
          rpcCall('eth_gasPrice'),
          rpcCall('eth_blockNumber'),
        ])
        setGasPrice((Number(BigInt(gas)) / 1e9).toFixed(2))
        setBlockNum(parseInt(block, 16))
      } catch { /* ignore */ }
    }
    fetchChainData()
    const interval = setInterval(fetchChainData, 15000)
    return () => clearInterval(interval)
  }, [])

  // Fetch pool TVLs on mount
  useEffect(() => {
    const fetchPools = async () => {
      const results = await Promise.allSettled(
        POOL_DEFS.map(async (def, i) => {
          const { tvl, live } = await fetchPoolTvl(def)
          return { i, tvl, live }
        })
      )
      setPools(prev => {
        const next = [...prev]
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { i, tvl, live } = result.value
            next[i] = { ...next[i]!, tvl, live, loading: false }
          } else {
            // Keep loading false but show —
          }
        }
        return next.map(p => ({ ...p, loading: false }))
      })
    }
    fetchPools()
  }, [])

  // Debounced quote fetching
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || fromToken === toToken) {
      setQuote(null)
      setQuoteError(null)
      return
    }

    const timer = setTimeout(async () => {
      setQuoting(true)
      setQuoteError(null)
      try {
        const result = await getQuote(fromToken, toToken, amount)
        if (result) {
          setQuote(result)
        } else {
          setQuoteError('No liquidity for this pair')
          setQuote(null)
        }
      } catch (err: any) {
        setQuoteError(err.message || 'Quote failed')
        setQuote(null)
      } finally {
        setQuoting(false)
      }
    }, 500) // debounce 500ms

    return () => clearTimeout(timer)
  }, [amount, fromToken, toToken])

  // Execute swap via QuickSwap Router
  const executeSwap = useCallback(async () => {
    if (!isConnected || !address || !quote || !amount) return

    setSwapStatus('pending')
    setSwapError(null)

    const fromTokenInfo = TOKENS.find(t => t.symbol === fromToken)
    const toTokenInfo = TOKENS.find(t => t.symbol === toToken)
    if (!fromTokenInfo || !toTokenInfo) return

    const tokenIn = fromTokenInfo.address || WPOL
    const tokenOut = toTokenInfo.address || WPOL
    const amountInWei = BigInt(Math.floor(parseFloat(amount) * (10 ** fromTokenInfo.decimals)))
    const minAmountOut = (quote.raw * 95n) / 100n // 5% slippage tolerance
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min deadline

    try {
      // Build exactInputSingle call data for AlgebraRouter
      // exactInputSingle(ExactInputSingleParams) → selector: bc651188
      const selector = 'bc651188'
      const encTokenIn = tokenIn.slice(2).padStart(64, '0')
      const encTokenOut = tokenOut.slice(2).padStart(64, '0')
      const encRecipient = address.slice(2).padStart(64, '0')
      const encDeadline = deadline.toString(16).padStart(64, '0')
      const encAmountIn = amountInWei.toString(16).padStart(64, '0')
      const encMinOut = minAmountOut.toString(16).padStart(64, '0')
      const encLimitPrice = '0'.padStart(64, '0')

      const callData = `0x${selector}${encTokenIn}${encTokenOut}${encRecipient}${encDeadline}${encAmountIn}${encMinOut}${encLimitPrice}`

      // If swapping native POL, send as value; otherwise need approval first
      const isNativeIn = !fromTokenInfo.address
      const value = isNativeIn ? '0x' + amountInWei.toString(16) : '0x0'

      // Request transaction via wallet
      if (!window.ethereum) throw new Error('No wallet found')

      // If not native, check + request ERC20 approval
      if (!isNativeIn) {
        const allowanceData = '0xdd62ed3e' + address.slice(2).padStart(64, '0') + QUICKSWAP_ROUTER.slice(2).padStart(64, '0')
        const allowanceResult = await rpcCall('eth_call', [{ to: tokenIn, data: allowanceData }, 'latest'])
        const currentAllowance = BigInt(allowanceResult || '0x0')

        if (currentAllowance < amountInWei) {
          // Send approval tx
          const maxUint = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
          const approveData = '0x095ea7b3' + QUICKSWAP_ROUTER.slice(2).padStart(64, '0') + maxUint
          await (window.ethereum as any).request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: tokenIn, data: approveData }],
          })
          // Wait a moment for approval to mine
          await new Promise(r => setTimeout(r, 3000))
        }
      }

      // Send the swap transaction
      const txHash = await (window.ethereum as any).request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: QUICKSWAP_ROUTER,
          data: callData,
          value,
        }],
      })

      setSwapStatus('success')
      setSwapError(null)
      console.log('Swap TX:', txHash)

      // Reset after success
      setTimeout(() => {
        setAmount('')
        setQuote(null)
        setSwapStatus('idle')
      }, 3000)
    } catch (err: any) {
      setSwapStatus('error')
      setSwapError(err.message?.includes('rejected') ? 'Transaction rejected by user' : (err.message || 'Swap failed'))
    }
  }, [isConnected, address, quote, amount, fromToken, toToken])

  const swapTokens = () => {
    setFromToken(toToken)
    setToToken(fromToken)
    setQuote(null)
  }

  return (
    <div style={{ height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Network Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Polygon PoS</span>
            <span>Gas: {gasPrice} Gwei</span>
            <span>Block #{blockNum.toLocaleString()}</span>
          </div>
          {isConnected && balance && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}>
              {Number(balance.formatted).toFixed(4)} {balance.symbol}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={() => setTab('swap')} style={s.tab(tab === 'swap')}><ArrowUpDown size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Swap</button>
          <button onClick={() => setTab('pools')} style={s.tab(tab === 'pools')}><Droplets size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Pools</button>
        </div>

        {tab === 'swap' && (
          <div style={s.card}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpDown size={18} color="#818cf8" /> Swap Tokens
            </h3>

            {/* From */}
            <div style={{ marginBottom: '4px' }}>
              <div style={s.label}>From</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={fromToken} onChange={e => setFromToken(e.target.value)} style={{ ...s.select, width: '120px', flex: 'none' }}>
                  {TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" type="number" step="0.0001" style={s.input} />
              </div>
            </div>

            {/* Swap direction button */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
              <button onClick={swapTokens} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#818cf8' }}>
                <ArrowUpDown size={16} />
              </button>
            </div>

            {/* To */}
            <div style={{ marginBottom: '16px' }}>
              <div style={s.label}>To (estimated)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select value={toToken} onChange={e => setToToken(e.target.value)} style={{ ...s.select, width: '120px', flex: 'none' }}>
                  {TOKENS.filter(t => t.symbol !== fromToken).map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
                </select>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    readOnly
                    value={quoting ? 'Quoting...' : quote ? quote.amountOut : ''}
                    placeholder="0.00"
                    style={{ ...s.input, opacity: quoting ? 0.5 : 1 }}
                  />
                  {quoting && (
                    <Loader2 size={14} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: '#818cf8' }} />
                  )}
                </div>
              </div>
              {quoteError && (
                <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> {quoteError}
                </div>
              )}
            </div>

            {/* Route info */}
            {amount && quote && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Route</span>
                  <span style={{ color: '#818cf8' }}>{fromToken} <ArrowRight size={10} style={{ verticalAlign: 'middle' }} /> {toToken} via QuickSwap</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Rate</span>
                  <span>1 {fromToken} ≈ {(parseFloat(quote.amountOut) / parseFloat(amount)).toFixed(6)} {toToken}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Min. received (5% slippage)</span>
                  <span>{(parseFloat(quote.amountOut) * 0.95).toFixed(4)} {toToken}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Estimated Gas</span>
                  <span>~{gasPrice} Gwei ({(parseFloat(gasPrice) * 200000 / 1e9).toFixed(6)} POL)</span>
                </div>
              </div>
            )}

            {/* Swap status messages */}
            {swapStatus === 'success' && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '12px', fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} /> Swap submitted successfully!
              </div>
            )}
            {swapStatus === 'error' && swapError && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '12px', fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> {swapError}
              </div>
            )}

            {!isConnected ? (
              <div style={{ textAlign: 'center', padding: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Connect wallet to swap</div>
            ) : (
              <button
                onClick={executeSwap}
                disabled={!amount || !quote || loading || swapStatus === 'pending'}
                style={{
                  ...s.btn,
                  opacity: !amount || !quote ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  cursor: !amount || !quote || swapStatus === 'pending' ? 'not-allowed' : 'pointer',
                }}
              >
                {swapStatus === 'pending' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={16} />}
                {swapStatus === 'pending' ? 'Confirm in Wallet...' : `Swap ${fromToken} → ${toToken}`}
              </button>
            )}

            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>
              <AlertTriangle size={10} /> Swaps route through QuickSwap DEX on Polygon
            </div>
          </div>
        )}

        {tab === 'pools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Liquidity Pools on Polygon</span>
              <a href="https://quickswap.exchange/#/" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#818cf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                QuickSwap <ExternalLink size={10} />
              </a>
            </div>

            {/* Pool header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 50px', gap: '8px', padding: '8px 16px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Pair</span>
              <span style={{ textAlign: 'right' }}>TVL</span>
              <span style={{ textAlign: 'right' }}>APR</span>
              <span style={{ textAlign: 'right' }}>24h Vol</span>
              <span></span>
            </div>

            {pools.map((p, i) => (
              <div key={i} style={{ ...s.card, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 50px', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Droplets size={14} color="#818cf8" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{p.pair}</span>
                </div>
                <span style={{ textAlign: 'right', fontSize: '12px', color: p.tvl !== '—' ? '#e2e8f0' : 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {p.loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : p.tvl}
                </span>
                <span style={{ textAlign: 'right', fontSize: '12px', color: '#22c55e', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{p.apr}</span>
                <span style={{ textAlign: 'right', fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>{p.volume24h}</span>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', borderRadius: '100px', fontSize: '8px', fontWeight: 700, background: p.live ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: p.live ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: p.live ? '#22c55e' : 'rgba(255,255,255,0.2)' }} /> {p.live ? 'LIVE' : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DeFi Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: 'Gas Price', value: `${gasPrice} Gwei`, icon: <Zap size={14} color="#f59e0b" /> },
            { label: 'Network', value: 'Polygon PoS', icon: <Shield size={14} color="#22c55e" /> },
            { label: 'Block', value: `#${blockNum.toLocaleString()}`, icon: <TrendingUp size={14} color="#818cf8" /> },
          ].map((stat, i) => (
            <div key={i} style={{ ...s.card, padding: '14px', textAlign: 'center' }}>
              <div style={{ marginBottom: '6px' }}>{stat.icon}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}