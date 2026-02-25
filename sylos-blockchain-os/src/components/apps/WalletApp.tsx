import { useState, useCallback, useEffect } from 'react'
import { Wallet, Copy, Send, QrCode, ExternalLink, Check, ArrowUpRight, ArrowDownLeft, Loader2, RefreshCw } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance, useSendTransaction, useDisconnect, useReadContracts } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { CONTRACTS } from '../../config/contracts'

const SYLOS_ADDRESS = CONTRACTS.SYLOS_TOKEN
const WSYLOS_ADDRESS = CONTRACTS.WSYLOS_TOKEN

const ERC20_ABI = [
  { inputs: [{ name: '', type: 'address' }], name: 'balanceOf', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const

const cs = {
  page: { height: '100%', padding: '20px', background: '#0f1328', overflow: 'auto', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
  input: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

interface Tx { hash: string; from: string; to: string; value: string; timeStamp: string; isError: string; functionName: string; gasUsed: string; gasPrice: string }

export default function WalletApp() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: bal } = useBalance({ address })
  const { sendTransaction, isPending } = useSendTransaction()
  const [copied, setCopied] = useState(false)
  const [amt, setAmt] = useState('')
  const [to, setTo] = useState('')
  const [txs, setTxs] = useState<Tx[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)

  // Read SylOS token balances
  const { data: tokenBals } = useReadContracts({
    contracts: address ? [
      { address: SYLOS_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
      { address: WSYLOS_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] },
    ] : [],
    query: { enabled: !!address },
  })

  const sylosBal = tokenBals?.[0]?.result ? Number(formatEther(tokenBals[0].result as bigint)) : 0
  const wSylosBal = tokenBals?.[1]?.result ? Number(formatEther(tokenBals[1].result as bigint)) : 0

  useEffect(() => { if (copied) { const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t) } }, [copied])

  // Fetch real tx history from Polygonscan
  const fetchTxHistory = useCallback(async () => {
    if (!address) return
    setLoadingTxs(true)
    try {
      const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] || ''
      const supabaseKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] || ''
      const res = await fetch(`${supabaseUrl}/functions/v1/api-proxy?action=tx-history&address=${address}`, {
        headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey },
      })
      const data = await res.json()
      if (data.status === '1' && Array.isArray(data.result)) {
        setTxs(data.result)
      }
    } catch { /* API may rate limit - that's ok */ }
    setLoadingTxs(false)
  }, [address])

  useEffect(() => { fetchTxHistory() }, [fetchTxHistory])

  const copyAddr = useCallback(async () => {
    if (address) { await navigator.clipboard.writeText(address); setCopied(true) }
  }, [address])

  const handleSend = useCallback(() => {
    if (!to || !amt) return
    sendTransaction({ to: to as `0x${string}`, value: parseEther(amt) }, {
      onSuccess: () => { setAmt(''); setTo(''); setTimeout(fetchTxHistory, 3000) },
    })
  }, [to, amt, sendTransaction, fetchTxHistory])

  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={36} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Wallet</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Connect to manage POL, SYLOS & wSYLOS on Polygon</p>
        </div>
        <ConnectButton />
      </div>
    )
  }

  return (
    <div style={cs.page}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Balance */}
        <div style={{ ...cs.card, background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.15))', borderColor: 'rgba(99,102,241,0.2)' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Balance</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '10px', fontFamily: "'JetBrains Mono', monospace" }}>
            {bal ? Number(bal.formatted).toFixed(4) : '0.0000'} <span style={{ fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>{bal?.symbol || 'POL'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ flex: 1, fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</span>
            <button onClick={copyAddr} aria-label="Copy wallet address" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
              {copied ? <><Check size={10} /> <span aria-live="polite">Copied</span></> : <><Copy size={10} /> Copy</>}
            </button>
            <a href={`https://polygonscan.com/address/${address}`} target="_blank" rel="noreferrer" aria-label="View on Polygonscan" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', fontSize: '10px', textDecoration: 'none' }}>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* SylOS Token Balances */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={cs.card}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>SYLOS</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#818cf8', fontFamily: "'JetBrains Mono', monospace" }}>{sylosBal.toFixed(2)}</div>
          </div>
          <div style={cs.card}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginBottom: '4px' }}>wSYLOS</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#a78bfa', fontFamily: "'JetBrains Mono', monospace" }}>{wSylosBal.toFixed(2)}</div>
          </div>
        </div>

        {/* Send */}
        <div style={cs.card}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
            <Send size={14} color="#818cf8" /> Send POL
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="Recipient address (0x...)" aria-label="Recipient address" style={cs.input} />
            <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Amount (POL)" step="0.0001" min="0" aria-label="Amount in POL" style={cs.input} />
            <button onClick={handleSend} disabled={isPending || !to || !amt} aria-label="Send POL" style={{
              width: '100%', padding: '11px', borderRadius: '10px', border: 'none', cursor: isPending || !to || !amt ? 'not-allowed' : 'pointer',
              background: to && amt ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.04)',
              color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', opacity: !to || !amt ? 0.4 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              {isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Send size={14} /> Send {amt || '0'} POL</>}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button onClick={copyAddr} style={{ ...cs.card, cursor: 'pointer', textAlign: 'left' as const, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode size={18} color="#818cf8" />
            <div><div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Receive</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Copy address</div></div>
          </button>
          <button onClick={() => disconnect()} style={{ ...cs.card, cursor: 'pointer', textAlign: 'left' as const, borderColor: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ExternalLink size={18} color="#ef4444" />
            <div><div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>Disconnect</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>End session</div></div>
          </button>
        </div>

        {/* Tx History */}
        <div style={cs.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: '#fff' }}>Transaction History</h3>
            <button onClick={fetchTxHistory} disabled={loadingTxs} aria-label="Refresh transaction history" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', padding: 0 }}>
              <RefreshCw size={12} style={{ animation: loadingTxs ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
          {txs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.15)', fontSize: '12px' }}>
              {loadingTxs ? 'Loading transactions from Polygonscan...' : 'No transactions found'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {txs.slice(0, 15).map(tx => {
                const isSent = tx.from.toLowerCase() === address?.toLowerCase()
                const val = Number(formatEther(BigInt(tx.value)))
                const date = new Date(Number(tx.timeStamp) * 1000)
                const failed = tx.isError === '1'
                return (
                  <a key={tx.hash} href={`https://polygonscan.com/tx/${tx.hash}`} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', textDecoration: 'none', transition: 'background 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: failed ? 'rgba(239,68,68,0.1)' : isSent ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)'
                      }}>
                        {failed ? <ExternalLink size={12} color="#ef4444" /> : isSent ? <ArrowUpRight size={12} color="#ef4444" /> : <ArrowDownLeft size={12} color="#22c55e" />}
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: '#fff' }}>
                          {failed ? 'Failed' : isSent ? 'Sent' : 'Received'}
                          {tx.functionName && <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: '4px' }}>· {tx.functionName.split('(')[0]}</span>}
                        </div>
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: isSent ? '#ef4444' : '#22c55e', fontFamily: "'JetBrains Mono', monospace" }}>
                        {isSent ? '-' : '+'}{val > 0.0001 ? val.toFixed(4) : '<0.0001'} POL
                      </div>
                      <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.1)' }}>
                        {tx.hash.slice(0, 8)}...{tx.hash.slice(-4)}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
