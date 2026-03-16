// Monitoring and logging configuration for Xorb Blockchain OS
export interface MonitoringConfig {
  // Application monitoring
  app: {
    enableTracking: boolean
    serviceName: string
    version: string
    environment: string
    samplingRate: number
  }
  
  // Error tracking
  error: {
    enableTracking: boolean
    level: 'debug' | 'info' | 'warn' | 'error'
    reportUnhandled: boolean
    sampleRate: number
    beforeSend: (event: any) => boolean
  }
  
  // Performance monitoring
  performance: {
    enableTracking: boolean
    enableWebVitals: boolean
    customMetrics: {
      bundleSize: boolean
      loadTime: boolean
      renderTime: boolean
      apiResponseTime: boolean
    }
  }
  
  // User analytics
  analytics: {
    enableTracking: boolean
    anonymizeIP: boolean
    respectDNT: boolean
    sampleRate: number
  }
  
  // Logging configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    enableConsole: boolean
    enableRemote: boolean
    format: 'json' | 'text'
    maxBufferSize: number
  }
}

// Core Web Vitals thresholds
export const VITAL_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }  // Time to First Byte
}

// Performance monitoring configuration
export const performanceMonitoring = {
  // Core Web Vitals tracking
  vitals: {
    enabled: process.env.NODE_ENV === 'production',
    thresholds: VITAL_THRESHOLDS,
    reporting: {
      // Use SendBeacon for reliable reporting
      reportingEndpoint: '/api/metrics',
      reportingMode: 'sendBeacon'
    }
  },
  
  // Resource timing
  resourceTiming: {
    enabled: true,
    includeQueryString: false,
    // Track only specific resource types
    resourceTypes: ['script', 'stylesheet', 'image', 'fetch', 'xmlhttprequest']
  },
  
  // Navigation timing
  navigationTiming: {
    enabled: true,
    // Collect detailed navigation metrics
    measureMetrics: [
      'dns',
      'tcp',
      'request',
      'response',
      'processing',
      'onLoad'
    ]
  },
  
  // Custom performance marks
  customMetrics: {
    enabled: true,
    marks: {
      appStart: 'app-start',
      blockchainConnected: 'blockchain-connected',
      defiLoaded: 'defi-loaded',
      walletConnected: 'wallet-connected'
    }
  }
}

// Error tracking configuration
export const errorTracking = {
  // Sentry configuration
  sentry: {
    dsn: process.env.VITE_SENTRY_DSN || '',
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,
    beforeSend: (event: any) => {
      // Filter out common non-actionable errors
      const message = event.exception?.values?.[0]?.value || event.message
      
      // Skip network errors (often temporary)
      if (message?.includes('Network Error') || message?.includes('fetch')) {
        return null
      }
      
      // Skip extension-related errors
      if (message?.includes('chrome-extension') || message?.includes('moz-extension')) {
        return null
      }
      
      return event
    },
    beforeBreadcrumb: (breadcrumb: any) => {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'ui.click' && breadcrumb.message?.includes('chrome-extension')) {
        return null
      }
      return breadcrumb
    },
    integrations: [
      // React integration for error boundaries
      {
        name: 'ReactErrorBoundary'
      }
    ]
  },
  
  // Error boundaries configuration
  errorBoundaries: {
    enableDevTools: process.env.NODE_ENV === 'development',
    showDialog: process.env.NODE_ENV === 'development',
    fallback: {
      title: 'Something went wrong',
      message: 'The application has encountered an error. Please refresh the page.',
      showDetails: process.env.NODE_ENV === 'development'
    }
  }
}

// Logging configuration
export const loggingConfig = {
  // Log levels by environment
  level: {
    development: 'debug',
    staging: 'info',
    production: 'warn'
  }[process.env.NODE_ENV || 'development'] as 'debug' | 'info' | 'warn' | 'error',
  
  // Console logging
  console: {
    enabled: process.env.NODE_ENV !== 'production',
    colorize: process.env.NODE_ENV === 'development',
    timestamp: process.env.NODE_ENV === 'development'
  },
  
  // Remote logging
  remote: {
    enabled: process.env.NODE_ENV === 'production',
    endpoint: process.env.LOG_ENDPOINT || '/api/logs',
    batchSize: 10,
    flushInterval: 5000, // 5 seconds
    retryAttempts: 3
  },
  
  // Structured logging
  structured: {
    enabled: true,
    includeStack: process.env.NODE_ENV === 'development',
    includeUserAgent: true,
    includeUrl: true,
    includeTimestamp: true
  }
}

