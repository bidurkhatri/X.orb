import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Zap, Shield, ChevronRight, X } from 'lucide-react'
import { api, API_BASE } from '../lib/api'

const STEPS = [
  { icon: Bot, title: 'Create your first agent', description: 'Register an AI agent with a name, role, and wallet address.' },
  { icon: Zap, title: 'Run a test action', description: 'Execute an action through the 8-gate security pipeline.' },
  { icon: Shield, title: 'View your audit log', description: 'See the cryptographic audit trail for your agent.' },
]

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [agentName, setAgentName] = useState('')
  const [sponsorAddress, setSponsorAddress] = useState('')
  const navigate = useNavigate()

  const handleStep1 = async () => {
    if (!agentName.trim() || agentName.length < 2) {
      setError('Agent name must be at least 2 characters')
      return
    }
    if (!sponsorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError('Enter a valid Ethereum address (0x + 40 hex characters)')
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
          sponsor_address: sponsorAddress,
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

  const handleStep2 = async () => {
    if (!agentId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/v1/actions/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sessionStorage.getItem('xorb_api_key') || '' },
        body: JSON.stringify({
          agent_id: agentId,
          action: 'test_query',
          tool: 'get_balance',
          params: { address: sponsorAddress },
        }),
      })
      const data = await res.json()
      if (data.approved || data.action_id) {
        setStep(2)
      } else {
        // Action may require payment (402) — still show success for onboarding
        if (data.payment_required) {
          setStep(2) // Show audit log even if 402 — agent was created
        } else {
          setError('Action was blocked by the pipeline. Check your agent status.')
        }
      }
    } catch {
      setError('Cannot reach API server.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = () => {
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
              </div>
            )}

            {/* Step 2: Pipeline info */}
            {step === 1 && (
              <p className="mt-3 text-xs text-xorb-muted">
                Agent <code className="text-xorb-blue">{agentId}</code> will run through all 8 gates.
              </p>
            )}

            {/* Step 3: Success */}
            {step === 2 && (
              <p className="mt-3 text-xs text-green-400">
                Your agent is registered and ready. View your agents to manage it.
              </p>
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
            onClick={step === 0 ? handleStep1 : step === 1 ? handleStep2 : handleStep3}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Working...' : step === 2 ? 'View Agents' : 'Continue'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
