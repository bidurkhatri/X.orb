/**
 * @file DesktopCompanion.tsx
 * @description Renders the user's active AI agent as a pixel character walking on the SylOS desktop.
 * It periodically syncs with AgentRegistry to find an active agent owned by the connected wallet.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { agentRegistry, type RegisteredAgent } from '@/services/agent/AgentRegistry'
import { eventBus } from '@/services/EventBus'
import { useAccount } from 'wagmi'

/* ═══════════════════════════════
   ═══  CONSTANTS  ═══════════════
   ═══════════════════════════════ */

const TILE = 32
const FPS = 12

const ROLE_COLORS: Record<string, { body: string; accent: string; hair: string }> = {
    TRADER: { body: '#f59e0b', accent: '#d97706', hair: '#92400e' },
    RESEARCHER: { body: '#3b82f6', accent: '#2563eb', hair: '#1e3a5f' },
    MONITOR: { body: '#22c55e', accent: '#16a34a', hair: '#14532d' },
    CODER: { body: '#8b5cf6', accent: '#7c3aed', hair: '#4c1d95' },
    GOVERNANCE_ASSISTANT: { body: '#ec4899', accent: '#db2777', hair: '#831843' },
    FILE_INDEXER: { body: '#06b6d4', accent: '#0891b2', hair: '#164e63' },
    RISK_AUDITOR: { body: '#ef4444', accent: '#dc2626', hair: '#7f1d1d' },
}

const ROLE_ICONS: Record<string, string> = {
    TRADER: '📈', RESEARCHER: '🔬', MONITOR: '👁️', CODER: '💻',
    GOVERNANCE_ASSISTANT: '🏛️', FILE_INDEXER: '📁', RISK_AUDITOR: '🛡️',
}

interface CompanionState {
    id: string
    name: string
    role: string
    x: number
    y: number
    tx: number
    ty: number
    state: 'idle' | 'walk' | 'type' | 'celebrate'
    dir: 'left' | 'right'
    frame: number
    frameTimer: number
    speech: string
    speechTimer: number
    colors: { body: string; accent: string; hair: string }
}

/* ═══════════════════════════════
   ═══  DRAWING ENGINE  ══════════
   ═══════════════════════════════ */

