import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ApiErrorProps {
  message: string
  suggestion?: string
  onRetry?: () => void
}

export function ApiError({ message, suggestion, onRetry }: ApiErrorProps) {
  // Map raw API errors to human-readable messages
  const friendly = getFriendlyMessage(message)

  return (
    <div className="glass-card p-6 border border-red-500/20">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-400">{friendly.title}</p>
          <p className="text-sm text-xorb-muted mt-1">{friendly.description}</p>
          {suggestion && (
            <p className="text-xs text-xorb-muted mt-2">{suggestion}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Try Again
              </button>
            )}
            <a
              href="mailto:support@xorb.xyz"
              className="text-xs text-xorb-muted hover:text-xorb-text transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function getFriendlyMessage(raw: string): { title: string; description: string } {
  if (raw.includes('Missing x-api-key') || raw.includes('Invalid API key')) {
    return { title: 'Authentication Required', description: 'Please check your API key in Settings.' }
  }
  if (raw.includes('Forbidden') || raw.includes('do not own')) {
    return { title: 'Access Denied', description: 'You don\'t have permission to access this resource.' }
  }
  if (raw.includes('not found') || raw.includes('Not found')) {
    return { title: 'Not Found', description: 'The requested resource doesn\'t exist or has been removed.' }
  }
  if (raw.includes('Rate limit') || raw.includes('Too Many')) {
    return { title: 'Rate Limit Exceeded', description: 'Please wait a moment before trying again.' }
  }
  if (raw.includes('Payment Required') || raw.includes('402')) {
    return { title: 'Payment Required', description: 'Your free tier is exhausted. Set up USDC payments to continue.' }
  }
  if (raw.includes('500') || raw.includes('Internal')) {
    return { title: 'Server Error', description: 'Something went wrong on our end. Please try again later.' }
  }
  return { title: 'Error', description: raw }
}
