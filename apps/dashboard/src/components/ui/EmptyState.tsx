import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  docLink?: string
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, docLink }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon size={28} className="text-xorb-muted" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-xorb-muted max-w-md mb-6">{description}</p>
      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-xorb-blue hover:bg-xorb-blue-hover rounded-lg text-sm font-medium transition-colors"
          >
            {actionLabel}
          </button>
        )}
        {docLink && (
          <a
            href={docLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-xorb-muted transition-colors"
          >
            View Documentation
          </a>
        )}
      </div>
    </div>
  )
}
