/**
 * Loading states and user feedback components
 */

import React from 'react'
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

// Loading spinner component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  color?: 'primary' | 'secondary' | 'white' | 'gray'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  color = 'primary'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  }

  const colorClasses = {
    primary: 'text-sylos-primary',
    secondary: 'text-sylos-secondary',
    white: 'text-white',
    gray: 'text-gray-500'
  }

  return (
    <Loader2 
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
    />
  )
}

// Full page loading state
interface LoadingPageProps {
  message?: string
  progress?: number
  showProgress?: boolean
}

export const LoadingPage: React.FC<LoadingPageProps> = ({
  message = 'Loading...',
  progress,
  showProgress = false
}) => {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sylos-dark via-purple-900 to-sylos-dark">
      <div className="text-center space-y-6">
        <div className="relative">
          <LoadingSpinner size="xl" color="primary" />
          {showProgress && progress !== undefined && (
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="text-sm text-gray-400">{Math.round(progress)}%</div>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white">{message}</h2>
          {showProgress && progress !== undefined && (
            <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sylos-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <div className="text-sm text-gray-400 max-w-md">
          SylOS is initializing blockchain services and preparing your workspace...
        </div>
      </div>
    </div>
  )
}

// Inline loading state
interface LoadingInlineProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const LoadingInline: React.FC<LoadingInlineProps> = ({
  message,
  size = 'md',
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center gap-3 p-4 ${className}`}>
      <LoadingSpinner size={size} />
      {message && (
        <span className="text-gray-600 dark:text-gray-400">
          {message}
        </span>
      )}
    </div>
  )
}

// Skeleton loading components
export const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-gray-300 dark:bg-gray-700 rounded ${className}`} />
  )
}

export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <SkeletonLoader className="w-12 h-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <SkeletonLoader className="h-4 w-3/4" />
          <SkeletonLoader className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLoader className="h-32 w-full" />
    </div>
  )
}

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLoader 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} 
        />
      ))}
    </div>
  )
}

// Status indicators
export const StatusIndicator: React.FC<{
  status: 'loading' | 'success' | 'error' | 'warning'
  message?: string
  size?: 'sm' | 'md' | 'lg'
}> = ({ status, message, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const iconClasses = `${sizeClasses[size]}`

  const getStatusConfig = () => {
    switch (status) {
      case 'loading':
        return {
          icon: <LoadingSpinner size={size} />,
          bgColor: 'bg-blue-100 dark:bg-blue-900/20',
          textColor: 'text-blue-600 dark:text-blue-400'
        }
      case 'success':
        return {
          icon: <CheckCircle className={iconClasses} />,
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          textColor: 'text-green-600 dark:text-green-400'
        }
      case 'error':
        return {
          icon: <XCircle className={iconClasses} />,
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          textColor: 'text-red-600 dark:text-red-400'
        }
      case 'warning':
        return {
          icon: <AlertCircle className={iconClasses} />,
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          textColor: 'text-yellow-600 dark:text-yellow-400'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}>
      {config.icon}
      {message && (
        <span className={`text-sm ${config.textColor}`}>
          {message}
        </span>
      )}
    </div>
  )
}

// Toast notification component
export interface ToastProps {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number
  onClose: (id: string) => void
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id)
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [duration, id, onClose])

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          bgColor: 'bg-green-500',
          borderColor: 'border-green-600'
        }
      case 'error':
        return {
          icon: <XCircle className="w-5 h-5" />,
          bgColor: 'bg-red-500',
          borderColor: 'border-red-600'
        }
      case 'warning':
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bgColor: 'bg-yellow-500',
          borderColor: 'border-yellow-600'
        }
      default:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          bgColor: 'bg-blue-500',
          borderColor: 'border-blue-600'
        }
    }
  }

  const config = getToastConfig()

  return (
    <div className={`
      ${config.bgColor} text-white p-4 rounded-lg shadow-lg border-l-4 
      ${config.borderColor} max-w-sm w-full transform transition-all duration-300
      animate-in slide-in-from-right-full
    `}>
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{title}</h4>
          {message && (
            <p className="text-sm opacity-90 mt-1">{message}</p>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className="text-white/80 hover:text-white transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Toast container
export const ToastContainer: React.FC<{
  toasts: ToastProps[]
  onCloseToast: (id: string) => void
}> = ({ toasts, onCloseToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={onCloseToast}
        />
      ))}
    </div>
  )
}

// Hook for managing loading states
export function useAsyncOperation<T>() {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  const execute = React.useCallback(async (operation: () => Promise<T>) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await operation()
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = React.useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    data,
    loading,
    error,
    execute,
    reset
  }
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = React.useState<Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message?: string
    duration?: number
  }>>([])

  const addToast = React.useCallback((
    type: 'info' | 'success' | 'warning' | 'error',
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setToasts(prev => [...prev, { id, type, title, message, duration }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = React.useCallback((title: string, message?: string) => {
    addToast('success', title, message)
  }, [addToast])

  const error = React.useCallback((title: string, message?: string) => {
    addToast('error', title, message)
  }, [addToast])

  const warning = React.useCallback((title: string, message?: string) => {
    addToast('warning', title, message)
  }, [addToast])

  const info = React.useCallback((title: string, message?: string) => {
    addToast('info', title, message)
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }
}