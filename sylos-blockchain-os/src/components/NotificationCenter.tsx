import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Bell, X, Check, CheckCheck, Trash2, Clock, Shield, Coins, Activity, Bot,
    Wallet, ArrowUpDown, MessageCircle, Info
} from 'lucide-react'

export interface SystemNotification {
    id: string
    title: string
    message: string
    type: 'info' | 'success' | 'warning' | 'error' | 'transaction'
    timestamp: number
    read: boolean
    icon?: React.ReactNode
    action?: string
}

const NOTIF_KEY = 'sylos_notifications'

function loadNotifs(): SystemNotification[] {
    try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]') } catch { return [] }
}
function saveNotifs(n: SystemNotification[]) { localStorage.setItem(NOTIF_KEY, JSON.stringify(n)) }

// Seed initial demo notifications if none exist
function seedNotifications(): SystemNotification[] {
    const now = Date.now()
    return [
        { id: 'n1', title: 'Welcome to SylOS', message: 'Your blockchain operating system is ready. Connect your wallet to get started.', type: 'info', timestamp: now - 5000, read: false },
        { id: 'n2', title: 'Polygon Network', message: 'Connected to Polygon PoS mainnet (Chain ID 137). RPC endpoint active.', type: 'success', timestamp: now - 60000, read: false },
        { id: 'n3', title: 'SylBot AI Agent', message: 'Configure your AI provider in the Agent app to enable autonomous blockchain queries.', type: 'info', timestamp: now - 120000, read: false },
        { id: 'n4', title: 'Gas Price Alert', message: 'Average gas on Polygon is 35 Gwei — optimal for transactions.', type: 'info', timestamp: now - 300000, read: true },
        { id: 'n5', title: 'XMTP Protocol', message: 'Decentralized messaging available. Connect wallet to send and receive encrypted messages.', type: 'info', timestamp: now - 600000, read: true },
        { id: 'n6', title: 'System Update', message: 'SylOS v1.0.0-alpha loaded. New features: AI Agents, Spotlight Search, Lock Screen.', type: 'success', timestamp: now - 900000, read: true },
    ]
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
        const saved = loadNotifs()
        return saved.length > 0 ? saved : seedNotifications()
    })

    useEffect(() => { saveNotifs(notifications) }, [notifications])

    const addNotification = useCallback((n: Omit<SystemNotification, 'id' | 'timestamp' | 'read'>) => {
        const notif: SystemNotification = { ...n, id: `n_${Date.now()}`, timestamp: Date.now(), read: false }
        setNotifications(p => [notif, ...p])
    }, [])

    const markRead = useCallback((id: string) => {
        setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n))
    }, [])

    const markAllRead = useCallback(() => {
        setNotifications(p => p.map(n => ({ ...n, read: true })))
    }, [])

    const clearAll = useCallback(() => {
        setNotifications([])
    }, [])

    const dismissNotification = useCallback((id: string) => {
        setNotifications(p => p.filter(n => n.id !== id))
    }, [])

    return { notifications, addNotification, markRead, markAllRead, clearAll, dismissNotification }
}

// Notification panel component
export default function NotificationCenter({ notifications, onMarkRead, onMarkAllRead, onClear, onDismiss, onClose }: {
    notifications: SystemNotification[]
    onMarkRead: (id: string) => void
    onMarkAllRead: () => void
    onClear: () => void
    onDismiss: (id: string) => void
    onClose: () => void
}) {
    const ref = useRef<HTMLDivElement>(null)
    const unread = notifications.filter(n => !n.read).length

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [onClose])

    const typeColors: Record<string, string> = {
        info: '#6366f1', success: '#22c55e', warning: '#f59e0b', error: '#ef4444', transaction: '#8b5cf6',
    }

    const typeIcons: Record<string, React.ReactNode> = {
        info: <Info size={14} />,
        success: <Check size={14} />,
        warning: <Shield size={14} />,
        error: <X size={14} />,
        transaction: <ArrowUpDown size={14} />,
    }

    const timeAgo = (ts: number) => {
        const s = Math.floor((Date.now() - ts) / 1000)
        if (s < 60) return 'Just now'
        if (s < 3600) return `${Math.floor(s / 60)}m ago`
        if (s < 86400) return `${Math.floor(s / 3600)}h ago`
        return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
    }

    return (
        <div ref={ref} style={{
            position: 'absolute', bottom: '58px', right: '60px', width: '360px', maxHeight: '500px',
            background: 'rgba(12, 15, 35, 0.98)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px', backdropFilter: 'blur(40px)', overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)',
            fontFamily: "'Inter', system-ui, sans-serif", zIndex: 60,
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bell size={16} color="#818cf8" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Notifications</span>
                    {unread > 0 && (
                        <span style={{ padding: '1px 7px', borderRadius: '100px', background: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700 }}>{unread}</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {unread > 0 && (
                        <button onClick={onMarkAllRead} title="Mark all read" style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCheck size={12} /> Read all
                        </button>
                    )}
                    <button onClick={onClear} title="Clear all" style={{ background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Notifications list */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px' }}>
                {notifications.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.15)' }}>
                        <Bell size={28} style={{ marginBottom: '8px', opacity: 0.3 }} />
                        <div style={{ fontSize: '13px' }}>No notifications</div>
                    </div>
                )}
                {notifications.map(n => (
                    <div key={n.id} onClick={() => onMarkRead(n.id)} style={{
                        display: 'flex', gap: '10px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: n.read ? 'transparent' : 'rgba(99,102,241,0.04)', cursor: 'pointer', transition: 'background 0.1s',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(99,102,241,0.04)')}
                    >
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${typeColors[n.type]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: typeColors[n.type], flexShrink: 0, marginTop: '2px' }}>
                            {typeIcons[n.type]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: n.read ? 'rgba(255,255,255,0.6)' : '#fff' }}>{n.title}</span>
                                {!n.read && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.15)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={8} /> {timeAgo(n.timestamp)}
                            </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); onDismiss(n.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(255,255,255,0.15)', flexShrink: 0, borderRadius: '4px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.15)')}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
