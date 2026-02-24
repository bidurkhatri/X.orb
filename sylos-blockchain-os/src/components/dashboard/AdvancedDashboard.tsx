import { useState, useEffect } from 'react'
import { useAccount, useBalance, useBlockNumber } from 'wagmi'
import { BarChart3, TrendingUp, Wallet, Activity, Cpu, HardDrive, Shield, Zap, RefreshCw, Circle } from 'lucide-react'

const cs = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' } as React.CSSProperties,
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  return (
    <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / range) * 36}`).join(' ')}
      />
    </svg>
  )
}

export default function AdvancedDashboard() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const [uptime, setUptime] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const chartData1 = [20, 35, 28, 45, 38, 52, 48, 60, 55, 70, 65, 75]
  const chartData2 = [10, 15, 12, 18, 22, 19, 25, 30, 28, 35, 32, 38]

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>Dashboard</h2>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>System overview and analytics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Circle size={8} fill="#34d399" color="#34d399" />
          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>System Online</span>
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { icon: <Wallet size={18} />, label: 'Balance', value: balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '—', color: '#818cf8', sub: isConnected ? 'Connected' : 'Not connected' },
          { icon: <Activity size={18} />, label: 'Block Height', value: blockNumber ? `#${blockNumber.toString()}` : '—', color: '#34d399', sub: 'Polygon PoS' },
          { icon: <Zap size={18} />, label: 'Session Uptime', value: fmtUptime(uptime), color: '#f59e0b', sub: 'Active' },
          { icon: <Shield size={18} />, label: 'Network', value: 'Polygon', color: '#ec4899', sub: 'Chain ID 137' },
        ].map((stat, i) => (
          <div key={i} style={cs.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ color: stat.color }}>{stat.icon}</span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: '17px', fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", marginBottom: '4px' }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={cs.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Transaction Activity</h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Last 12 hours</p>
            </div>
            <TrendingUp size={16} color="#34d399" />
          </div>
          <MiniChart data={chartData1} color="#34d399" />
        </div>
        <div style={cs.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>Gas Usage</h3>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>Average gas price</p>
            </div>
            <BarChart3 size={16} color="#818cf8" />
          </div>
          <MiniChart data={chartData2} color="#818cf8" />
        </div>
      </div>

      {/* System status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={cs.card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>System Resources</h3>
          {[
            { label: 'CPU', value: 12, color: '#34d399', icon: <Cpu size={14} /> },
            { label: 'Memory', value: 34, color: '#818cf8', icon: <HardDrive size={14} /> },
            { label: 'Storage', value: 8, color: '#f59e0b', icon: <HardDrive size={14} /> },
          ].map((r, i) => (
            <div key={i} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ color: r.color }}>{r.icon}</span> {r.label}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: r.color }}>{r.value}%</span>
              </div>
              <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ height: '100%', width: `${r.value}%`, borderRadius: '2px', background: r.color, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={cs.card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Active Services</h3>
          {[
            { name: 'Wallet Provider', status: 'running', color: '#34d399' },
            { name: 'IPFS Gateway', status: 'running', color: '#34d399' },
            { name: 'Message Relay', status: 'idle', color: '#f59e0b' },
            { name: 'Agent Runtime', status: 'standby', color: 'rgba(255,255,255,0.25)' },
            { name: 'PoP Tracker', status: 'running', color: '#34d399' },
          ].map((svc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{svc.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Circle size={6} fill={svc.color} color={svc.color} />
                <span style={{ fontSize: '11px', color: svc.color, fontWeight: 500 }}>{svc.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}