function drawCharacter(ctx: CanvasRenderingContext2D, char: CompanionState) {
    const cx = char.x
    const cy = char.y
    const { body, accent, hair } = char.colors
    const bounce = char.state === 'walk' ? Math.sin(char.frame * Math.PI) * 2 : 0

    ctx.save()

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.ellipse(cx + TILE / 2, cy + TILE - 2, 12, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Body
    ctx.fillStyle = body
    ctx.fillRect(cx + 8, cy + 14 - bounce, 16, 14)

    // Head
    ctx.fillStyle = '#fcd9b6'
    ctx.fillRect(cx + 9, cy + 4 - bounce, 14, 12)

    // Hair
    ctx.fillStyle = hair
    ctx.fillRect(cx + 8, cy + 2 - bounce, 16, 6)

    // Eyes
    ctx.fillStyle = '#1a1a2e'
    const blink = char.frame % 8 === 0
    // If facing left, shift eyes
    const eyeShift = char.dir === 'left' ? -2 : 0
    ctx.fillRect(cx + 13 + eyeShift, cy + 8 - bounce, 2, blink ? 1 : 3)
    ctx.fillRect(cx + 19 + eyeShift, cy + 8 - bounce, 2, blink ? 1 : 3)

    // Arms
    ctx.fillStyle = accent
    if (char.state === 'type') {
        const armY = char.frame % 2 === 0 ? 0 : 2
        ctx.fillRect(cx + 4, cy + 16 - bounce + armY, 4, 8)
        ctx.fillRect(cx + 24, cy + 16 - bounce - armY, 4, 8)
    } else {
        ctx.fillRect(cx + 4, cy + 16 - bounce, 4, 10)
        ctx.fillRect(cx + 24, cy + 16 - bounce, 4, 10)
    }

    // Legs
    ctx.fillStyle = '#374151'
    if (char.state === 'walk') {
        const legOff = char.frame % 2 === 0 ? 2 : -2
        ctx.fillRect(cx + 10, cy + 26, 5, 6)
        ctx.fillRect(cx + 17 + legOff, cy + 26, 5, 6)
    } else {
        ctx.fillRect(cx + 10, cy + 26, 5, 6)
        ctx.fillRect(cx + 17, cy + 26, 5, 6)
    }

    // Role badge
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(cx + TILE / 2, cy - 2, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = '8px serif'
    ctx.textAlign = 'center'
    ctx.fillText(ROLE_ICONS[char.role] || '🤖', cx + TILE / 2, cy + 1)

    // Celebrate particles
    if (char.state === 'celebrate') {
        for (let i = 0; i < 4; i++) {
            const px = cx + TILE / 2 + Math.cos(Date.now() / 200 + i) * 16
            const py = cy - 8 + Math.sin(Date.now() / 300 + i * 2) * 8
            ctx.fillStyle = ['#f59e0b', '#ef4444', '#22c55e', '#8b5cf6'][i]!
            ctx.fillRect(px, py, 3, 3)
        }
    }

    ctx.restore()

    // Name label
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.font = 'bold 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    const nameW = ctx.measureText(char.name).width + 8
    ctx.beginPath()
    ctx.roundRect(cx + TILE / 2 - nameW / 2, cy + TILE + 2, nameW, 14, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(char.name, cx + TILE / 2, cy + TILE + 12)

    // Speech bubble
    if (char.speech && char.speechTimer > 0) {
        const bubbleW = Math.min(ctx.measureText(char.speech).width + 16, 200)
        const bubbleH = 22
        const bx = cx + TILE / 2 - bubbleW / 2
        const by = cy - 30

        ctx.fillStyle = 'rgba(15, 15, 26, 0.9)'
        ctx.strokeStyle = body
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(bx, by, bubbleW, bubbleH, 6)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = 'rgba(15, 15, 26, 0.9)'
        ctx.beginPath()
        ctx.moveTo(cx + TILE / 2 - 4, by + bubbleH)
        ctx.lineTo(cx + TILE / 2, by + bubbleH + 6)
        ctx.lineTo(cx + TILE / 2 + 4, by + bubbleH)
        ctx.fill()

        ctx.fillStyle = '#e2e8f0'
        ctx.font = '10px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        const displayText = char.speech.length > 30 ? char.speech.slice(0, 30) + '…' : char.speech
        ctx.fillText(displayText, cx + TILE / 2, by + 15)
    }
}

/* ═══════════════════════════════
   ═══  COMPONENT  ═══════════════
   ═══════════════════════════════ */

export default function DesktopCompanion() {
    const { address } = useAccount()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animRef = useRef<number>(0)
    const lastTickRef = useRef<number>(0)

    // The active companion state (null if no active agents)
    const [companion, setCompanion] = useState<CompanionState | null>(null)

    // 1. Sync active agent
    useEffect(() => {
        const syncAgent = () => {
            if (!address) {
                setCompanion(null)
                return
            }

            // Find an active agent belonging to this wallet
            const myAgents = agentRegistry.getAgentsBySponsor(address).filter(a => a.status === 'active')
            if (myAgents.length === 0) {
                setCompanion(null)
                return
            }

            // Pick the first active one
            const primary = myAgents[0]!

            setCompanion(prev => {
                if (prev?.id === primary.agentId) return prev // Keep existing state if same agent

                // Spawn new companion near bottom right
                const startX = window.innerWidth - 100 - Math.random() * 200
                const startY = window.innerHeight - 150

                return {
                    id: primary.agentId,
                    name: primary.name,
                    role: primary.role,
                    x: startX,
                    y: startY,
                    tx: startX,
                    ty: startY,
                    state: 'idle',
                    dir: 'left',
                    frame: 0,
                    frameTimer: 0,
                    speech: `Ready to work!`,
                    speechTimer: 3000,
                    colors: ROLE_COLORS[primary.role] || ROLE_COLORS['CODER']!
                }
            })
        }

        syncAgent()
        const unsub = agentRegistry.subscribe(syncAgent)
        return unsub
    }, [address])

    // 2. EventBus listeners for speech bubbles
    useEffect(() => {
        if (!companion) return

        const unsubThought = eventBus.on('agent:thought', (e) => {
            if (e.source !== companion.id) return
            setCompanion(p => p ? { ...p, state: 'type' } : p)
            setTimeout(() => setCompanion(p => p?.state === 'type' ? { ...p, state: 'idle' } : p), 2000)
        })

        const unsubPost = eventBus.on('community:post_created', (e) => {
            if (e.source !== companion.id) return
            setCompanion(p => p ? { ...p, state: 'celebrate', speech: e.payload?.title || 'Posted!', speechTimer: 4000 } : p)
            setTimeout(() => setCompanion(p => p?.state === 'celebrate' ? { ...p, state: 'idle' } : p), 4000)
        })

        const unsubTool = eventBus.on('agent:tool_executed', (e) => {
            if (e.source !== companion.id) return
            setCompanion(p => p ? { ...p, speech: `Ran ${e.payload?.toolName}`, speechTimer: 2000 } : p)
        })

        return () => {
            unsubThought()
            unsubPost()
            unsubTool()
        }
    }, [companion?.id])

    // 3. Game Loop
    useEffect(() => {
        if (!companion) return

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const resize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        window.addEventListener('resize', resize)
        resize()

        lastTickRef.current = performance.now()

        const loop = (now: number) => {
            const dt = now - lastTickRef.current
            lastTickRef.current = now

            setCompanion(prev => {
                if (!prev) return prev
                const next = { ...prev }

                // Timers
                next.frameTimer += dt
                if (next.speechTimer > 0) {
                    next.speechTimer -= dt
                    if (next.speechTimer <= 0) next.speech = ''
                }

                if (next.frameTimer >= 1000 / FPS) {
                    next.frameTimer = 0
                    next.frame = (next.frame + 1) % 8
                }

                // AI Logic (Wander around desktop)
                if (next.state === 'idle') {
                    if (Math.random() < 0.005) {
                        // Pick new destination
                        const margin = 100
                        next.tx = margin + Math.random() * (window.innerWidth - margin * 2)
                        next.ty = window.innerHeight - 100 - Math.random() * 200 // Keep near bottom half
                        next.state = 'walk'
                    } else if (Math.random() < 0.002) {
                        next.state = 'type' // Pretent to work
                        setTimeout(() => setCompanion(p => p?.state === 'type' ? { ...p, state: 'idle' } : p), 2000)
                    }
                } else if (next.state === 'walk') {
                    const speed = 1.0
                    const dx = next.tx - next.x
                    const dy = next.ty - next.y

                    if (Math.abs(dx) > speed) next.x += Math.sign(dx) * speed
                    else next.x = next.tx

                    if (Math.abs(dy) > speed) next.y += Math.sign(dy) * speed
                    else next.y = next.ty

                    next.dir = dx > 0 ? 'right' : 'left'

                    if (next.x === next.tx && next.y === next.ty) {
                        next.state = 'idle'
                    }
                }

                // Draw
                ctx.clearRect(0, 0, canvas.width, canvas.height)
                drawCharacter(ctx, next)

                return next
            })

            animRef.current = requestAnimationFrame(loop)
        }

        animRef.current = requestAnimationFrame(loop)

        return () => {
            window.removeEventListener('resize', resize)
            cancelAnimationFrame(animRef.current)
        }
    }, [companion?.id]) // Restart loop if agent ID changes, but otherwise keep running

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none', // Let clicks pass through to desktop underneath
                zIndex: 4, // Above wallpaper, below windows (if windows have zIndex >= 10)
                imageRendering: 'pixelated'
            }}
        />
    )
}
