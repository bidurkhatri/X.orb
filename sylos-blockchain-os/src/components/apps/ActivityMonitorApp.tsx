import { useState, useEffect, useCallback } from 'react'
import { Cpu, MemoryStick, HardDrive, Wifi, Activity, Zap, RefreshCw, X, Clock } from 'lucide-react'

interface ProcessInfo {
    pid: number
    name: string
    cpu: number
    mem: number
    status: 'running' | 'sleeping' | 'idle'
}

function getSystemProcesses(): ProcessInfo[] {
    const p = performance as any
    const entries = p.getEntriesByType?.('navigation') || []
    const loadTime = entries[0]?.loadEventEnd || 0
    const uptime = (performance.now() / 1000).toFixed(0)

    return [
        { pid: 1, name: 'SylOS Kernel', cpu: 0.3, mem: 12.4, status: 'running' },
        { pid: 2, name: 'Web3Provider (wagmi)', cpu: 0.8, mem: 24.6, status: 'running' },
        { pid: 3, name: 'RainbowKit Connector', cpu: 0.1, mem: 8.2, status: 'sleeping' },
        { pid: 4, name: 'Supabase Realtime', cpu: 0.2, mem: 6.8, status: 'running' },
        { pid: 5, name: 'XMTP Protocol', cpu: 0.0, mem: 4.1, status: 'idle' },
        { pid: 6, name: 'Agent Supervisor Daemon', cpu: 0.4, mem: 18.3, status: 'running' },
        { pid: 7, name: 'IPFS Pinning Service', cpu: 0.0, mem: 3.2, status: 'idle' },
        { pid: 8, name: 'Desktop Compositor', cpu: 1.2, mem: 32.1, status: 'running' },
        { pid: 9, name: 'Window Manager', cpu: 0.6, mem: 14.7, status: 'running' },
        { pid: 10, name: 'React Renderer', cpu: 2.1, mem: 45.3, status: 'running' },
        { pid: 11, name: 'Vite HMR Client', cpu: 0.1, mem: 5.8, status: 'sleeping' },
        { pid: 12, name: 'Polygon RPC Gateway', cpu: 0.3, mem: 7.4, status: 'running' },
    ]
}

function useLiveMetrics() {
    const [metrics, setMetrics] = useState({
        cpuTotal: 0, memUsed: 0, memTotal: 256,
        netDown: 0, netUp: 0,
        fps: 60, uptime: '0s',
    })

    useEffect(() => {
        const update = () => {
            const procs = getSystemProcesses()
            const cpuTotal = procs.reduce((a, p) => a + p.cpu, 0)
            const memUsed = procs.reduce((a, p) => a + p.mem, 0)
            const up = Math.floor(performance.now() / 1000)
            const min = Math.floor(up / 60)
            const hr = Math.floor(min / 60)
            const uptime = hr > 0 ? `${hr}h ${min % 60}m` : min > 0 ? `${min}m ${up % 60}s` : `${up}s`

            setMetrics({
                cpuTotal: Math.min(100, cpuTotal + (Math.sin(Date.now() / 3000) * 2)),
                memUsed,
                memTotal: 256,
                netDown: 12 + Math.sin(Date.now() / 2000) * 8,
                netUp: 3 + Math.sin(Date.now() / 4000) * 2,
                fps: 58 + Math.floor(Math.sin(Date.now() / 5000) * 2),
                uptime,
            })
        }
        update()
        const i = setInterval(update, 2000)
        return () => clearInterval(i)
    }, [])

    return metrics
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100)
    return (
        <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: color, transition: 'width 0.5s ease' }} />
        </div>
    )
}

export default function ActivityMonitorApp() {
    const metrics = useLiveMetrics()
    const [procs] = useState(getSystemProcesses)
    const [sortBy, setSortBy] = useState<'cpu' | 'mem' | 'name'>('cpu')

    const sorted = [...procs].sort((a, b) =>
        sortBy === 'cpu' ? b.cpu - a.cpu : sortBy === 'mem' ? b.mem - a.mem : a.name.localeCompare(b.name)
    )

    const statCards = [
        { label: 'CPU', value: `${metrics.cpuTotal.toFixed(1)}%`, icon: <Cpu size={16} />, color: '#6366f1', bar: { value: metrics.cpuTotal, max: 100 } },
        { label: 'Memory', value: `${metrics.memUsed.toFixed(0)} MB`, icon: <MemoryStick size={16} />, color: '#22c55e', bar: { value: metrics.memUsed, max: metrics.memTotal } },
        { label: 'Network', value: `↓${metrics.netDown.toFixed(0)} ↑${metrics.netUp.toFixed(0)} KB/s`, icon: <Wifi size={16} />, color: '#06b6d4', bar: { value: metrics.netDown, max: 100 } },
        { label: 'FPS', value: `${metrics.fps}`, icon: <Activity size={16} />, color: '#f59e0b', bar: { value: metrics.fps, max: 60 } },
    ]

    const statusColors: Record<string, string> = { running: '#22c55e', sleeping: '#f59e0b', idle: '#64748b' }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f1328', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' }}>
            {/* Header stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {statCards.map(s => (
                    <div key={s.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                            <span style={{ color: s.color, opacity: 0.5 }}>{s.icon}</span>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", marginBottom: '6px' }}>{s.value}</div>
                        <MiniBar value={s.bar.value} max={s.bar.max} color={s.color} />
                    </div>
                ))}
            </div>

            {/* Uptime */}
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <Clock size={12} /> Uptime: {metrics.uptime} · {procs.filter(p => p.status === 'running').length} active / {procs.length} total processes
            </div>

            {/* Process table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px 90px 70px', gap: '8px', padding: '8px 16px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'sticky', top: 0, background: '#0f1328', zIndex: 1 }}>
                    <span>PID</span>
                    <span style={{ cursor: 'pointer' }} onClick={() => setSortBy('name')}>Process {sortBy === 'name' && '↑'}</span>
                    <span style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => setSortBy('cpu')}>CPU {sortBy === 'cpu' && '↓'}</span>
                    <span style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => setSortBy('mem')}>Memory {sortBy === 'mem' && '↓'}</span>
                    <span style={{ textAlign: 'center' }}>Status</span>
                </div>

                {sorted.map(p => (
                    <div key={p.pid} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 70px 90px 70px', gap: '8px', padding: '8px 16px', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>{p.pid}</span>
                        <span style={{ color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: p.cpu > 1 ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>{p.cpu.toFixed(1)}%</span>
                        <span style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: p.mem > 30 ? '#6366f1' : 'rgba(255,255,255,0.4)' }}>{p.mem.toFixed(1)} MB</span>
                        <span style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '100px', fontSize: '9px', fontWeight: 600, background: `${statusColors[p.status]}15`, color: statusColors[p.status], textTransform: 'uppercase' }}>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: statusColors[p.status] }} />
                                {p.status}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
