/**
 * React Error Boundary components for handling runtime errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'
import { errorLogger, ErrorInfo as SylosErrorInfo } from '../utils/errorHandler'
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
    console.error(`Critical error reported (ID: ${errorId})`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    })
  }

  private handleRetry = () => {
    this.setState({ isRetrying: true })

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
      if (this.props.fallback) {
        return this.props.fallback
      }
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #7f1d1d, #991b1b)', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', padding: '32px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', borderRadius: '16px', maxWidth: '480px' }}>
          <Bug style={{ width: '64px', height: '64px', color: '#fca5a5', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            Critical System Error
          </h1>
          <p style={{ color: '#fecaca', marginBottom: '24px' }}>
            Something went wrong. Please restart the application.
          </p>
          {this.state.error && (
            <p style={{ color: '#fecaca', fontSize: '13px', marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={this.handleReload} style={{ width: '100%', padding: '12px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
              Restart Application
            </button>
            <button onClick={this.handleGoHome} style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  private getPageErrorUI() {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060918', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: 'center', padding: '32px', maxWidth: '480px' }}>
          <AlertTriangle style={{ width: '64px', height: '64px', color: '#facc15', margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
            Page Error
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
            We encountered an error loading this page.
          </p>
          {this.state.error && (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '24px', padding: '12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '8px', wordBreak: 'break-word', fontFamily: "'JetBrains Mono', monospace" }}>
              {this.state.error.message}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {this.props.enableRetry !== false && (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                style={{ width: '100%', padding: '12px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: this.state.isRetrying ? 0.5 : 1 }}
              >
                <RefreshCw style={{ width: '16px', height: '16px' }} />
                Try Again
              </button>
            )}
            <button
              onClick={this.handleGoHome}
              style={{ width: '100%', padding: '12px 16px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Home style={{ width: '16px', height: '16px' }} />
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  private getComponentErrorUI() {
    return (
      <div style={{ padding: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '12px', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', marginBottom: '8px' }}>
          <AlertTriangle style={{ width: '20px', height: '20px' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Component Error</span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>
          This component encountered an error and couldn't render properly.
        </p>
        {this.state.error && (
          <p style={{ color: '#f87171', fontSize: '12px', marginBottom: '12px', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-word' }}>
            {this.state.error.message}
          </p>
        )}
        {this.props.enableRetry !== false && (
          <button
            onClick={this.handleRetry}
            disabled={this.state.isRetrying}
            style={{ padding: '8px 12px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', opacity: this.state.isRetrying ? 0.5 : 1 }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            Retry
          </button>
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
