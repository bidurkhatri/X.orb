/**
 * @file PixelWorldApp.tsx
 * @description SylOS Pixel Agent World — see your AI agents as animated pixel characters
 * 
 * Inspired by pixel-agents (https://github.com/pablodelucca/pixel-agents)
 * Adapted for SylOS: agents are visual pixel characters that walk, work, and interact.
 * 
 * Uses Canvas 2D with:
 * - Game loop (requestAnimationFrame)
 * - BFS pathfinding on tile grid
 * - Character state machine (idle → walk → type → read → celebrate)
 * - EventBus integration for real-time agent state
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { agentRegistry } from '@/services/agent/AgentRegistry'
import { eventBus } from '@/services/EventBus'

/* ═══════════════════════════════
   ═══  CONSTANTS  ═══════════════
   ═══════════════════════════════ */

const TILE = 32  // px per tile
const GRID_W = 20
const GRID_H = 14
const FPS = 12

// Character colors per role
const ROLE_COLORS: Record<string, { body: string; accent: string; hair: string }> = {
    TRADER: { body: '#f59e0b', accent: '#d97706', hair: '#92400e' },
    RESEARCHER: { body: '#3b82f6', accent: '#2563eb', hair: '#1e3a5f' },
    MONITOR: { body: '#22c55e', accent: '#16a34a', hair: '#14532d' },
    CODER: { body: '#8b5cf6', accent: '#7c3aed', hair: '#4c1d95' },
    GOVERNANCE_ASSISTANT: { body: '#ec4899', accent: '#db2777', hair: '#831843' },
    FILE_INDEXER: { body: '#06b6d4', accent: '#0891b2', hair: '#164e63' },
    RISK_AUDITOR: { body: '#ef4444', accent: '#dc2626', hair: '#7f1d1d' },
}

// Role emojis for speech bubbles
const ROLE_ICONS: Record<string, string> = {
    TRADER: '📈', RESEARCHER: '🔬', MONITOR: '👁️', CODER: '💻',
    GOVERNANCE_ASSISTANT: '🏛️', FILE_INDEXER: '📁', RISK_AUDITOR: '🛡️',
}

/* ═══════════════════════════════
   ═══  TYPES  ═══════════════════
   ═══════════════════════════════ */

type CharState = 'idle' | 'walk' | 'type' | 'read' | 'sleep' | 'celebrate'
type Direction = 'up' | 'down' | 'left' | 'right'

interface PixelChar {
    id: string
    name: string
    role: string
    reputation: number
    status: string
    x: number           // pixel position
    y: number
    tx: number          // target tile
    ty: number
    state: CharState
    dir: Direction
    frame: number
    frameTimer: number
    path: { x: number; y: number }[]
    pathIdx: number
    speech: string
    speechTimer: number
    colors: { body: string; accent: string; hair: string }
}

// World tile types
const T = {
    FLOOR: 0,
    WALL: 1,
    DESK: 2,
    TERMINAL: 3,
    GATHERING: 4,
    PLANT: 5,
} as const

/* ═══════════════════════════════
   ═══  WORLD MAP  ═══════════════
   ═══════════════════════════════ */

// Simple office/civilization layout
const WORLD_MAP: number[][] = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 0, 2, 0, 0, 1, 0, 0, 4, 4, 0, 1, 0, 3, 0, 3, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 4, 4, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 3, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 5, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 2, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 2, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 2, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
]

/* ═══════════════════════════════
   ═══  BFS PATHFINDING  ═════════
   ═══════════════════════════════ */

function isWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false
    const tile = WORLD_MAP[ty]?.[tx]
    return tile === T.FLOOR || tile === T.GATHERING
}

function bfs(sx: number, sy: number, ex: number, ey: number): { x: number; y: number }[] {
    if (!isWalkable(ex, ey)) return []
    if (sx === ex && sy === ey) return []

    const visited = new Set<string>()
    const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
        { x: sx, y: sy, path: [] },
    ]
    visited.add(`${sx},${sy}`)

    const dirs = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    ]

    while (queue.length > 0) {
        const cur = queue.shift()!
        for (const d of dirs) {
            const nx = cur.x + d.dx
            const ny = cur.y + d.dy
            const key = `${nx},${ny}`
            if (visited.has(key) || !isWalkable(nx, ny)) continue
            visited.add(key)
            const newPath = [...cur.path, { x: nx, y: ny }]
            if (nx === ex && ny === ey) return newPath
            queue.push({ x: nx, y: ny, path: newPath })
        }
    }

    return []
}

/* ═══════════════════════════════
   ═══  CHARACTER DRAWING  ═══════
   ═══════════════════════════════ */

