import { useEffect, useRef, useState } from 'react'
import { useAccount, useSendTransaction } from 'wagmi'
import { toast } from 'sonner'
import { ShieldAlert, Check, X } from 'lucide-react'

interface DAppContainerProps {
    url: string
    name: string
}

export default function DAppContainer({ url, name }: DAppContainerProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const { address } = useAccount()
    const { sendTransactionAsync } = useSendTransaction()
    const [pendingRequest, setPendingRequest] = useState<any>(null)

    useEffect(() => {
        const handleMessage = async (e: MessageEvent) => {
            if (e.source !== iframeRef.current?.contentWindow) return
            const { method, params, id } = e.data
            if (!method) return

            if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
                iframeRef.current?.contentWindow?.postMessage({ id, result: [address] }, '*')
            } else if (method === 'eth_chainId') {
                iframeRef.current?.contentWindow?.postMessage({ id, result: '0x89' }, '*')
            } else if (method === 'eth_sendTransaction') {
                setPendingRequest({ id, params: params[0], e })
            } else {
                iframeRef.current?.contentWindow?.postMessage({ id, result: null }, '*')
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [address, name])

    const approveTransaction = async () => {
        if (!pendingRequest) return
        const { params, id } = pendingRequest
        try {
            const tx = await sendTransactionAsync({
                to: params.to,
                value: params.value ? BigInt(params.value) : undefined,
                data: params.data,
            })
            iframeRef.current?.contentWindow?.postMessage({ id, result: tx }, '*')
            toast.success('Transaction approved via SylOS Paymaster')
        } catch (err: any) {
            iframeRef.current?.contentWindow?.postMessage({ id, error: { message: err.message, code: 4001 } }, '*')
            toast.error('Transaction failed')
        }
        setPendingRequest(null)
    }

    const rejectTransaction = () => {
        if (!pendingRequest) return
        iframeRef.current?.contentWindow?.postMessage({ id: pendingRequest.id, error: { message: 'User rejected', code: 4001 } }, '*')
        toast.error('Transaction rejected')
        setPendingRequest(null)
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', background: '#0f1328' }}>
            {/* Sandbox banner */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '6px 16px', fontSize: '10px', fontWeight: 600,
                background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                borderBottom: '1px solid rgba(245,158,11,0.15)',
                fontFamily: "'Inter', system-ui, sans-serif",
            }}>
                <ShieldAlert size={12} /> Isolated SylOS hardware sandbox — Web3 bindings proxied
            </div>

            <iframe
                ref={iframeRef}
                src={url}
                style={{ flex: 1, width: '100%', border: 'none', background: '#0f1328' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                title={name}
            />

            {/* Transaction approval overlay */}
            {pendingRequest && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    fontFamily: "'Inter', system-ui, sans-serif",
                }}>
                    <div style={{
                        background: '#1a1f3d', borderRadius: '20px', maxWidth: '400px', width: '90%',
                        border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldAlert size={20} color="#f59e0b" />
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>Signature Request</h3>
                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0' }}>
                                    <strong>{name}</strong> wants to execute an on-chain transaction
                                </p>
                            </div>
                        </div>
                        <div style={{
                            padding: '12px 20px', background: 'rgba(0,0,0,0.2)',
                            fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.5)',
                            maxHeight: '160px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                            {JSON.stringify(pendingRequest.params, null, 2)}
                        </div>
                        <div style={{ padding: '16px 20px', display: 'flex', gap: '10px' }}>
                            <button onClick={rejectTransaction} style={{
                                flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
                                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}>
                                <X size={14} /> Reject
                            </button>
                            <button onClick={approveTransaction} style={{
                                flex: 1, padding: '10px', borderRadius: '12px', border: 'none',
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}>
                                <Check size={14} /> Authorize
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
