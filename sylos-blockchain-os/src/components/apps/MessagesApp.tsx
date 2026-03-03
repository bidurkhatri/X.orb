import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, Plus, Loader2, Key } from 'lucide-react'
import { Client } from '@xmtp/xmtp-js'
import { useAccount } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { toast } from 'sonner'

const cs = {
    page: { height: '100%', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
}

export default function MessagesApp() {
    const { address, isConnected } = useAccount()
    const [client, setClient] = useState<Client | null>(null)
    const [conversations, setConversations] = useState<any[]>([])
    const [activeConvo, setActiveConvo] = useState<any | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [isInit, setIsInit] = useState(false)
    const [newMsg, setNewMsg] = useState('')
    const [newAddr, setNewAddr] = useState('')
    const [showNew, setShowNew] = useState(false)
    const endRef = useRef<HTMLDivElement>(null)

    const initXmtp = async () => {
        if (!window.ethereum || !address) return
        setIsInit(true)
        try {
            const provider = new BrowserProvider(window.ethereum as any)
            const signer = await provider.getSigner()
            const xmtp = await Client.create(signer as any, { env: 'dev' })
            setClient(xmtp)
            const convos = await xmtp.conversations.list()
            setConversations(convos)
            toast.success('Void Chat Connected')
        } catch (err: any) {
            toast.error(`XMTP failed: ${err.message}`)
        } finally {
            setIsInit(false)
        }
    }

    const loadMessages = async (c: any) => {
        const msgs = await c.messages()
        setMessages(msgs)
        setActiveConvo(c)
    }

    const handleSendMsg = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeConvo || !newMsg.trim()) return
        try {
            const sent = await activeConvo.send(newMsg)
            setMessages(p => [...p, sent])
            setNewMsg('')
        } catch { toast.error('Failed to send') }
    }

    const startNew = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!client || !newAddr) return
        try {
            if (!(await client.canMessage(newAddr))) { toast.error('Address not on XMTP'); return }
            const c = await client.conversations.newConversation(newAddr)
            setConversations(p => [c, ...p.filter(x => x.peerAddress !== newAddr)])
            loadMessages(c)
            setShowNew(false)
            setNewAddr('')
        } catch (err: any) { toast.error(err.message) }
    }

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

    // Not connected
    if (!isConnected) {
        return (
            <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' }}>
                <MessageCircle size={48} color="rgba(255,255,255,0.15)" />
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Wallet Disconnected</h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: '300px' }}>Connect your wallet to access XMTP encrypted messaging</p>
            </div>
        )
    }

    // XMTP not initialized
    if (!client) {
        return (
            <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', textAlign: 'center' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={32} color="#818cf8" />
                </div>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>Void Chat</h2>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: '360px' }}>Enable end-to-end encrypted wallet-to-wallet messaging via XMTP</p>
                </div>
                <button onClick={initXmtp} disabled={isInit} style={{
                    padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: isInit ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '14px', fontWeight: 600,
                    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', opacity: isInit ? 0.5 : 1,
                }}>
                    {isInit ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Key size={16} />}
                    {isInit ? 'Provisioning Keys...' : 'Enable Void Chat'}
                </button>
            </div>
        )
    }

    // Chat view
    return (
        <div style={{ ...cs.page, display: 'flex', height: '100%' }}>
            {/* Sidebar */}
            <div style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Conversations</span>
                    <button onClick={() => setShowNew(!showNew)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
                        <Plus size={14} />
                    </button>
                </div>
                {showNew && (
                    <form onSubmit={startNew} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="0x..." style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const }} />
                        <button type="submit" style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Start Chat</button>
                    </form>
                )}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {conversations.length === 0 && <div style={{ padding: '24px 16px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>No conversations yet</div>}
                    {conversations.map((c, i) => (
                        <button key={i} onClick={() => loadMessages(c)} style={{
                            width: '100%', textAlign: 'left' as const, padding: '12px 16px', border: 'none', cursor: 'pointer',
                            background: activeConvo?.peerAddress === c.peerAddress ? 'rgba(99,102,241,0.1)' : 'transparent',
                            borderLeft: activeConvo?.peerAddress === c.peerAddress ? '3px solid #6366f1' : '3px solid transparent',
                            display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit', transition: 'background 0.15s',
                        }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                                {c.peerAddress.substring(2, 4).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.peerAddress.substring(0, 6)}...{c.peerAddress.substring(38)}
                                </div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>E2E Encrypted</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {activeConvo ? (
                    <>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                                {activeConvo.peerAddress.substring(2, 4).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{activeConvo.peerAddress}</div>
                                <div style={{ fontSize: '10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} /> XMTP Secured
                                </div>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                            {messages.map((m, i) => {
                                const isMe = m.senderAddress === address
                                return (
                                    <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                                        <div style={{
                                            maxWidth: '70%', padding: '10px 16px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                            background: isMe ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.06)',
                                            color: isMe ? '#fff' : '#e2e8f0', fontSize: '13px', lineHeight: 1.5,
                                        }}>
                                            <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                                            <span style={{ fontSize: '9px', color: isMe ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)', display: 'block', marginTop: '4px' }}>
                                                {new Date(m.sent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={endRef} />
                        </div>
                        <form onSubmit={handleSendMsg} style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
                            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type a message..." style={{
                                flex: 1, padding: '10px 16px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                            }} />
                            <button type="submit" disabled={!newMsg.trim()} style={{
                                width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                                background: !newMsg.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Send size={16} />
                            </button>
                        </form>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <MessageCircle size={24} color="rgba(255,255,255,0.15)" />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: 0 }}>No conversation selected</h3>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>Select a chat or start a new one</p>
                    </div>
                )}
            </div>
        </div>
    )
}