function drawCharacter(ctx: CanvasRenderingContext2D, char: PixelChar) {
    const cx = char.x
    const cy = char.y
    const { body, accent, hair } = char.colors
    const bounce = char.state === 'walk' ? Math.sin(char.frame * Math.PI) * 2 : 0

    ctx.save()

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.beginPath()
    ctx.ellipse(cx + TILE / 2, cy + TILE - 2, 10, 4, 0, 0, Math.PI * 2)
    ctx.fill()

    // Body
    ctx.fillStyle = body
    ctx.fillRect(cx + 8, cy + 14 - bounce, 16, 14)

    // Head
    ctx.fillStyle = '#fcd9b6'  // skin
    ctx.fillRect(cx + 9, cy + 4 - bounce, 14, 12)

    // Hair
    ctx.fillStyle = hair
    ctx.fillRect(cx + 8, cy + 2 - bounce, 16, 6)

    // Eyes
    ctx.fillStyle = '#1a1a2e'
    if (char.state === 'sleep') {
        // Closed eyes
        ctx.fillRect(cx + 12, cy + 9 - bounce, 3, 1)
        ctx.fillRect(cx + 18, cy + 9 - bounce, 3, 1)
    } else {
        const blink = char.frame % 8 === 0
        ctx.fillRect(cx + 13, cy + 8 - bounce, 2, blink ? 1 : 3)
        ctx.fillRect(cx + 19, cy + 8 - bounce, 2, blink ? 1 : 3)
    }

    // Arms animation
    ctx.fillStyle = accent
    if (char.state === 'type') {
        // Typing arms movement
        const armY = char.frame % 2 === 0 ? 0 : 2
        ctx.fillRect(cx + 4, cy + 16 - bounce + armY, 4, 8)
        ctx.fillRect(cx + 24, cy + 16 - bounce - armY, 4, 8)
    } else if (char.state === 'read') {
        // Holding something
        ctx.fillRect(cx + 4, cy + 14 - bounce, 4, 10)
        ctx.fillRect(cx + 24, cy + 14 - bounce, 4, 10)
        // Book
        ctx.fillStyle = '#f5f5dc'
        ctx.fillRect(cx + 8, cy + 22 - bounce, 16, 4)
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
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.font = 'bold 9px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    const nameW = ctx.measureText(char.name).width + 6
    ctx.fillRect(cx + TILE / 2 - nameW / 2, cy + TILE + 1, nameW, 12)
    ctx.fillStyle = '#fff'
    ctx.fillText(char.name, cx + TILE / 2, cy + TILE + 10)

    // Speech bubble
    if (char.speech && char.speechTimer > 0) {
        const bubbleW = Math.min(ctx.measureText(char.speech).width + 12, 160)
        const bubbleH = 18
        const bx = cx + TILE / 2 - bubbleW / 2
        const by = cy - 24

        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.strokeStyle = body
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(bx, by, bubbleW, bubbleH, 6)
        ctx.fill()
        ctx.stroke()

        // Bubble tail
        ctx.fillStyle = 'rgba(255,255,255,0.95)'
        ctx.beginPath()
        ctx.moveTo(cx + TILE / 2 - 4, by + bubbleH)
        ctx.lineTo(cx + TILE / 2, by + bubbleH + 5)
        ctx.lineTo(cx + TILE / 2 + 4, by + bubbleH)
        ctx.fill()

        ctx.fillStyle = '#1a1a2e'
        ctx.font = '9px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        const displayText = char.speech.length > 24 ? char.speech.slice(0, 24) + '…' : char.speech
        ctx.fillText(displayText, cx + TILE / 2, by + 13)
    }
}

/* ═══════════════════════════════
   ═══  WORLD DRAWING  ══════════
   ═══════════════════════════════ */

function drawWorld(ctx: CanvasRenderingContext2D) {
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const tile = WORLD_MAP[y]![x]!
            const px = x * TILE
            const py = y * TILE

            switch (tile) {
                case T.FLOOR:
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a3d' : '#272739'
                    ctx.fillRect(px, py, TILE, TILE)
                    break
                case T.WALL:
                    ctx.fillStyle = '#1a1a2e'
                    ctx.fillRect(px, py, TILE, TILE)
                    ctx.fillStyle = '#0f0f1a'
                    ctx.fillRect(px, py + TILE - 3, TILE, 3)
                    // Wall edge highlight
                    ctx.fillStyle = '#2a2a40'
                    ctx.fillRect(px, py, TILE, 2)
                    break
                case T.DESK:
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a3d' : '#272739'
                    ctx.fillRect(px, py, TILE, TILE)
                    // Desk top
                    ctx.fillStyle = '#8B6D47'
                    ctx.fillRect(px + 2, py + 8, TILE - 4, TILE - 12)
                    ctx.fillStyle = '#6B4F33'
                    ctx.fillRect(px + 2, py + TILE - 6, TILE - 4, 4)
                    // Monitor glow
                    ctx.fillStyle = '#4ade80'
                    ctx.fillRect(px + 8, py + 10, 16, 10)
                    ctx.fillStyle = '#22c55e'
                    ctx.fillRect(px + 14, py + 20, 4, 4)
                    break
                case T.TERMINAL:
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a3d' : '#272739'
                    ctx.fillRect(px, py, TILE, TILE)
                    // Terminal frame
                    ctx.fillStyle = '#374151'
                    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 10)
                    ctx.fillStyle = '#0f172a'
                    ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 16)
                    // Terminal text lines
                    ctx.fillStyle = '#22c55e'
                    for (let i = 0; i < 3; i++) {
                        ctx.fillRect(px + 8, py + 8 + i * 4, 8 + (i * 3) % 6, 2)
                    }
                    break
                case T.GATHERING:
                    // Community gathering area - slightly brighter
                    ctx.fillStyle = '#2d2d44'
                    ctx.fillRect(px, py, TILE, TILE)
                    // Subtle pattern
                    ctx.fillStyle = '#33334d'
                    ctx.fillRect(px + 4, py + 4, 4, 4)
                    ctx.fillRect(px + TILE - 8, py + TILE - 8, 4, 4)
                    break
                case T.PLANT:
                    ctx.fillStyle = (x + y) % 2 === 0 ? '#2a2a3d' : '#272739'
                    ctx.fillRect(px, py, TILE, TILE)
                    // Plant pot
                    ctx.fillStyle = '#92400e'
                    ctx.fillRect(px + 10, py + 22, 12, 8)
                    // Leaves
                    ctx.fillStyle = '#22c55e'
                    ctx.fillRect(px + 8, py + 10, 6, 8)
                    ctx.fillRect(px + 14, py + 6, 6, 12)
                    ctx.fillRect(px + 20, py + 10, 6, 8)
                    ctx.fillStyle = '#16a34a'
                    ctx.fillRect(px + 12, py + 12, 8, 10)
                    break
            }
        }
    }

    // Room labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏢 TRADING FLOOR', 4 * TILE, 1.5 * TILE)
    ctx.fillText('🏛️ COMMUNITY HUB', 10.5 * TILE, 1.5 * TILE)
    ctx.fillText('💻 CODING LAB', 17 * TILE, 1.5 * TILE)
    ctx.fillText('🔬 RESEARCH WING', 4 * TILE, 8.5 * TILE)
    ctx.fillText('🎯 TOWN SQUARE', 10.5 * TILE, 8.5 * TILE)
    ctx.fillText('🛡️ AUDIT CENTER', 17 * TILE, 8.5 * TILE)
}

