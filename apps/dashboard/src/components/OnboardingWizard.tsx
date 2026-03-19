import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Wallet, Code, ChevronRight, X, Check, ExternalLink } from 'lucide-react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseAbi } from 'viem'
import { projectId } from '../lib/wallet'

const STEPS = [
  { icon: Key, title: 'API Key Ready', description: 'Your API key is active and authenticated.' },
  { icon: Wallet, title: 'Approve USDC', description: 'Allow X.orb to charge your wallet for agent actions.' },
  { icon: Code, title: 'Install SDK', description: 'Register agents and execute actions via code.' },
]

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { address } = useAccount()

  const apiKey = sessionStorage.getItem('xorb_api_key') || ''
  const maskedKey = apiKey ? apiKey.slice(0, 8) + '••••••••' + apiKey.slice(-4) : ''

  const { writeContract, isPending: isApproving } = useWriteContract()

  const { data: allowance } = useReadContract({
    address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
    functionName: 'allowance',
    args: [address!, '0xF41faE67716670edBFf581aEe37014307dF71A9B'],
    query: { enabled: !!address },
  })

  const hasAllowance = allowance !== undefined && allowance > BigInt(0)

  const handleApprove = () => {
    writeContract({
      address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC on Polygon
      abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
      functionName: 'approve',
      args: [
        '0xF41faE67716670edBFf581aEe37014307dF71A9B', // facilitator
        BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935'), // maxUint256
      ],
    })
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      sessionStorage.setItem('xorb_onboarded', 'true')
      onComplete()
      navigate('/agents')
    }
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

            {/* Step 1: API Key confirmation */}
            {step === 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                  <Check size={16} className="text-green-400 shrink-0" />
                  <span className="text-xs text-green-400">API key active</span>
                </div>
                {maskedKey && (
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <code className="text-xs text-xorb-muted font-mono">{maskedKey}</code>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: USDC Approval */}
            {step === 1 && (
              <div className="mt-4 space-y-3">
                {address ? (
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                    <Wallet size={14} className="text-xorb-muted shrink-0" />
                    <code className="text-xs text-xorb-muted font-mono">{address.slice(0, 6)}...{address.slice(-4)}</code>
                  </div>
                ) : (
                  <p className="text-xs text-yellow-400">Connect your wallet to approve USDC spending.</p>
                )}

                {hasAllowance ? (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <Check size={16} className="text-green-400 shrink-0" />
                    <span className="text-xs text-green-400">USDC spending approved</span>
                  </div>
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={!address || isApproving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-xorb-blue hover:bg-xorb-blue-hover disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {isApproving ? 'Approving...' : 'Approve USDC'}
                  </button>
                )}
              </div>
            )}

            {/* Step 3: Install SDK */}
            {step === 2 && (
              <div className="mt-4 space-y-3">
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono text-green-400">npm install xorb-sdk</code>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 overflow-x-auto">
                  <pre className="text-xs font-mono text-xorb-muted leading-relaxed">{`import { XorbClient, PaymentSigner } from 'xorb-sdk'

const signer = new PaymentSigner({
  privateKey: process.env.SPONSOR_KEY,
})

const xorb = new XorbClient({
  apiUrl: 'https://api.xorb.xyz',
  apiKey: 'xorb_sk_...',
  signer,
})`}</pre>
                </div>
                <a
                  href="https://api.xorb.xyz/v1/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-xorb-blue hover:underline"
                >
                  Full SDK documentation <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button onClick={handleSkip} className="text-sm text-xorb-muted hover:text-white">
            Skip setup
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors"
          >
            {step === 2 ? 'Done' : 'Continue'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
