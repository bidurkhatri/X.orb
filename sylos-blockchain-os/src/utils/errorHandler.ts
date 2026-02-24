/**
 * Centralized error handling and logging utilities
 */

export interface ErrorInfo {
  componentStack: string
  errorBoundary: string
  timestamp: Date
  userAgent: string
  url: string
  userId?: string
}

export interface LoggedError extends Error {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, unknown>
  stack?: string
}

export class SylosError extends Error {
  public readonly id: string
  public readonly severity: LoggedError['severity']
  public readonly context?: Record<string, unknown>
  public readonly timestamp: Date

  constructor(
    message: string,
    severity: LoggedError['severity'] = 'medium',
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'SylosError'
    this.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.severity = severity
    this.context = context
    this.timestamp = new Date()
    Error.captureStackTrace(this, SylosError)
  }
}

export class ValidationError extends SylosError {
  public readonly field: string
  public readonly value: unknown

  constructor(field: string, value: unknown, message?: string) {
    super(
      message || `Validation failed for field '${field}': ${value}`,
      'medium',
      { field, value }
    )
    this.name = 'ValidationError'
    this.field = field
    this.value = value
  }
}

export class NetworkError extends SylosError {
  public readonly statusCode?: number
  public readonly endpoint: string

  constructor(endpoint: string, message: string, statusCode?: number) {
    super(`Network error on ${endpoint}: ${message}`, statusCode >= 500 ? 'high' : 'medium', {
      endpoint,
      statusCode
    })
    this.name = 'NetworkError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}

export class WalletError extends SylosError {
  public readonly walletType: string
  public readonly action: string

  constructor(walletType: string, action: string, message: string) {
    super(`Wallet ${action} failed (${walletType}): ${message}`, 'high', {
      walletType,
      action
    })
    this.name = 'WalletError'
    this.walletType = walletType
    this.action = action
  }
}

// Error logging service
class ErrorLogger {
  private static instance: ErrorLogger
  private errors: LoggedError[] = []
  private maxErrors = 100

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }

  log(error: Error, context?: ErrorInfo): LoggedError {
    const loggedError: LoggedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity: this.getSeverity(error),
      context: this.getContext(context),
    }

    this.errors.push(loggedError as LoggedError)
    
    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // Console log for development
    if (import.meta.env.DEV) {
      console.error('[SylOS Error]', loggedError)
    }

    // In production, send to logging service
    if (import.meta.env.PROD) {
      this.sendToLoggingService(loggedError)
    }

    return loggedError
  }

  private getSeverity(error: Error): LoggedError['severity'] {
    if (error instanceof NetworkError) return error.severity
    if (error instanceof ValidationError) return 'low'
    if (error instanceof WalletError) return error.severity
    if (error instanceof SylosError) return error.severity
    return 'medium'
  }

  private getContext(context?: ErrorInfo): Record<string, unknown> {
    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      ...context
    }
  }

  private async sendToLoggingService(error: LoggedError) {
    try {
      // In a real app, you would send this to your logging service
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error)
      })
    } catch (err) {
      // Fail silently to avoid infinite loops
      console.warn('Failed to send error to logging service:', err)
    }
  }

  getErrors(): LoggedError[] {
    return [...this.errors]
  }

  clearErrors(): void {
    this.errors = []
  }
}

export const errorLogger = ErrorLogger.getInstance()

// Global error handlers
export const setupGlobalErrorHandlers = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.log(
      new Error(`Unhandled promise rejection: ${event.reason}`),
      { errorBoundary: 'global' }
    )
  })

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    errorLogger.log(
      new Error(`Uncaught error: ${event.error?.message || event.message}`),
      { errorBoundary: 'global' }
    )
  })
}