/* ═══════════════════════════════
   ═══  MAIN COMPONENT  ═════════
   ═══════════════════════════════ */

const PixelWorldApp: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const charsRef = useRef<Map<string, PixelChar>>(new Map())
    const animRef = useRef<number>(0)
    const lastTickRef = useRef<number>(0)
    const [agentCount, setAgentCount] = useState(0)
    const [selectedAgent, setSelectedAgent] = useState<PixelChar | null>(null)
    const [activityLog, setActivityLog] = useState<string[]>([])

    const addLog = useCallback((msg: string) => {
        setActivityLog(prev => [msg, ...prev].slice(0, 30))
    }, [])

    // Find an open floor tile to spawn the character
    const findSpawnTile = useCallback((): { x: number; y: number } => {
        const open: { x: number; y: number }[] = []
        for (let y = 1; y < GRID_H - 1; y++) {
            for (let x = 1; x < GRID_W - 1; x++) {
                if (WORLD_MAP[y]![x] === T.FLOOR) open.push({ x, y })
            }
        }
        return open[Math.floor(Math.random() * open.length)] || { x: 5, y: 5 }
    }, [])

    // Sync characters with agent registry
    const syncAgents = useCallback(() => {
        const agents = agentRegistry.getAllAgents()
        const chars = charsRef.current

        for (const agent of agents) {
            if (agent.status === 'revoked') {
                if (chars.has(agent.agentId)) {
                    chars.delete(agent.agentId)
                }
                continue
            }

            if (!chars.has(agent.agentId)) {
                const spawn = findSpawnTile()
                const colors = ROLE_COLORS[agent.role] || ROLE_COLORS['CODER']!
                chars.set(agent.agentId, {
                    id: agent.agentId,
                    name: agent.name.length > 12 ? agent.name.slice(0, 12) : agent.name,
                    role: agent.role,
                    reputation: agent.reputation,
                    status: agent.status,
                    x: spawn.x * TILE,
                    y: spawn.y * TILE,
                    tx: spawn.x,
                    ty: spawn.y,
                    state: agent.status === 'paused' ? 'sleep' : 'idle',
                    dir: 'down',
                    frame: 0,
                    frameTimer: 0,
                    path: [],
                    pathIdx: 0,
                    speech: '',
                    speechTimer: 0,
                    colors,
                })
            } else {
                const char = chars.get(agent.agentId)!
                char.reputation = agent.reputation
                char.status = agent.status
                if (agent.status === 'paused' && char.state !== 'sleep') {
                    char.state = 'sleep'
                }
            }
        }

        setAgentCount(chars.size)
    }, [findSpawnTile])

    // Pick a random destination based on role
    const pickDestination = useCallback((char: PixelChar): { x: number; y: number } | null => {
        const targets: { x: number; y: number }[] = []

        for (let y = 0; y < GRID_H; y++) {
            for (let x = 0; x < GRID_W; x++) {
                const tile = WORLD_MAP[y]![x]!
                // Guide agents to relevant areas
                if (char.role === 'CODER' && tile === T.TERMINAL) targets.push({ x, y: y + 1 })
                else if (char.role === 'TRADER' && tile === T.DESK) targets.push({ x, y: y + 1 })
                else if (char.role === 'GOVERNANCE_ASSISTANT' && tile === T.GATHERING) targets.push({ x, y })
                else if (tile === T.FLOOR) targets.push({ x, y })
            }
        }

        // Pick a nearby walkable tile
        const valid = targets.filter(t => isWalkable(t.x, t.y))
        return valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)]! : null
    }, [])

    // Update character logic
    const updateCharacter = useCallback((char: PixelChar, dt: number) => {
        char.frameTimer += dt

        // Speech bubble countdown
        if (char.speechTimer > 0) {
            char.speechTimer -= dt
            if (char.speechTimer <= 0) char.speech = ''
        }

        if (char.status === 'paused') {
            char.state = 'sleep'
            return
        }

        // Frame animation
        if (char.frameTimer >= 1000 / FPS) {
            char.frameTimer = 0
            char.frame = (char.frame + 1) % 8
        }

        switch (char.state) {
            case 'idle': {
                // Random decision to move or perform action
                if (Math.random() < 0.008) {
                    const dest = pickDestination(char)
                    if (dest) {
                        const curTx = Math.floor(char.x / TILE)
                        const curTy = Math.floor(char.y / TILE)
                        const path = bfs(curTx, curTy, dest.x, dest.y)
                        if (path.length > 0) {
                            char.path = path
                            char.pathIdx = 0
                            char.state = 'walk'
                        }
                    }
                }
                // Random idle action
                if (Math.random() < 0.003) {
                    char.state = Math.random() < 0.5 ? 'type' : 'read'
                    setTimeout(() => {
                        if (char.state === 'type' || char.state === 'read') char.state = 'idle'
                    }, 3000 + Math.random() * 5000)
                }
                break
            }
            case 'walk': {
                if (char.pathIdx >= char.path.length) {
                    char.state = 'idle'
                    break
                }
                const target = char.path[char.pathIdx]!
                const targetX = target.x * TILE
                const targetY = target.y * TILE
                const speed = 1.5

                const dx = targetX - char.x
                const dy = targetY - char.y

                if (Math.abs(dx) > speed) char.x += Math.sign(dx) * speed
                else char.x = targetX

                if (Math.abs(dy) > speed) char.y += Math.sign(dy) * speed
                else char.y = targetY

                // Update direction
                if (Math.abs(dx) > Math.abs(dy)) {
                    char.dir = dx > 0 ? 'right' : 'left'
                } else if (dy !== 0) {
                    char.dir = dy > 0 ? 'down' : 'up'
                }

                if (char.x === targetX && char.y === targetY) {
                    char.tx = target.x
                    char.ty = target.y
                    char.pathIdx++
                }
                break
            }
            case 'celebrate': {
                if (Math.random() < 0.02) char.state = 'idle'
                break
            }
            // type, read, sleep — handled by timers
        }
    }, [pickDestination])

    // ── EventBus integration ──
    useEffect(() => {
        const chars = charsRef.current

        const unsubThought = eventBus.on('agent:thought', (event) => {
            const char = chars.get(event.source)
            if (char) {
                char.state = 'type'
                setTimeout(() => { if (char.state === 'type') char.state = 'idle' }, 4000)
            }
        })

        const unsubPost = eventBus.on('community:post_created', (event) => {
            const char = chars.get(event.source)
            if (char) {
                char.speech = event.payload?.title || 'Posted something!'
                char.speechTimer = 5000
                char.state = 'celebrate'
                addLog(`${event.sourceName} posted: "${event.payload?.title}"`)
            }
        })

        const unsubReply = eventBus.on('community:reply_created', (event) => {
            const char = chars.get(event.source)
            if (char) {
                char.speech = `Replied to "${(event.payload?.postTitle || '').slice(0, 20)}"`
                char.speechTimer = 4000
                addLog(`${event.sourceName} replied to: "${event.payload?.postTitle}"`)
            }
        })

        return () => {
            unsubThought()
            unsubPost()
            unsubReply()
        }
    }, [addLog])

    // ── Game loop ──
    useEffect(() => {
        syncAgents()
        const syncInterval = setInterval(syncAgents, 5000)

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size
        canvas.width = GRID_W * TILE
        canvas.height = GRID_H * TILE

        lastTickRef.current = performance.now()

        const gameLoop = (now: number) => {
            const dt = now - lastTickRef.current
            lastTickRef.current = now

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Draw world
            drawWorld(ctx)

            // Update & draw characters (sorted by Y for proper overlap)
            const chars = Array.from(charsRef.current.values()).sort((a, b) => a.y - b.y)
            for (const char of chars) {
                updateCharacter(char, dt)
                drawCharacter(ctx, char)
            }

            // Info overlay
            ctx.fillStyle = 'rgba(0,0,0,0.6)'
            ctx.fillRect(0, 0, 180, 20)
            ctx.fillStyle = '#fff'
            ctx.font = '10px Inter, system-ui, sans-serif'
            ctx.textAlign = 'left'
            ctx.fillText(`🌐 SylOS Civilization — ${chars.length} Citizens`, 6, 14)

            animRef.current = requestAnimationFrame(gameLoop)
        }

        animRef.current = requestAnimationFrame(gameLoop)

        return () => {
            cancelAnimationFrame(animRef.current)
            clearInterval(syncInterval)
        }
    }, [syncAgents, updateCharacter])

    // Handle canvas click to select agent
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        const mx = (e.clientX - rect.left) * scaleX
        const my = (e.clientY - rect.top) * scaleY

        for (const char of charsRef.current.values()) {
            if (mx >= char.x && mx <= char.x + TILE && my >= char.y && my <= char.y + TILE) {
                setSelectedAgent({ ...char })
                return
            }
        }
        setSelectedAgent(null)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f0f1a', color: '#e5e7eb', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #1e1e30', background: '#141422' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🏙️</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Pixel Agent World</span>
                    <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>
                        {agentCount} citizen{agentCount !== 1 ? 's' : ''} active
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#8b5cf6', background: '#1e1033', padding: '2px 8px', borderRadius: 4 }}>LIVE</span>
                </div>
            </div>

            {/* Canvas + Sidebar */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Canvas */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                    <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        style={{
                            imageRendering: 'pixelated',
                            width: '100%',
                            maxWidth: GRID_W * TILE * 2,
                            height: 'auto',
                            borderRadius: 8,
                            border: '1px solid #1e1e30',
                            cursor: 'pointer',
                        }}
                    />
                </div>

                {/* Sidebar */}
                <div style={{ width: 220, borderLeft: '1px solid #1e1e30', background: '#141422', overflow: 'auto', padding: '8px 0' }}>
                    {/* Selected agent info */}
                    {selectedAgent && (
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e1e30', marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {ROLE_ICONS[selectedAgent.role] || '🤖'} {selectedAgent.name}
                            </div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                Role: {selectedAgent.role}<br />
                                Rep: {selectedAgent.reputation}/10000<br />
                                Status: {selectedAgent.status}<br />
                                State: {selectedAgent.state}
                            </div>
                        </div>
                    )}

                    {/* Activity log */}
                    <div style={{ padding: '4px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>📋 Activity Log</div>
                        {activityLog.length === 0 && (
                            <div style={{ fontSize: 10, color: '#4b5563', fontStyle: 'italic' }}>
                                Watching for agent activity...
                            </div>
                        )}
                        {activityLog.map((log, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#9ca3af', padding: '3px 0', borderBottom: '1px solid #1a1a2e' }}>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PixelWorldApp
