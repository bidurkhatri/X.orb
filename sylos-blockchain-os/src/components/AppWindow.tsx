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

const TASKBAR_H = 52
const MIN_W = 400
const MIN_H = 300

export default function AppWindow({ title, icon, children, onClose, onMinimize, isActive, onFocus }: AppWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: Math.min(100 + Math.random() * 120, window.innerWidth - 880),
    y: Math.min(30 + Math.random() * 60, window.innerHeight - TASKBAR_H - 640),
  }))
  const [size, setSize] = useState({ w: 860, h: 620 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | false>(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 })
  const [titleHovered, setTitleHovered] = useState<string | null>(null)
  const [snapHint, setSnapHint] = useState<'left' | 'right' | 'top' | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const preSnapRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) {
      // Un-maximize on drag start, position window so cursor is in the title bar center
      const pctX = (e.clientX - position.x) / size.w
      setIsMaximized(false)
      preSnapRef.current = null
      const newX = e.clientX - size.w * pctX
      const newY = 0
      setPosition({ x: newX, y: newY })
      setDragOffset({ x: e.clientX - newX, y: e.clientY - newY })
      setIsDragging(true)
      onFocus()
      return
    }
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

  // Snap to edge or maximize
  const applySnap = useCallback((hint: 'left' | 'right' | 'top') => {
    preSnapRef.current = { x: position.x, y: position.y, w: size.w, h: size.h }
    const vw = window.innerWidth
    const vh = window.innerHeight - TASKBAR_H
    if (hint === 'top') {
      setIsMaximized(true)
    } else if (hint === 'left') {
      setPosition({ x: 0, y: 0 })
      setSize({ w: Math.floor(vw / 2), h: vh })
    } else if (hint === 'right') {
      setPosition({ x: Math.ceil(vw / 2), y: 0 })
      setSize({ w: Math.floor(vw / 2), h: vh })
    }
  }, [position, size])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        // Clamp: keep at least 60px of the title bar visible on-screen
        const maxX = window.innerWidth - 60
        const maxY = window.innerHeight - TASKBAR_H - 20
        const newX = Math.max(-size.w + 60, Math.min(maxX, e.clientX - dragOffset.x))
        const newY = Math.max(0, Math.min(maxY, e.clientY - dragOffset.y))
        setPosition({ x: newX, y: newY })

        // Snap hints: edges
        const SNAP_ZONE = 12
        if (e.clientX <= SNAP_ZONE) setSnapHint('left')
        else if (e.clientX >= window.innerWidth - SNAP_ZONE) setSnapHint('right')
        else if (e.clientY <= SNAP_ZONE) setSnapHint('top')
        else setSnapHint(null)
      }
      if (isResizing) {
        const dx = e.clientX - resizeStart.px
        const dy = e.clientY - resizeStart.py
        if (isResizing.includes('e')) setSize(s => ({ ...s, w: Math.max(MIN_W, resizeStart.w + dx) }))
        if (isResizing.includes('s')) setSize(s => ({ ...s, h: Math.max(MIN_H, resizeStart.h + dy) }))
        if (isResizing.includes('w')) {
          const nw = Math.max(MIN_W, resizeStart.w - dx)
          setSize(s => ({ ...s, w: nw }))
          setPosition(p => ({ ...p, x: resizeStart.x + resizeStart.w - nw }))
        }
        if (isResizing.includes('n')) {
          const nh = Math.max(MIN_H, resizeStart.h - dy)
          setSize(s => ({ ...s, h: nh }))
          setPosition(p => ({ ...p, y: resizeStart.y + resizeStart.h - nh }))
        }
      }
    }
    const handleUp = () => {
      if (isDragging && snapHint) {
        applySnap(snapHint)
        setSnapHint(null)
      }
      setIsDragging(false)
      setIsResizing(false)
    }
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, isMaximized, snapHint, applySnap, size.w])

  const toggleMaximize = () => {
    if (isMaximized && preSnapRef.current) {
      // Restore to pre-snap position
      setPosition({ x: preSnapRef.current.x, y: preSnapRef.current.y })
      setSize({ w: preSnapRef.current.w, h: preSnapRef.current.h })
      preSnapRef.current = null
    }
    setIsMaximized(!isMaximized)
  }

  const windowStyle: React.CSSProperties = isMaximized
    ? { top: 0, left: 0, right: 0, bottom: TASKBAR_H, width: '100%', height: `calc(100% - ${TASKBAR_H}px)` }
    : { top: position.y, left: position.x, width: `${size.w}px`, height: `${size.h}px` }

  const resizeHandle = (dir: string, cursor: string, style: React.CSSProperties) => (
    !isMaximized && <div onMouseDown={e => startResize(e, dir)} style={{ position: 'absolute', zIndex: 2, cursor, ...style }} />
  )

  return (
    <>
      {/* Snap zone preview */}
      {snapHint && isDragging && (
        <div style={{
          position: 'fixed',
          top: snapHint === 'top' ? 0 : 0,
          left: snapHint === 'left' ? 0 : snapHint === 'right' ? '50%' : 0,
          width: snapHint === 'top' ? '100%' : '50%',
          height: `calc(100% - ${TASKBAR_H}px)`,
          background: 'rgba(99,102,241,0.08)',
          border: '2px solid rgba(99,102,241,0.25)',
          borderRadius: snapHint === 'top' ? '0' : '14px',
          zIndex: 49,
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease',
          transition: 'all 0.2s ease',
        }} />
      )}

      <div
        ref={windowRef}
        onClick={onFocus}
        role="dialog"
        aria-label={`${title} window`}
        aria-labelledby={`window-title-${title.replace(/\s+/g, '-').toLowerCase()}`}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
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
          transition: isDragging ? 'none' : 'opacity 0.2s, box-shadow 0.3s, top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
        }}
      >
        {/* Resize handles */}
        {resizeHandle('n', 'ns-resize', { top: 0, left: 16, right: 16, height: '5px' })}
        {resizeHandle('s', 'ns-resize', { bottom: 0, left: 16, right: 16, height: '5px' })}
        {resizeHandle('w', 'ew-resize', { left: 0, top: 16, bottom: 16, width: '5px' })}
        {resizeHandle('e', 'ew-resize', { right: 0, top: 16, bottom: 16, width: '5px' })}
        {resizeHandle('nw', 'nwse-resize', { top: 0, left: 0, width: '14px', height: '14px' })}
        {resizeHandle('ne', 'nesw-resize', { top: 0, right: 0, width: '14px', height: '14px' })}
        {resizeHandle('sw', 'nesw-resize', { bottom: 0, left: 0, width: '14px', height: '14px' })}
        {resizeHandle('se', 'nwse-resize', { bottom: 0, right: 0, width: '14px', height: '14px' })}

        {/* ─── Title bar — premium glass chrome ─── */}
        <div
          onMouseDown={handleMouseDown}
          onDoubleClick={toggleMaximize}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 14px', height: '44px', minHeight: '44px',
            background: isActive
              ? 'linear-gradient(180deg, rgba(18,22,52,0.98) 0%, rgba(14,18,42,0.98) 100%)'
              : 'rgba(16,20,40,0.98)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            borderBottom: isActive
              ? '1px solid rgba(99,102,241,0.12)'
              : '1px solid rgba(255,255,255,0.04)',
            cursor: isMaximized ? 'default' : isDragging ? 'grabbing' : 'grab',
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

          {/* Traffic lights (left side, macOS style) */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseEnter={() => setTitleHovered('all')}
            onMouseLeave={() => setTitleHovered(null)}
          >
            {/* Close */}
            <button
              onClick={e => { e.stopPropagation(); onClose() }}
              onMouseEnter={() => setTitleHovered('close')}
              onMouseLeave={() => setTitleHovered('all')}
              aria-label={`Close ${title}`}
              style={{
                width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: titleHovered ? '#ef4444' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.15s', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: titleHovered === 'close' ? '0 0 8px rgba(239,68,68,0.4)' : 'none',
              }}
            >
              {titleHovered && <X size={8} color="#fff" strokeWidth={3} />}
            </button>

            {/* Minimize */}
            <button
              onClick={e => { e.stopPropagation(); onMinimize() }}
              onMouseEnter={() => setTitleHovered('min')}
              onMouseLeave={() => setTitleHovered('all')}
              aria-label={`Minimize ${title}`}
              style={{
                width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: titleHovered ? '#fbbf24' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.15s', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: titleHovered === 'min' ? '0 0 8px rgba(251,191,36,0.4)' : 'none',
              }}
            >
              {titleHovered && <Minus size={8} color="#92400e" strokeWidth={3} />}
            </button>

            {/* Maximize */}
            <button
              onClick={e => { e.stopPropagation(); toggleMaximize() }}
              onMouseEnter={() => setTitleHovered('max')}
              onMouseLeave={() => setTitleHovered('all')}
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
              style={{
                width: '13px', height: '13px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: titleHovered ? '#34d399' : 'rgba(255,255,255,0.12)',
                transition: 'all 0.15s', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: titleHovered === 'max' ? '0 0 8px rgba(52,211,153,0.4)' : 'none',
              }}
            >
              {titleHovered && (isMaximized
                ? <Minimize2 size={7} color="#065f46" strokeWidth={3} />
                : <Maximize2 size={7} color="#065f46" strokeWidth={3} />
              )}
            </button>
          </div>

          {/* Center: app name + icon */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '8px',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: '22px', height: '22px',
              borderRadius: '7px',
              background: isActive ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))' : 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
            }}>
              <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            </div>
            <span id={`window-title-${title.replace(/\s+/g, '-').toLowerCase()}`} style={{
              fontSize: '13px', fontWeight: 600,
              color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              letterSpacing: '0.2px',
            }}>{title}</span>
          </div>

          {/* Right spacer for symmetry */}
          <div style={{ width: '47px' }} />
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
    </>
  )
}
