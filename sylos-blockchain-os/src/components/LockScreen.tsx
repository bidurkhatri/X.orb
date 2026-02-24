import { Shield, Zap, Globe, ChevronRight, Wallet } from 'lucide-react'
import { useAccount, useBlockNumber } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useEffect, useState, useCallback } from 'react'

interface LockScreenProps {
  onUnlock: () => void
}

export default function LockScreen({ onUnlock }: LockScreenProps) {
  const { isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const [time, setTime] = useState(new Date())
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    if (isConnected) onUnlock()
  }, [isConnected, onUnlock])

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleConnect = useCallback(() => {
    openConnectModal?.()
  }, [openConnectModal])

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, #0a0e27 0%, #1a0a2e 25%, #0d1b3e 50%, #1a0a2e 75%, #0a0e27 100%)',
      fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
    }}>
      {/* Animated mesh gradient orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%', width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float1 15s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(80px)', animation: 'float2 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: '50%', width: '400px', height: '400px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(60px)', animation: 'float3 12s ease-in-out infinite',
        }} />
      </div>

      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '36px', maxWidth: '500px', width: '100%', padding: '0 24px',
      }}>
        {/* Clock */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '72px', fontWeight: 200, letterSpacing: '4px', color: '#ffffff',
            lineHeight: 1, textShadow: '0 0 40px rgba(99, 102, 241, 0.3)',
          }}>
            {formatTime(time)}
          </div>
          <div style={{
            fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.5)',
            marginTop: '8px', letterSpacing: '2px', textTransform: 'uppercase',
          }}>
            {formatDate(time)}
          </div>
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            <Shield size={36} color="#818cf8" strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{
              fontSize: '36px', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              SylOS
            </h1>
            <p style={{
              fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              margin: '4px 0 0 0', letterSpacing: '3px', textTransform: 'uppercase',
            }}>
              Blockchain Operating System
            </p>
          </div>
        </div>

        {/* Live block indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 20px', borderRadius: '100px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: blockNumber ? '#22c55e' : '#f59e0b',
            boxShadow: blockNumber ? '0 0 8px #22c55e' : '0 0 8px #f59e0b',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', 'SF Mono', monospace" }}>
            Block #{blockNumber ? Number(blockNumber).toLocaleString() : '...'}
          </span>
        </div>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          style={{
            width: '100%', maxWidth: '340px', padding: '16px 32px',
            borderRadius: '16px', border: 'none', cursor: 'pointer',
            background: isHovering
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)'
              : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #8b5cf6 100%)',
            color: '#ffffff', fontSize: '16px', fontWeight: 600, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isHovering ? 'translateY(-2px)' : 'translateY(0)',
            boxShadow: isHovering
              ? '0 20px 40px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset'
              : '0 8px 24px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(255,255,255,0.05) inset',
            letterSpacing: '0.3px',
          }}
        >
          <Wallet size={20} />
          Connect Wallet
          <ChevronRight size={16} style={{ opacity: 0.7 }} />
        </button>

        <p style={{
          fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'center',
          maxWidth: '300px', lineHeight: 1.5, margin: 0,
        }}>
          Connect MetaMask, WalletConnect, or Coinbase Wallet
        </p>

        {/* Feature badges */}
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: <Zap size={14} />, label: 'Zero Gas Fees' },
            { icon: <Globe size={14} />, label: 'Polygon L2' },
            { icon: <Shield size={14} />, label: 'Non-Custodial' },
          ].map((badge) => (
            <div key={badge.label} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 500,
            }}>
              <span style={{ color: 'rgba(139, 92, 246, 0.6)' }}>{badge.icon}</span>
              {badge.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.2)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.5px' }}>
          SylOS v1.0 · Proof of Productivity
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>
          Polygon Mainnet
        </span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;400;500;600;700&display=swap');
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-30px) scale(1.1); } 66% { transform: translate(-20px,20px) scale(0.9); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(-40px,20px) scale(1.15); } 66% { transform: translate(30px,-30px) scale(0.85); } }
        @keyframes float3 { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.2); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