// Health monitoring configuration
export const healthMonitoring = {
  // Health check endpoints
  checks: {
    blockchain: {
      enabled: true,
      endpoint: process.env.VITE_RPC_URL,
      timeout: 5000,
      critical: true
    },
    api: {
      enabled: true,
      endpoint: process.env.VITE_API_URL,
      timeout: 10000,
      critical: true
    },
    database: {
      enabled: process.env.NODE_ENV === 'production',
      endpoint: '/api/health/db',
      timeout: 5000,
      critical: false
    }
  },
  
  // Monitoring frequency
  frequency: {
    healthChecks: 30000, // 30 seconds
    performanceMetrics: 10000, // 10 seconds
    errorReports: 5000, // 5 seconds
    customMetrics: 60000 // 1 minute
  },
  
  // Alerting thresholds
  alerts: {
    errorRate: 0.05, // 5% error rate
    responseTime: 2000, // 2 seconds
    availability: 0.99 // 99% availability
  }
}

// Analytics configuration
export const analyticsConfig = {
  // Google Analytics 4
  ga4: {
    measurementId: process.env.VITE_GA_MEASUREMENT_ID,
    anonymizeIP: true,
    allowAdFeatures: false,
    allowPersonalization: false,
    sampleRate: 100,
    siteSpeedSampleRate: 10
  },
  
  // Custom analytics events
  events: {
    // Blockchain events
    walletConnected: {
      category: 'blockchain',
      action: 'connect',
      label: 'wallet_type'
    },
    transactionSubmitted: {
      category: 'blockchain',
      action: 'transaction',
      label: 'type'
    },
    defiAction: {
      category: 'defi',
      action: 'action',
      label: 'protocol'
    },
    
    // Application events
    pageView: {
      category: 'navigation',
      action: 'view',
      label: 'page_name'
    },
    userEngagement: {
      category: 'engagement',
      action: 'interaction',
      label: 'element'
    }
  },
  
  // Privacy configuration
  privacy: {
    respectDNT: true,
    cookieConsent: true,
    dataRetention: 395, // days (13 months)
    anonymizeAfterDays: 90
  }
}

// Real User Monitoring (RUM)
export const rumConfig = {
  enabled: process.env.NODE_ENV === 'production',
  
  // Performance observer
  observer: {
    entryTypes: [
      'navigation',
      'resource',
      'paint',
      'largest-contentful-paint',
      'first-input',
      'layout-shift',
      'longtask'
    ]
  },
  
  // Sampling rate (percentage of users to monitor)
  samplingRate: {
    high: 100, // 100% for critical users
    medium: 50, // 50% for regular users
    low: 10 // 10% for background users
  },
  
  // User segment configuration
  segments: {
    // Segment users based on interaction patterns
    engaged: {
      criteria: {
        sessionDuration: 300, // 5 minutes
        pageViews: 5,
        interactions: 10
      },
      samplingRate: 100
    },
    casual: {
      criteria: {
        sessionDuration: 60, // 1 minute
        pageViews: 2,
        interactions: 3
      },
      samplingRate: 50
    }
  }
}

// Monitoring utilities
export const monitoringUtils = {
  // Performance measurement utilities
  measure: {
    // Start timing
    start: (name: string) => {
      performance.mark(`${name}-start`)
    },
    
    // End timing and record
    end: (name: string) => {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
      
      const measure = performance.getEntriesByName(name, 'measure')[0]
      if (measure) {
        // Send to monitoring service
        console.debug(`Performance: ${name} took ${measure.duration}ms`)
      }
    },
    
    // Record custom metric
    record: (name: string, value: number, type: 'metric' | 'timing' | 'count' = 'metric') => {
      // Implementation for custom metrics
      console.debug(`Custom metric: ${name} = ${value} (${type})`)
    }
  },
  
  // Error reporting
  reportError: (error: Error, context?: any) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    }
    
    console.error('Error reported:', errorInfo)
    
    // Send to error tracking service
    if (process.env.NODE_ENV === 'production' && process.env.VITE_SENTRY_DSN) {
      // Sentry implementation would go here
    }
  }
}

export default {
  monitoring: {
    config: {
      app: {
        enableTracking: process.env.NODE_ENV === 'production',
        serviceName: 'xorb-blockchain-os',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        samplingRate: process.env.NODE_ENV === 'production' ? 100 : 0
      },
      error: {
        enableTracking: true,
        level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
        reportUnhandled: true,
        sampleRate: 100
      },
      performance: {
        enableTracking: true,
        enableWebVitals: process.env.NODE_ENV === 'production',
        customMetrics: {
          bundleSize: true,
          loadTime: true,
          renderTime: true,
          apiResponseTime: true
        }
      },
      analytics: {
        enableTracking: process.env.NODE_ENV === 'production',
        anonymizeIP: true,
        respectDNT: true,
        sampleRate: 100
      },
      logging: {
        level: loggingConfig.level,
        enableConsole: loggingConfig.console.enabled,
        enableRemote: loggingConfig.remote.enabled,
        format: 'json',
        maxBufferSize: 100
      }
    }
  },
  performance: performanceMonitoring,
  error: errorTracking,
  logging: loggingConfig,
  health: healthMonitoring,
  analytics: analyticsConfig,
  rum: rumConfig,
  utils: monitoringUtils
}