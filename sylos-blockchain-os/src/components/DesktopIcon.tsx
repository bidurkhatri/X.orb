import { useState, useMemo } from 'react'

interface DesktopIconProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  appId: string
  description?: string
}

/* ─── Per-app color mapping so every icon feels unique ─── */
const APP_COLORS: Record<string, { from: string; to: string; glow: string; icon: string }> = {
  'wallet': { from: '#4f46e5', to: '#7c3aed', glow: 'rgba(99,102,241,0.35)', icon: '#a5b4fc' },
  'pop-tracker': { from: '#7c3aed', to: '#a855f7', glow: 'rgba(139,92,246,0.35)', icon: '#c4b5fd' },
  'files': { from: '#0ea5e9', to: '#2563eb', glow: 'rgba(14,165,233,0.35)', icon: '#7dd3fc' },
  'messages': { from: '#06b6d4', to: '#0891b2', glow: 'rgba(6,182,212,0.35)', icon: '#67e8f9' },
  'ai-agents': { from: '#8b5cf6', to: '#ec4899', glow: 'rgba(139,92,246,0.35)', icon: '#c4b5fd' },
  'tokens': { from: '#f59e0b', to: '#ea580c', glow: 'rgba(245,158,11,0.35)', icon: '#fcd34d' },
  'defi': { from: '#10b981', to: '#059669', glow: 'rgba(16,185,129,0.35)', icon: '#6ee7b7' },
  'bridge': { from: '#3b82f6', to: '#1d4ed8', glow: 'rgba(59,130,246,0.35)', icon: '#93c5fd' },
  'staking': { from: '#f97316', to: '#dc2626', glow: 'rgba(249,115,22,0.35)', icon: '#fdba74' },
  'governance': { from: '#6366f1', to: '#4f46e5', glow: 'rgba(99,102,241,0.35)', icon: '#a5b4fc' },
  'identity': { from: '#a855f7', to: '#7c3aed', glow: 'rgba(168,85,247,0.35)', icon: '#d8b4fe' },
  'nft': { from: '#ec4899', to: '#be185d', glow: 'rgba(236,72,153,0.35)', icon: '#f9a8d4' },
  'dashboard': { from: '#14b8a6', to: '#0d9488', glow: 'rgba(20,184,166,0.35)', icon: '#5eead4' },
  'browser': { from: '#3b82f6', to: '#6366f1', glow: 'rgba(59,130,246,0.35)', icon: '#93c5fd' },
  'notes': { from: '#eab308', to: '#ca8a04', glow: 'rgba(234,179,8,0.35)', icon: '#fde047' },
  'activity-monitor': { from: '#22c55e', to: '#16a34a', glow: 'rgba(34,197,94,0.35)', icon: '#86efac' },
  'app-store': { from: '#6366f1', to: '#8b5cf6', glow: 'rgba(99,102,241,0.35)', icon: '#a5b4fc' },
  'settings': { from: '#64748b', to: '#475569', glow: 'rgba(100,116,139,0.35)', icon: '#cbd5e1' },
  'terminal': { from: '#22d3ee', to: '#0891b2', glow: 'rgba(34,211,238,0.35)', icon: '#67e8f9' },
  // New apps
  'civilization': { from: '#14b8a6', to: '#0d9488', glow: 'rgba(20,184,166,0.35)', icon: '#5eead4' },
  'reputation': { from: '#f59e0b', to: '#d97706', glow: 'rgba(245,158,11,0.35)', icon: '#fcd34d' },
  'killswitch': { from: '#ef4444', to: '#dc2626', glow: 'rgba(239,68,68,0.35)', icon: '#fca5a5' },
  'citizen-profile': { from: '#6366f1', to: '#818cf8', glow: 'rgba(99,102,241,0.35)', icon: '#c7d2fe' },
  'marketplace': { from: '#f97316', to: '#ea580c', glow: 'rgba(249,115,22,0.35)', icon: '#fdba74' },
  'tx-queue': { from: '#8b5cf6', to: '#6d28d9', glow: 'rgba(139,92,246,0.35)', icon: '#c4b5fd' },
  'community': { from: '#3b82f6', to: '#2563eb', glow: 'rgba(59,130,246,0.35)', icon: '#93c5fd' },
  'hire-humans': { from: '#ec4899', to: '#db2777', glow: 'rgba(236,72,153,0.35)', icon: '#f9a8d4' },
}

const DEFAULT_COLORS = { from: '#6366f1', to: '#8b5cf6', glow: 'rgba(99,102,241,0.35)', icon: '#a5b4fc' }

export default function DesktopIcon({ icon, label, onClick, appId, description }: DesktopIconProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  const colors = useMemo(() => APP_COLORS[appId] || DEFAULT_COLORS, [appId])

  return (
    <button
      onClick={onClick}
      onDoubleClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false) }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      aria-label={`${label} - ${description || 'Application'}`}
      data-app-id={appId}
      tabIndex={0}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 10px 12px',
        borderRadius: '16px',
        border: 'none',
        cursor: 'pointer',
        background: isPressed
          ? 'rgba(255,255,255,0.08)'
          : isHovered
            ? 'rgba(255,255,255,0.04)'
            : 'transparent',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isPressed ? 'scale(0.9)' : isHovered ? 'translateY(-6px) scale(1.05)' : 'none',
        width: '90px',
        fontFamily: "'Inter', system-ui, sans-serif",
        outline: 'none',
        position: 'relative',
      }}
    >
      {/* Hover glow behind icon */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          top: '8px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          filter: 'blur(16px)',
          pointerEvents: 'none',
          animation: 'fadeIn 0.3s ease',
        }} />
      )}

      {/* Icon container — glass with unique gradient */}
      <div style={{
        position: 'relative',
        width: '54px',
        height: '54px',
        borderRadius: '16px',
        background: isHovered
          ? `linear-gradient(145deg, ${colors.from}50, ${colors.to}40)`
          : `linear-gradient(145deg, ${colors.from}22, ${colors.to}18)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: isHovered
          ? `1px solid ${colors.from}60`
          : '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isHovered ? '#fff' : colors.icon,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isHovered
          ? `0 12px 40px ${colors.glow}, 0 0 0 1px ${colors.from}30, inset 0 1px 0 rgba(255,255,255,0.15)`
          : `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
        overflow: 'hidden',
      }}>
        {/* Inner shine */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)',
          borderRadius: '16px 16px 0 0',
          pointerEvents: 'none',
        }} />
        {icon}
      </div>

      {/* Label */}
      <span style={{
        color: isHovered ? '#fff' : 'rgba(255,255,255,0.72)',
        fontSize: '11px',
        fontWeight: isHovered ? 600 : 500,
        textAlign: 'center',
        lineHeight: 1.2,
        maxWidth: '82px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textShadow: isHovered
          ? `0 0 20px ${colors.glow}, 0 1px 4px rgba(0,0,0,0.8)`
          : '0 1px 6px rgba(0,0,0,0.8)',
        letterSpacing: '0.2px',
        transition: 'all 0.25s ease',
      }}>
        {label}
      </span>
    </button>
  )
}
