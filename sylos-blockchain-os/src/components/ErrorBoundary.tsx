/**
 * React Error Boundary components for handling runtime errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { errorLogger, ErrorInfo as SylosErrorInfo, LoggedError } from '../utils/errorHandler'
import { envManager } from '../utils/environment'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'critical'
  enableRetry?: boolean
  enableReport?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  isRetrying: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
    isRetrying: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.logError(error, errorInfo)
    
    this.setState({
      errorInfo,
      errorId
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // Report critical errors in production
    if (this.props.level === 'critical' && envManager.isProduction()) {
      this.reportCriticalError(error, errorInfo, errorId)
    }
  }

  public componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  private logError(error: Error, errorInfo: ErrorInfo): string {
    const context: SylosErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.getBoundaryName(),
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    const loggedError = errorLogger.log(error, context)
    return loggedError.id
  }

  private getBoundaryName(): string {
    switch (this.props.level) {
      case 'page':
        return 'PageErrorBoundary'
      case 'component':
        return 'ComponentErrorBoundary'
      case 'critical':
        return 'CriticalErrorBoundary'
      default:
        return 'ErrorBoundary'
    }
  }

  private reportCriticalError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    // In a real app, this would send to a monitoring service
    console.error(`Critical error reported (ID: ${errorId})`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })
  }

  private handleRetry = () => {
    this.setState({ isRetrying: true })
    
    // Add a small delay to prevent immediate retries
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        isRetrying: false
      })
    }, 1000)
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI based on level
      return this.getDefaultErrorUI()
    }

    return this.props.children
  }

  private getDefaultErrorUI() {
    const { level = 'component' } = this.props

    switch (level) {
      case 'critical':
        return this.getCriticalErrorUI()
      case 'page':
        return this.getPageErrorUI()
      default:
        return this.getComponentErrorUI()
    }
  }

  private getCriticalErrorUI() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900 to-red-700">
        <div className="text-center p-8 bg-white/10 backdrop-blur-lg rounded-2xl max-w-md">
          <Bug className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            Critical System Error
          </h1>
          <p className="text-red-200 mb-6">
            Something went wrong. Please restart the application.
          </p>
          <div className="space-y-3">
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
            >
              Restart Application
            </button>
            <button
              onClick={this.handleGoHome}
              className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 text-white rounded-lg font-semibold transition-colors"
            >
              Go to Home
            </button>
          </div>
          {envManager.isDevelopment() && this.state.error && (
            <details className="mt-4 text-left">
              <summary className="text-red-200 cursor-pointer">Error Details</summary>
              <pre className="text-xs text-red-200 mt-2 p-2 bg-black/20 rounded overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }

  private getPageErrorUI() {
    return (
      <div className="h-screen flex items-center justify-center bg-sylos-dark">
        <div className="text-center p-8 max-w-md">
          <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            Page Error
          </h1>
          <p className="text-gray-300 mb-6">
            We encountered an error loading this page. Please try again.
          </p>
          <div className="space-y-3">
            {this.props.enableRetry !== false && (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="w-full py-3 px-4 bg-sylos-primary hover:bg-sylos-primary/80 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {this.state.isRetrying ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Try Again
              </button>
            )}
            <button
              onClick={this.handleGoHome}
              className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  private getComponentErrorUI() {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800 mb-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">Component Error</span>
        </div>
        <p className="text-red-600 text-sm mb-3">
          This component encountered an error and couldn't render properly.
        </p>
        {this.props.enableRetry !== false && (
          <button
            onClick={this.handleRetry}
            disabled={this.state.isRetrying}
            className="text-sm py-2 px-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded transition-colors flex items-center gap-2"
          >
            {this.state.isRetrying ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Retry
          </button>
        )}
        {envManager.isDevelopment() && this.state.error && (
          <details className="mt-2">
            <summary className="text-xs text-red-500 cursor-pointer">Details</summary>
            <pre className="text-xs text-red-400 mt-1 p-1 bg-red-100 rounded overflow-auto">
              {this.state.error.message}
            </pre>
          </details>
        )}
      </div>
    )
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for manual error reporting
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    if (envManager.shouldEnableErrorLogging()) {
      errorLogger.log(error, {
        componentStack: errorInfo?.componentStack,
        errorBoundary: 'manual',
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }, [])
}