import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Shield, ChevronRight, X } from 'lucide-react'
import { API_BASE } from '../lib/api'
import { useAccount } from 'wagmi'
import { projectId } from '../lib/wallet'

const STEPS = [
  { icon: Bot, title: 'Create your first agent', description: 'Register an AI agent with a name and your wallet address.' },
  { icon: Shield, title: 'You\'re all set', description: 'Your agent is registered. Start executing actions via the API.' },
]

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agentName, setAgentName] = useState('')
  const account = useAccount()
  const walletAddress = projectId ? account.address : undefined
  const [sponsorAddress, setSponsorAddress] = useState('')
  const navigate = useNavigate()

  // Auto-fill from connected wallet
  const effectiveAddress = walletAddress || sponsorAddress

  const handleStep1 = async () => {
    if (!agentName.trim() || agentName.length < 2) {
      setError('Agent name must be at least 2 characters')
      return
    }
    if (!effectiveAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Connect your wallet or enter a valid Ethereum address')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/v1/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('xorb_api_key') || '' },
        body: JSON.stringify({
          name: agentName.trim(),
          scope: 'general',
          sponsor_address: effectiveAddress,
          description: 'Created during onboarding',
        }),
      })
      const data = await res.json()
      const agent = data.data?.agent || data.agent || data.data || data
      if (agent?.agentId) {
        setAgentId(agent.agentId)
        setStep(1)
      } else {
        setError(data.error?.message || data.error || 'Failed to create agent. Check your inputs.')
      }
    } catch {
      setError('Cannot reach API server.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = () => {
    sessionStorage.setItem('xorb_onboarded', 'true')
    onComplete()
    navigate(`/agents`)
  }

  const handleSkip = () => {
    sessionStorage.setItem('xorb_onboarded', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <div className="glass-card p-8 w-full max-w-lg relative">
        <button onClick={handleSkip} className="absolute top-4 right-4 text-xorb-muted hover:text-white">
          <X size={18} />
        </button>

        <h2 className="text-xl font-bold mb-1">Welcome to X.orb</h2>
        <p className="text-sm text-xorb-muted mb-6">Let's get you set up in 3 steps.</p>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-xorb-blue' : 'bg-white/10'}`} />
          ))}
        </div>

        {/* Current Step */}
        <div className="flex items-start gap-4 mb-6">
          {(() => { const Icon = STEPS[step].icon; return <Icon size={24} className="text-xorb-blue shrink-0" /> })()}
          <div className="flex-1">
            <h3 className="font-medium">{STEPS[step].title}</h3>
            <p className="text-sm text-xorb-muted mt-1">{STEPS[step].description}</p>

            {/* Step 1: Agent creation form */}
            {step === 0 && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs text-xorb-muted mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={e => setAgentName(e.target.value)}
                    placeholder="my-research-bot"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-xorb-blue/50"
                  />
                </div>
                {walletAddress ? (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-green-400">Wallet connected:</span>
                    <code className="text-xs text-green-300 font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</code>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-xorb-muted mb-1">Your Wallet Address</label>
                    <input
                      type="text"
                      value={sponsorAddress}
                      onChange={e => setSponsorAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-xorb-blue/50"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Success */}
            {step === 1 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-green-400">Your agent is registered and ready.</p>
                <p className="text-xs text-xorb-muted">Agent ID: <code className="text-xorb-blue">{agentId}</code></p>
                <p className="text-xs text-xorb-muted">To execute actions, include an x402 payment header with each request. See the <a href="https://api.xorb.xyz/v1/docs" target="_blank" rel="noopener noreferrer" className="text-xorb-blue hover:underline">API docs</a> for details.</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <div className="flex justify-between items-center">
          <button onClick={handleSkip} className="text-sm text-xorb-muted hover:text-white">
            Skip setup
          </button>
          <button
            onClick={step === 0 ? handleStep1 : handleStep2}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Working...' : step === 1 ? 'View Agents' : 'Continue'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
