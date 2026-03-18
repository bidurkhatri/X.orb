import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Zap, Shield, ChevronRight, X } from 'lucide-react'
import { api } from '../lib/api'

const STEPS = [
  { icon: Bot, title: 'Create your first agent', description: 'Register an AI agent with a name, role, and trust bond.' },
  { icon: Zap, title: 'Run a test action', description: 'Execute an action through the 8-gate security pipeline.' },
  { icon: Shield, title: 'View your audit log', description: 'See the cryptographic audit trail for your agent.' },
]

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleStep1 = async () => {
    setLoading(true)
    setError('')
    try {
      const { agent } = await api.agents.register({
        name: 'My First Agent',
        role: 'RESEARCHER',
        sponsor_address: '0x0000000000000000000000000000000000000000',
        description: 'Onboarding test agent',
      })
      setAgentId(agent.agentId)
      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async () => {
    if (!agentId) return
    setLoading(true)
    setError('')
    try {
      await api.actions.execute({
        agent_id: agentId,
        action: 'test_query',
        tool: 'get_balance',
      })
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  const handleStep3 = () => {
    sessionStorage.setItem('xorb_onboarded', 'true')
    onComplete()
    navigate(`/audit`)
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
          <div>
            <h3 className="font-medium">{STEPS[step].title}</h3>
            <p className="text-sm text-xorb-muted mt-1">{STEPS[step].description}</p>
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
            {loading ? 'Working...' : step === 2 ? 'View Audit Log' : 'Continue'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
