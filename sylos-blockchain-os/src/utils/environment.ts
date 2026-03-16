/**
 * Environment configuration and security settings
 */

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test'
  VITE_APP_VERSION: string
  VITE_API_BASE_URL: string
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_WALLETCONNECT_PROJECT_ID: string
  VITE_SENTRY_DSN?: string
  VITE_ENABLE_ERROR_LOGGING: boolean
  VITE_ENABLE_ANALYTICS: boolean
  VITE_CSP_ENABLED: boolean
  VITE_SECURITY_HEADERS_ENABLED: boolean
}

export interface SecurityConfig {
  enableCSP: boolean
  enableSecurityHeaders: boolean
  allowedOrigins: string[]
  maxFileSize: number
  rateLimitPerMinute: number
  sessionTimeout: number
  enableHSTS: boolean
}

class EnvironmentManager {
  private static instance: EnvironmentManager
  private config: EnvironmentConfig
  private securityConfig: SecurityConfig

  private constructor() {
    this.config = this.loadConfig()
    this.securityConfig = this.loadSecurityConfig()
  }

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager()
    }
    return EnvironmentManager.instance
  }

  private loadConfig(): EnvironmentConfig {
    const requiredVars = [
      'VITE_API_BASE_URL',
      'VITE_SUPABASE_URL', 
      'VITE_SUPABASE_ANON_KEY',
      'VITE_WALLETCONNECT_PROJECT_ID'
    ]

    // Warn about missing environment variables — never throw during bootstrap
    if (import.meta.env.PROD) {
      for (const varName of requiredVars) {
        if (!import.meta.env[varName]) {
          console.warn(`[Xorb] Missing environment variable: ${varName} — some features may be unavailable`)
        }
      }
    }

    return {
      NODE_ENV: (import.meta.env.VITE_NODE_ENV as EnvironmentConfig['NODE_ENV']) || (import.meta.env.PROD ? 'production' : 'development'),
      VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_ENABLE_ERROR_LOGGING: import.meta.env.VITE_ENABLE_ERROR_LOGGING === 'true',
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
      VITE_CSP_ENABLED: import.meta.env.VITE_CSP_ENABLED === 'true',
      VITE_SECURITY_HEADERS_ENABLED: import.meta.env.VITE_SECURITY_HEADERS_ENABLED === 'true'
    }
  }

  private loadSecurityConfig(): SecurityConfig {
    return {
      enableCSP: this.config.VITE_CSP_ENABLED,
      enableSecurityHeaders: this.config.VITE_SECURITY_HEADERS_ENABLED,
      allowedOrigins: [
        'http://localhost:5173',
        'https://localhost:5173',
        ...(this.config.VITE_API_BASE_URL ? [this.config.VITE_API_BASE_URL] : [])
      ],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      rateLimitPerMinute: 100,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      enableHSTS: import.meta.env.PROD
    }
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config }
  }

  getSecurityConfig(): SecurityConfig {
    return { ...this.securityConfig }
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development'
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production'
  }

  isTest(): boolean {
    return this.config.NODE_ENV === 'test'
  }

  shouldEnableErrorLogging(): boolean {
    return this.config.VITE_ENABLE_ERROR_LOGGING || this.isDevelopment()
  }

  shouldEnableAnalytics(): boolean {
    return this.config.VITE_ENABLE_ANALYTICS && this.isProduction()
  }

  // Security validation
  validateConfig(): string[] {
    const errors: string[] = []

    // Check for insecure configurations in production
    if (this.isProduction()) {
      if (this.config.VITE_API_BASE_URL?.startsWith('http://')) {
        errors.push('API URL should use HTTPS in production')
      }
      
      if (!this.config.VITE_SUPABASE_URL || !this.config.VITE_SUPABASE_ANON_KEY) {
        errors.push('Supabase configuration is required in production')
      }

      if (!this.securityConfig.enableCSP) {
        errors.push('CSP should be enabled in production')
      }
    }

    return errors
  }
}

export const envManager = EnvironmentManager.getInstance()

// Environment-specific configurations
export const getCSPDirectives = (): string => {
  const config = envManager.getSecurityConfig()
  
  if (!config.enableCSP) return ''

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' wss: https:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ]

  // Add specific allowances for development
  if (envManager.isDevelopment()) {
    directives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*")
    directives.push("connect-src 'self' ws: http: https:")
  }

  return directives.join('; ')
}

export const getSecurityHeaders = (): Record<string, string> => {
  const config = envManager.getSecurityConfig()
  const headers: Record<string, string> = {}

  if (config.enableSecurityHeaders) {
    headers['X-Content-Type-Options'] = 'nosniff'
    headers['X-Frame-Options'] = 'DENY'
    headers['X-XSS-Protection'] = '1; mode=block'
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    if (config.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    }

    headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
  }

  return headers
}

// Validate environment setup — warns but never throws to avoid killing the app
export const validateEnvironment = (): void => {
  const errors = envManager.validateConfig()

  if (errors.length > 0) {
    console.warn('[Xorb] Environment validation warnings:', errors)
  }
}

// Type-safe environment variable getter
export const getEnvVar = <T extends string>(
  key: string, 
  defaultValue: T, 
  validator?: (value: string) => value is T
): T => {
  const value = import.meta.env[key] || defaultValue
  
  if (validator && !validator(value)) {
    throw new Error(`Invalid value for environment variable ${key}: ${value}`)
  }
  
  return value
}