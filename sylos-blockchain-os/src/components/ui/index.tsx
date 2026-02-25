/**
 * SylOS Shared UI Components
 *
 * Skeleton loaders, empty states, toasts, and micro-interaction helpers.
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { colors, radius, font, transition, shadow } from './styles'
import { AlertCircle, CheckCircle, Info, XCircle, X, Inbox, Search } from 'lucide-react'

/* ═══════════════════════════════
   ═══ SKELETON LOADER  ═════════
   ═══════════════════════════════ */

export function Skeleton({ width, height = 16, radius: r = '6px', style }: {
  width?: string | number
  height?: string | number
  radius?: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      width: width || '100%',
      height,
      borderRadius: r,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{
      background: colors.bg.surface,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.lg,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Skeleton width={40} height={40} radius="10px" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={`${90 - i * 15}%`} height={12} />
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          background: colors.bg.surface,
          borderRadius: radius.md,
        }}>
          <Skeleton width={32} height={32} radius="8px" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width={`${50 + Math.random() * 30}%`} height={13} />
            <Skeleton width={`${30 + Math.random() * 20}%`} height={10} />
          </div>
          <Skeleton width={60} height={24} radius="6px" />
        </div>
      ))}
    </div>
  )
}

/* ═══════════════════════════════
   ═══ EMPTY STATE  ══════════════
   ═══════════════════════════════ */

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      gap: '12px',
    }}>
      {icon && (
        <div style={{
          width: '64px', height: '64px', borderRadius: '18px',
          background: colors.accent.indigoGlow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.accent.indigoLight,
          marginBottom: '4px',
        }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: colors.text.primary }}>{title}</div>
      {description && (
        <div style={{ fontSize: font.size.md, color: colors.text.muted, maxWidth: '280px', lineHeight: 1.5 }}>{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            borderRadius: radius.md,
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: '#fff',
            fontSize: font.size.md,
            fontWeight: font.weight.semibold,
            fontFamily: font.sans,
            cursor: 'pointer',
            transition: transition.normal,
            boxShadow: '0 2px 12px rgba(79,70,229,0.3)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function NoResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<Search size={28} />}
      title="No results found"
      description={`Nothing matches "${query}". Try a different search.`}
    />
  )
}

export function NoData({ noun = 'items' }: { noun?: string }) {
  return (
    <EmptyState
      icon={<Inbox size={28} />}
      title={`No ${noun} yet`}
      description={`${noun.charAt(0).toUpperCase() + noun.slice(1)} will appear here once created.`}
    />
  )
}

/* ═══════════════════════════════
   ═══ TOAST SYSTEM  ═════════════
   ═══════════════════════════════ */

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export function useToastSystem() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const toast: Toast = { ...t, id }
    setToasts(prev => [...prev, toast])
    const dur = t.duration || 4000
    const timer = setTimeout(() => removeToast(id), dur)
    timers.current.set(id, timer)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  const iconMap = {
    success: <CheckCircle size={16} />,
    error: <XCircle size={16} />,
    info: <Info size={16} />,
    warning: <AlertCircle size={16} />,
  }
  const colorMap = {
    success: colors.accent.emerald,
    error: colors.accent.rose,
    info: colors.accent.indigo,
    warning: colors.accent.amber,
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '68px',
      right: '16px',
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map((t, i) => (
        <ToastItem key={t.id} toast={t} icon={iconMap[t.type]} color={colorMap[t.type]} onDismiss={onDismiss} index={i} />
      ))}
    </div>
  )
}

function ToastItem({ toast, icon, color, onDismiss, index }: {
  toast: Toast
  icon: React.ReactNode
  color: string
  onDismiss: (id: string) => void
  index: number
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  return (
    <div style={{
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '12px 16px',
      borderRadius: radius.lg,
      background: 'rgba(12,16,36,0.95)',
      border: `1px solid ${color}30`,
      backdropFilter: 'blur(20px)',
      boxShadow: `${shadow.lg}, 0 0 20px ${color}15`,
      minWidth: '280px',
      maxWidth: '380px',
      fontFamily: font.sans,
      transform: visible ? 'translateX(0)' : 'translateX(100%)',
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      transitionDelay: `${index * 50}ms`,
    }}>
      <div style={{ color, flexShrink: 0, marginTop: '1px' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: font.size.base, fontWeight: font.weight.semibold, color: '#fff' }}>{toast.title}</div>
        {toast.message && <div style={{ fontSize: font.size.sm, color: colors.text.muted, marginTop: '2px', lineHeight: 1.4 }}>{toast.message}</div>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          color: colors.text.dim, flexShrink: 0, borderRadius: '4px',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════
   ═══ PROGRESS BAR  ═════════════
   ═══════════════════════════════ */

export function ProgressBar({ value, max = 100, color = colors.accent.indigo, height = 4 }: {
  value: number
  max?: number
  color?: string
  height?: number
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{
      width: '100%', height, borderRadius: height / 2,
      background: 'rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        borderRadius: height / 2,
        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: pct > 0 ? `0 0 8px ${color}40` : 'none',
      }} />
    </div>
  )
}

/* ═══════════════════════════════
   ═══ PULSE DOT  ════════════════
   ═══════════════════════════════ */

export function PulseDot({ color = colors.accent.emerald, size = 8 }: { color?: string; size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color,
      boxShadow: `0 0 ${size}px ${color}60`,
      animation: 'pulse 2s ease-in-out infinite',
    }} />
  )
}

/* ═══════════════════════════════
   ═══ TOOLTIP  ══════════════════
   ═══════════════════════════════ */

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const handleEnter = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    setShow(true)
  }

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {show && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -100%)',
          padding: '5px 10px',
          borderRadius: radius.sm,
          background: 'rgba(15,19,40,0.95)',
          border: `1px solid ${colors.border.strong}`,
          color: colors.text.secondary,
          fontSize: font.size.sm,
          fontFamily: font.sans,
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease',
          boxShadow: shadow.md,
        }}>
          {text}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════
   ═══ AVATAR  ═══════════════════
   ═══════════════════════════════ */

export function Avatar({ name, size = 32, color }: { name: string; size?: number; color?: string }) {
  const c = color || stringToColor(name)
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size > 40 ? '14px' : '10px',
      background: `linear-gradient(135deg, ${c}40, ${c}25)`,
      border: `1px solid ${c}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: font.weight.bold,
      color: c,
      flexShrink: 0,
      fontFamily: font.sans,
    }}>
      {initials}
    </div>
  )
}

function stringToColor(str: string): string {
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7', '#14b8a6']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]!
}

/* ═══════════════════════════════
   ═══ KBD (keyboard shortcut) ══
   ═══════════════════════════════ */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      padding: '2px 8px',
      borderRadius: radius.sm,
      background: colors.bg.surface,
      border: `1px solid ${colors.border.strong}`,
      color: colors.text.muted,
      fontSize: font.size.xs,
      fontFamily: font.mono,
    }}>
      {children}
    </kbd>
  )
}

/* ═══════════════════════════════
   ═══ STAT VALUE  ═══════════════
   ═══════════════════════════════ */

export function StatValue({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div style={{
      background: colors.bg.surface,
      border: `1px solid ${colors.border.default}`,
      borderRadius: radius.lg,
      padding: '16px',
    }}>
      <div style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: font.size.xxl, fontWeight: font.weight.bold, color: color || '#fff', fontFamily: font.mono }}>{value}</div>
      {sub && <div style={{ fontSize: font.size.sm, color: colors.text.muted, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}
