/**
 * MessagesApp — Void Chat (XMTP V3 Browser SDK)
 *
 * End-to-end encrypted wallet-to-wallet messaging via XMTP V3.
 * Uses @xmtp/browser-sdk (V3) with inbox-based identity, DM conversations,
 * real-time message streaming, and client persistence across mounts.
 *
 * Features:
 * - Create DMs by Ethereum address (resolved to inbox ID)
 * - Real-time message streaming (no polling)
 * - Client persists in module scope (survives unmount/remount)
 * - Proper error handling and loading states
 * - Message timestamps with sender identification
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageCircle, Send, Plus, Loader2, Key, RefreshCw, X, AlertTriangle } from 'lucide-react'
import { Client, ConsentState, IdentifierKind } from '@xmtp/browser-sdk'
import type { Signer, Identifier } from '@xmtp/browser-sdk'
import type { Dm } from '@xmtp/browser-sdk'
import type { DecodedMessage } from '@xmtp/browser-sdk'
import { useAccount, useWalletClient } from 'wagmi'
import { toast } from 'sonner'

/* ─── Styles ─── */
const cs = {
  page: { height: '100%', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' } as React.CSSProperties,
  input: { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
}

/* ─── Module-scoped XMTP client (persists across mounts) ─── */
let cachedClient: Client | null = null
let cachedAddress: string | null = null

/* ─── Types ─── */
interface ChatConversation {
  id: string
  dm: Dm
  peerInboxId: string
  peerAddress: string // display address (may be truncated)
  lastMessage?: string
  lastMessageAt?: number
}

interface ChatMessage {
  id: string
  content: string
  senderInboxId: string
  sentAt: Date
  isMe: boolean
}

/* ─── Signer adapter: wagmi walletClient → XMTP V3 Signer ─── */
function createXmtpSigner(walletClient: any, address: string): Signer {
  return {
    type: 'EOA' as const,
    getIdentifier: (): Identifier => ({
      identifier: address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const signature = await walletClient.signMessage({ message })
      // Convert hex signature to Uint8Array
      const hex = signature.startsWith('0x') ? signature.slice(2) : signature
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      }
      return bytes
    },
  }
}

/* ─── Truncate address for display ─── */
function truncAddr(addr: string): string {
  if (addr.length <= 13) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/* ─── Format time ─── */
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ─── Validate Ethereum address ─── */
function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export default function MessagesApp() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [client, setClient] = useState<Client | null>(cachedClient)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isInit, setIsInit] = useState(false)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [newAddr, setNewAddr] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<{ unsubscribe?: () => void }>({})
  const msgStreamRef = useRef<{ unsubscribe?: () => void }>({})

  const activeConvo = conversations.find(c => c.id === activeConvoId) || null

  /* ─── Initialize XMTP V3 Client ─── */
  const initXmtp = useCallback(async () => {
    if (!walletClient || !address) {
      toast.error('Wallet not ready')
      return
    }
    setIsInit(true)
    setError(null)
    try {
      // Reuse cached client if same address
      if (cachedClient && cachedAddress === address) {
        setClient(cachedClient)
        toast.success('Void Chat Connected')
        return
      }

      const signer = createXmtpSigner(walletClient, address)
      const xmtp = await Client.create(signer, {})
      cachedClient = xmtp
      cachedAddress = address
      setClient(xmtp)
      toast.success('Void Chat Connected')
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      setError(msg)
      toast.error(`XMTP failed: ${msg}`)
    } finally {
      setIsInit(false)
    }
  }, [walletClient, address])

  /* ─── Load conversations ─── */
  const loadConversations = useCallback(async () => {
    if (!client) return
    try {
      await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown])
      const convos = await client.conversations.list({
        consentStates: [ConsentState.Allowed, ConsentState.Unknown],
      })

      const chatConvos: ChatConversation[] = []
      for (const convo of convos) {
        // Only handle DMs
        if (!('peerInboxId' in convo)) continue
        const dm = convo as Dm
        try {
          const peerInboxId = await dm.peerInboxId()
          chatConvos.push({
            id: dm.id,
            dm,
            peerInboxId,
            peerAddress: truncAddr(peerInboxId),
          })
        } catch {
          // Skip conversations we can't resolve
        }
      }
      setConversations(chatConvos)
    } catch (err: any) {
      console.warn('[VoidChat] Failed to load conversations:', err)
    }
  }, [client])

  /* ─── Load conversations on client ready ─── */
  useEffect(() => {
    if (client) loadConversations()
  }, [client, loadConversations])

  /* ─── Stream all DM messages (global) ─── */
  useEffect(() => {
    if (!client) return

    let cancelled = false

    const startStream = async () => {
      try {
        const stream = await client.conversations.streamAllDmMessages({
          consentStates: [ConsentState.Allowed, ConsentState.Unknown],
        })

        streamRef.current.unsubscribe = () => {
          cancelled = true
          stream.return?.()
        }

        for await (const message of stream) {
          if (cancelled) break
          const decoded = message as DecodedMessage
          const content = typeof decoded.content === 'string' ? decoded.content : ''
          if (!content) continue

          // Update messages if this conversation is active
          setMessages(prev => {
            if (prev.some(m => m.id === decoded.id)) return prev
            return [...prev, {
              id: decoded.id,
              content,
              senderInboxId: decoded.senderInboxId,
              sentAt: decoded.sentAt,
              isMe: decoded.senderInboxId === (client as any).inboxId,
            }]
          })

          // Update last message in conversation list
          setConversations(prev => prev.map(c =>
            c.id === decoded.conversationId
              ? { ...c, lastMessage: content.slice(0, 50), lastMessageAt: Date.now() }
              : c
          ))
        }
      } catch (err) {
        if (!cancelled) console.warn('[VoidChat] Stream error:', err)
      }
    }

    startStream()
    return () => { streamRef.current.unsubscribe?.() }
  }, [client])

  /* ─── Load messages for active conversation ─── */
  const loadMessages = useCallback(async (convo: ChatConversation) => {
    setActiveConvoId(convo.id)
    setIsLoadingMsgs(true)
    setMessages([])
    try {
      await convo.dm.sync()
      const msgs = await convo.dm.messages()
      const inboxId = (client as any)?.inboxId || ''
      const chatMsgs: ChatMessage[] = msgs
        .filter((m: DecodedMessage) => typeof m.content === 'string' && m.content)
        .map((m: DecodedMessage) => ({
          id: m.id,
          content: m.content as string,
          senderInboxId: m.senderInboxId,
          sentAt: m.sentAt,
          isMe: m.senderInboxId === inboxId,
        }))
      setMessages(chatMsgs)
    } catch (err: any) {
      toast.error('Failed to load messages')
      console.warn('[VoidChat] Failed to load messages:', err)
    } finally {
      setIsLoadingMsgs(false)
    }
  }, [client])

  /* ─── Send message ─── */
  const handleSendMsg = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeConvo || !newMsg.trim()) return
    const text = newMsg.trim()
    setNewMsg('')

    // Optimistic update
    const optimisticId = `opt_${crypto.randomUUID()}`
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      content: text,
      senderInboxId: 'me',
      sentAt: new Date(),
      isMe: true,
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      await activeConvo.dm.sendText(text)
    } catch (err: any) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      toast.error(`Failed to send: ${err?.message || 'Unknown error'}`)
    }
  }, [activeConvo, newMsg])

  /* ─── Start new DM ─── */
  const startNewDm = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client || !newAddr.trim()) return

    const addr = newAddr.trim()
    if (!isValidAddress(addr)) {
      toast.error('Invalid Ethereum address')
      return
    }
    if (addr.toLowerCase() === address?.toLowerCase()) {
      toast.error('Cannot message yourself')
      return
    }

    try {
      // Check if address can be messaged
      const identifier: Identifier = { identifier: addr, identifierKind: IdentifierKind.Ethereum }
      const canMessageResult = await client.canMessage([identifier])
      const canMsg = canMessageResult.get(addr.toLowerCase())
      if (!canMsg) {
        toast.error('Address is not on XMTP. They need to enable XMTP first.')
        return
      }

      // Resolve inbox ID
      const inboxId = await client.fetchInboxIdByIdentifier(identifier)
      if (!inboxId) {
        toast.error('Could not resolve inbox ID for this address')
        return
      }

      // Create DM
      const dm = await client.conversations.createDm(inboxId)

      const newConvo: ChatConversation = {
        id: dm.id,
        dm,
        peerInboxId: inboxId,
        peerAddress: truncAddr(addr),
      }

      setConversations(prev => {
        // Avoid duplicates
        if (prev.some(c => c.peerInboxId === inboxId)) {
          const existing = prev.find(c => c.peerInboxId === inboxId)!
          loadMessages(existing)
          return prev
        }
        return [newConvo, ...prev]
      })

      loadMessages(newConvo)
      setShowNew(false)
      setNewAddr('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create conversation')
    }
  }, [client, newAddr, address, loadMessages])

  /* ─── Auto-scroll on new messages ─── */
  useEffect(() => {
    if (messages.length > 0) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  /* ─── Cleanup streams on unmount ─── */
  useEffect(() => {
    return () => {
      streamRef.current.unsubscribe?.()
      msgStreamRef.current.unsubscribe?.()
    }
  }, [])

  /* ─── RENDER: Wallet not connected ─── */
  if (!isConnected) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', textAlign: 'center' }}>
        <MessageCircle size={48} color="rgba(255,255,255,0.15)" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Wallet Disconnected</h2>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: '300px' }}>
          Connect your wallet to access XMTP encrypted messaging
        </p>
      </div>
    )
  }

  /* ─── RENDER: XMTP not initialized ─── */
  if (!client) {
    return (
      <div style={{ ...cs.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MessageCircle size={32} color="#818cf8" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>Void Chat</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', margin: 0, maxWidth: '360px' }}>
            End-to-end encrypted wallet-to-wallet messaging via XMTP V3
          </p>
        </div>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', maxWidth: '400px' }}>
            <AlertTriangle size={14} color="#ef4444" />
            <span style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>{error}</span>
          </div>
        )}
        <button onClick={initXmtp} disabled={isInit || !walletClient} style={{
          padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: isInit || !walletClient ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', fontSize: '14px', fontWeight: 600,
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', opacity: isInit || !walletClient ? 0.5 : 1,
        }}>
          {isInit ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Key size={16} />}
          {isInit ? 'Provisioning Keys...' : 'Enable Void Chat'}
        </button>
        {!walletClient && (
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>
            Waiting for wallet connection...
          </p>
        )}
      </div>
    )
  }

  /* ─── RENDER: Chat interface ─── */
  return (
    <div style={{ ...cs.page, display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Conversations</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={loadConversations} title="Refresh" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
              <RefreshCw size={12} />
            </button>
            <button onClick={() => setShowNew(!showNew)} title="New conversation" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}>
              {showNew ? <X size={14} /> : <Plus size={14} />}
            </button>
          </div>
        </div>

        {/* New conversation form */}
        {showNew && (
          <form onSubmit={startNewDm} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={newAddr}
              onChange={e => setNewAddr(e.target.value)}
              placeholder="0x... (Ethereum address)"
              style={cs.input}
            />
            <button
              type="submit"
              disabled={!newAddr.trim() || !isValidAddress(newAddr.trim())}
              style={{
                width: '100%', marginTop: '8px', padding: '8px', borderRadius: '8px', border: 'none',
                background: isValidAddress(newAddr.trim()) ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isValidAddress(newAddr.trim()) ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', opacity: isValidAddress(newAddr.trim()) ? 1 : 0.4,
              }}
            >
              Start Chat
            </button>
          </form>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: '24px 16px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
              No conversations yet
            </div>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => loadMessages(c)}
              style={{
                width: '100%', textAlign: 'left' as const, padding: '12px 16px', border: 'none', cursor: 'pointer',
                background: activeConvoId === c.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderLeft: activeConvoId === c.id ? '3px solid #6366f1' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit', transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0,
              }}>
                {c.peerAddress.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, color: '#fff',
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.peerAddress}
                </div>
                {c.lastMessage ? (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lastMessage}
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>E2E Encrypted</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConvo ? (
          <>
            {/* Chat header */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '11px', fontWeight: 700,
              }}>
                {activeConvo.peerAddress.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>
                  {activeConvo.peerAddress}
                </div>
                <div style={{ fontSize: '10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} />
                  XMTP V3 Secured
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {isLoadingMsgs && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px' }}>
                  <Loader2 size={16} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Loading messages...</span>
                </div>
              )}
              {!isLoadingMsgs && messages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '8px' }}>
                  <MessageCircle size={20} color="rgba(255,255,255,0.1)" />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>No messages yet. Say hello!</span>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.isMe ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                  <div style={{
                    maxWidth: '70%', padding: '10px 16px',
                    borderRadius: m.isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.isMe ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'rgba(255,255,255,0.06)',
                    color: m.isMe ? '#fff' : '#e2e8f0', fontSize: '13px', lineHeight: 1.5,
                  }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                    <span style={{
                      fontSize: '9px',
                      color: m.isMe ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                      display: 'block', marginTop: '4px',
                    }}>
                      {formatTime(m.sentAt)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Send form */}
            <form onSubmit={handleSendMsg} style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Type a message..."
                maxLength={10000}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: '100px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: '#e2e8f0',
                  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!newMsg.trim()}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: newMsg.trim() ? 'pointer' : 'default',
                  background: !newMsg.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
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
