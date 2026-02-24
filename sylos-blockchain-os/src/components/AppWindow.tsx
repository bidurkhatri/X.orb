import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react'

interface AppWindowProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  onMinimize: () => void
  isActive: boolean
  onFocus: () => void
}

export default function AppWindow({ title, icon, children, onClose, onMinimize, isActive, onFocus }: AppWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [position, setPosition] = useState({ x: 100 + Math.random() * 120, y: 30 + Math.random() * 60 })
  const [size, setSize] = useState({ w: 860, h: 620 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | false>(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 })
  const [titleHovered, setTitleHovered] = useState<string | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return
    setIsDragging(true)
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y })
    onFocus()
  }

  const startResize = useCallback((e: React.MouseEvent, dir: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(dir)
    setResizeStart({ x: position.x, y: position.y, w: size.w, h: size.h, px: e.clientX, py: e.clientY })
    onFocus()
  }, [position, size, onFocus])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        setPosition({ x: e.clientX - dragOffset.x, y: Math.max(0, e.clientY - dragOffset.y) })
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.px
        const dy = e.clientY - resizeStart.py
        const minW = 400, minH = 300
        if (isResizing.includes('e')) setSize(s => ({ ...s, w: Math.max(minW, resizeStart.w + dx) }))
        if (isResizing.includes('s')) setSize(s => ({ ...s, h: Math.max(minH, resizeStart.h + dy) }))
        if (isResizing.includes('w')) {
          const nw = Math.max(minW, resizeStart.w - dx)
          setSize(s => ({ ...s, w: nw }))
          setPosition(p => ({ ...p, x: resizeStart.x + resizeStart.w - nw }))
        }
        if (isResizing.includes('n')) {
          const nh = Math.max(minH, resizeStart.h - dy)
          setSize(s => ({ ...s, h: nh }))
          setPosition(p => ({ ...p, y: resizeStart.y + resizeStart.h - nh }))
        }
      }
    }
    const handleUp = () => { setIsDragging(false); setIsResizing(false) }
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, isMaximized])

  const windowStyle: React.CSSProperties = isMaximized
    ? { top: 0, left: 0, right: 0, bottom: 56, width: '100%', height: 'calc(100% - 56px)' }
    : { top: position.y, left: position.x, width: `${size.w}px`, height: `${size.h}px` }

  const resizeHandle = (dir: string, cursor: string, style: React.CSSProperties) => (
    !isMaximized && <div onMouseDown={e => startResize(e, dir)} style={{ position: 'absolute', zIndex: 2, cursor, ...style }} />
  )

  return (
    <div
      ref={windowRef}
      onClick={onFocus}
      role="dialog"
      aria-label={`${title} window`}
      style={{
        position: 'fixed', ...windowStyle,
        borderRadius: isMaximized ? '0' : '14px',
        overflow: 'hidden',
        zIndex: isActive ? 50 : 40,
        boxShadow: isActive
          ? '0 32px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 16px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'windowOpen 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex', flexDirection: 'column',
        opacity: isActive ? 1 : 0.92,
        transition: 'opacity 0.2s, box-shadow 0.3s',
      }}
    >
      {/* Resize handles */}
      {resizeHandle('n', 'ns-resize', { top: 0, left: 16, right: 16, height: '4px' })}
      {resizeHandle('s', 'ns-resize', { bottom: 0, left: 16, right: 16, height: '4px' })}
      {resizeHandle('w', 'ew-resize', { left: 0, top: 16, bottom: 16, width: '4px' })}
      {resizeHandle('e', 'ew-resize', { right: 0, top: 16, bottom: 16, width: '4px' })}
      {resizeHandle('nw', 'nwse-resize', { top: 0, left: 0, width: '12px', height: '12px' })}
      {resizeHandle('ne', 'nesw-resize', { top: 0, right: 0, width: '12px', height: '12px' })}
      {resizeHandle('sw', 'nesw-resize', { bottom: 0, left: 0, width: '12px', height: '12px' })}
      {resizeHandle('se', 'nwse-resize', { bottom: 0, right: 0, width: '12px', height: '12px' })}

      {/* ─── Title bar — premium glass chrome ─── */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setIsMaximized(!isMaximized)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', height: '46px', minHeight: '46px',
          background: isActive
            ? 'linear-gradient(180deg, rgba(18,22,52,0.98) 0%, rgba(14,18,42,0.98) 100%)'
            : 'rgba(16,20,40,0.98)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: isActive
            ? '1px solid rgba(99,102,241,0.12)'
            : '1px solid rgba(255,255,255,0.04)',
          cursor: isMaximized ? 'default' : 'move',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        {/* Subtle top highlight */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: isActive
            ? 'linear-gradient(90deg, transparent, rgba(99,102,241,0.2) 30%, rgba(139,92,246,0.15) 70%, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '26px', height: '26px',
            borderRadius: '8px',
            background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))' : 'rgba(255,255,255,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
          }}>
            <div style={{ width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
          </div>
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
            letterSpacing: '0.3px',
          }}>{title}</span>
        </div>

        {/* ─── Traffic-light style buttons ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Minimize */}
          <button
            onClick={e => { e.stopPropagation(); onMinimize() }}
            onMouseEnter={() => setTitleHovered('min')}
            onMouseLeave={() => setTitleHovered(null)}
            aria-label={`Minimize ${title}`}
            style={{
              width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: titleHovered === 'min' ? '#fbbf24' : 'rgba(255,255,255,0.12)',
              transition: 'all 0.15s', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: titleHovered === 'min' ? '0 0 8px rgba(251,191,36,0.4)' : 'none',
            }}
          >
            {titleHovered === 'min' && <Minus size={8} color="#92400e" strokeWidth={3} />}
          </button>

          {/* Maximize */}
          <button
            onClick={e => { e.stopPropagation(); setIsMaximized(!isMaximized) }}
            onMouseEnter={() => setTitleHovered('max')}
            onMouseLeave={() => setTitleHovered(null)}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            style={{
              width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: titleHovered === 'max' ? '#34d399' : 'rgba(255,255,255,0.12)',
              transition: 'all 0.15s', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: titleHovered === 'max' ? '0 0 8px rgba(52,211,153,0.4)' : 'none',
            }}
          >
            {titleHovered === 'max' && (isMaximized
              ? <Minimize2 size={7} color="#065f46" strokeWidth={3} />
              : <Maximize2 size={7} color="#065f46" strokeWidth={3} />
            )}
          </button>

          {/* Close */}
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            onMouseEnter={() => setTitleHovered('close')}
            onMouseLeave={() => setTitleHovered(null)}
            aria-label={`Close ${title}`}
            style={{
              width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: titleHovered === 'close' ? '#ef4444' : 'rgba(255,255,255,0.12)',
              transition: 'all 0.15s', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: titleHovered === 'close' ? '0 0 8px rgba(239,68,68,0.4)' : 'none',
            }}
          >
            {titleHovered === 'close' && <X size={8} color="#fff" strokeWidth={3} />}
          </button>
        </div>
      </div>

      {/* ─── Content area ─── */}
      <div style={{
        flex: 1, overflow: 'auto',
        background: 'linear-gradient(180deg, #0b0f22 0%, #0d1126 50%, #0f1328 100%)',
        color: 'rgba(255,255,255,0.87)',
      }}>
        {children}
      </div>
    </div>
  )
}
