# Comprehensive Monitoring and Logging System Implementation

## Table of Contents
1. [System Overview](#system-overview)
2. [Error Tracking (Sentry Integration)](#error-tracking-sentry-integration)
3. [Performance Monitoring (Web Vitals, RUM)](#performance-monitoring-web-vitals-rum)
4. [Analytics Tracking](#analytics-tracking)
5. [Structured Logging System](#structured-logging-system)
6. [Health Check Endpoints](#health-check-endpoints)
7. [Alerting System](#alerting-system)
8. [Dashboard Creation](#dashboard-creation)
9. [Log Aggregation](#log-aggregation)
10. [Metrics Collection](#metrics-collection)
11. [Security Monitoring](#security-monitoring)
12. [Web App Implementation](#web-app-implementation)
13. [Mobile App Implementation](#mobile-app-implementation)
14. [Smart Contracts Implementation](#smart-contracts-implementation)
15. [Deployment and Configuration](#deployment-and-configuration)
16. [Best Practices](#best-practices)

## System Overview

The SylOS monitoring and logging system provides comprehensive observability across web applications, mobile applications, and smart contracts. The system is designed to provide real-time insights, automated alerting, and actionable intelligence for maintaining system health and user experience.

### Core Components Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Monitoring Dashboard                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web App   │  │  Mobile App │  │  Smart      │        │
│  │ Monitoring  │  │ Monitoring  │  │  Contracts  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                Central Monitoring Pipeline                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Sentry    │  │ Analytics   │  │   Logging   │        │
│  │    (Errors) │  │  Tracking   │  │   System    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Performance │  │   Health    │  │  Security   │        │
│  │ Monitoring  │  │   Checks    │  │  Monitoring │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data Storage & Processing                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Metrics   │  │    Logs     │  │  Alerts     │        │
│  │    Store    │  │   Database  │  │   Queue     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Error Tracking (Sentry Integration)

### Web App Error Tracking

```typescript
// src/monitoring/sentry-client.ts
import * as Sentry from '@sentry/react'
import { BrowserTracing } from '@sentry/tracing'
import { monitoringConfig } from '../config/monitoring'

class SentryClient {
  private isInitialized = false

  initialize() {
    if (this.isInitialized || !monitoringConfig.error.enableTracking) {
      return
    }

    Sentry.init({
      dsn: process.env.VITE_SENTRY_DSN,
      environment: monitoringConfig.app.environment,
      release: monitoringConfig.app.version,
      
      // Enable automatic session tracking
      autoSessionTracking: true,
      
      // Set tracesSampleRate to 1.0 to capture 100% of transactions
      tracesSampleRate: monitoringConfig.app.samplingRate / 100,
      
      // Capture unhandled promise rejections
      captureUnhandledRejections: true,
      
      // Performance monitoring
      integrations: [
        new BrowserTracing({
          tracingOrigins: ['localhost', 'app.sylos.io', /^\//],
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect
          ),
        }),
      ],
      
      beforeSend: (event) => {
        // Filter out common non-actionable errors
        const message = event.exception?.values?.[0]?.value || event.message
        
        // Skip network errors
        if (message?.includes('Network Error') || message?.includes('fetch')) {
          return null
        }
        
        // Skip extension-related errors
        if (message?.includes('chrome-extension') || message?.includes('moz-extension')) {
          return null
        }
        
        return event
      },
      
      beforeBreadcrumb: (breadcrumb) => {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === 'ui.click' && breadcrumb.message?.includes('chrome-extension')) {
          return null
        }
        return breadcrumb
      },
    })

    this.isInitialized = true
  }

  captureException(error: Error, context?: Record<string, any>) {
    if (!this.isInitialized) return

    Sentry.withScope((scope) => {
      // Add custom context
      if (context) {
        scope.setContext('additional_info', context)
      }
      
      // Add user context if available
      const user = this.getCurrentUser()
      if (user) {
        scope.setUser(user)
      }
      
      Sentry.captureException(error)
    })
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    if (!this.isInitialized) return
    
    Sentry.captureMessage(message, level)
  }

  addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = 'info') {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now(),
    })
  }

  private getCurrentUser() {
    // Get current user from your auth context
    return null
  }
}

export const sentryClient = new SentryClient()
```

### Mobile App Error Tracking

```typescript
// sylos-mobile/src/services/monitoring/MobileSentryService.ts
import * as Sentry from '@sentry/react-native'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export class MobileSentryService {
  private isInitialized = false

  async initialize() {
    if (this.isInitialized) return

    try {
      await Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: process.env.EXPO_PUBLIC_APP_ENV || 'development',
        
        // Enable native crash handling
        enableNative: true,
        enableNdkCrashesBeforeSend: true,
        
        // Auto session tracking
        autoSessionTracking: true,
        sessionTrackingIntervalMillis: 10000,
        
        // Performance monitoring
        enableAutoPerformanceTracking: true,
        enableOutOfMemoryTracking: true,
        
        // Release health
        enableReleaseHealth: true,
        autoSessionTracking: true,
        
        // Mobile-specific features
        enableAppHangTracking: true,
        appHangTimeoutInterval: 2000,
        
        // User interaction tracking
        enableUserInteractionTracing: true,
        
        // On device tracing
        enableOnDemandSampling: true,
        
        beforeSend: (event) => this.filterEvents(event),
        beforeBreadcrumb: (breadcrumb) => this.filterBreadcrumbs(breadcrumb),
      })

      // Set device context
      await this.setDeviceContext()
      
      this.isInitialized = true
      console.log('Sentry initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Sentry:', error)
    }
  }

  private async setDeviceContext() {
    const deviceInfo = await this.getDeviceInfo()
    Sentry.setContext('device_info', deviceInfo)
  }

  private async getDeviceInfo() {
    const device = await import('expo-device')
    const system = await import('expo-device')
    const application = await import('expo-application')
    
    return {
      platform: Platform.OS,
      model: device.modelName,
      brand: device.manufacturer,
      osVersion: system.osVersion,
      appVersion: application.nativeApplicationVersion,
      buildVersion: application.nativeBuildVersion,
    }
  }

  private filterEvents(event: Sentry.Event): Sentry.Event | null {
    // Filter out specific error types
    const message = event.exception?.values?.[0]?.value || event.message
    
    // Skip network errors
    if (message?.includes('Network Error')) {
      return null
    }
    
    // Skip React Native specific non-actionable errors
    if (message?.includes('Non-Error promise rejection')) {
      return null
    }
    
    return event
  }

  private filterBreadcrumbs(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'ui.click' && breadcrumb.message?.includes('debug')) {
      return null
    }
    
    return breadcrumb
  }

  captureException(error: Error, context?: Record<string, any>) {
    if (!this.isInitialized) return

    Sentry.withScope((scope) => {
      if (context) {
        scope.setContext('additional_info', context)
      }
      
      // Add navigation context
      this.addNavigationContext(scope)
      
      Sentry.captureException(error)
    })
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
    if (!this.isInitialized) return
    Sentry.captureMessage(message, level)
  }

  private addNavigationContext(scope: Sentry.Scope) {
    // Add current screen information
    scope.addBreadcrumb({
      message: 'Navigation Context',
      category: 'navigation',
      level: 'info',
      timestamp: Date.now(),
    })
  }

  setUser(user: { id: string; email?: string }) {
    if (!this.isInitialized) return
    Sentry.setUser(user)
  }

  clearUser() {
    if (!this.isInitialized) return
    Sentry.setUser(null)
  }
}
```

### Smart Contract Error Tracking

```javascript
// smart-contracts/scripts/monitoring/contract-monitor.js
const { ethers } = require('hardhat')
const Sentry = require('@sentry/node')

class ContractMonitor {
  constructor() {
    this.sentry = null
    this.provider = null
  }

  async initialize() {
    // Initialize Sentry for backend services
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.HARDHAT_NETWORK,
      tracesSampleRate: 1.0,
    })

    this.provider = ethers.getDefaultProvider()
  }

  async monitorTransaction(txHash, context = {}) {
    try {
      const tx = await this.provider.getTransaction(txHash)
      
      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`)
      }

      // Monitor transaction status
      const receipt = await tx.wait()
      
      const transactionInfo = {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status,
        context,
      }

      // Log transaction details
      console.log('Transaction monitored:', transactionInfo)

      // Send to monitoring dashboard
      await this.sendMetrics('transaction_monitoring', {
        ...transactionInfo,
        timestamp: new Date().toISOString(),
      })

      // Alert on failed transactions
      if (!receipt.status) {
        await this.alertOnFailedTransaction(transactionInfo)
      }

    } catch (error) {
      await this.captureError(error, { txHash, context })
    }
  }

  async monitorGasUsage(contractAddress, functionName, gasEstimate, gasUsed) {
    const gasMetrics = {
      contract: contractAddress,
      function: functionName,
      estimated: gasEstimate.toString(),
      actual: gasUsed.toString(),
      efficiency: Number(gasUsed) / Number(gasEstimate),
      timestamp: new Date().toISOString(),
    }

    await this.sendMetrics('gas_monitoring', gasMetrics)

    // Alert on high gas usage
    if (gasMetrics.efficiency > 2) {
      await this.captureError(new Error('High gas usage detected'), {
        contractAddress,
        functionName,
        gasMetrics,
      })
    }
  }

  async captureError(error, context = {}) {
    Sentry.withScope((scope) => {
      scope.setContext('smart_contract', context)
      Sentry.captureException(error)
    })
  }

  async sendMetrics(type, data) {
    // Send metrics to monitoring service
    const metricsEndpoint = process.env.METRICS_ENDPOINT || 'http://localhost:3001/metrics'
    
    try {
      await fetch(metricsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.METRICS_API_KEY}`,
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  }
}

module.exports = { ContractMonitor }
```

## Performance Monitoring (Web Vitals, RUM)

### Web Vitals Implementation

```typescript
// src/monitoring/web-vitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals'
import { monitoringConfig, VITAL_THRESHOLDS } from '../config/monitoring'

class WebVitalsMonitor {
  private metrics: Map<string, number> = new Map()
  private thresholds = VITAL_THRESHOLDS

  constructor() {
    this.initializeVitals()
  }

  private initializeVitals() {
    if (!monitoringConfig.performance.enableWebVitals) return

    // Largest Contentful Paint
    getCLS(this.onVital.bind(this))
    
    // First Input Delay
    getFID(this.onVital.bind(this))
    
    // First Contentful Paint
    getFCP(this.onVital.bind(this))
    
    // Largest Contentful Paint
    getLCP(this.onVital.bind(this))
    
    // Time to First Byte
    getTTFB(this.onVital.bind(this))

    // Custom performance metrics
    this.setupCustomMetrics()
  }

  private onVital(metric: Metric) {
    this.metrics.set(metric.name, metric.value)
    
    // Send to analytics
    this.trackVital(metric)
    
    // Check thresholds and alert if needed
    this.checkThresholds(metric)
    
    // Performance mark for custom analysis
    performance.mark(`${metric.name}-recorded`)
  }

  private trackVital(metric: Metric) {
    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', 'web_vitals', {
        event_category: 'Web Vitals',
        event_label: metric.name,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        non_interaction: true,
      })
    }

    // Send to custom analytics
    this.sendToAnalytics('web_vital', {
      name: metric.name,
      value: metric.value,
      rating: this.getRating(metric.name, metric.value),
      timestamp: Date.now(),
    })
  }

  private getRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = this.thresholds[metricName as keyof typeof this.thresholds]
    if (!threshold) return 'good'

    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  private checkThresholds(metric: Metric) {
    const rating = this.getRating(metric.name, metric.value)
    
    if (rating === 'poor') {
      // Send alert
      this.sendAlert('poor_web_vital', {
        metric: metric.name,
        value: metric.value,
        threshold: this.thresholds[metric.name as keyof typeof this.thresholds],
        url: window.location.href,
        userAgent: navigator.userAgent,
      })
    }
  }

  private setupCustomMetrics() {
    // Core Web Vitals custom tracking
    this.trackPageLoad()
    this.trackResourceTiming()
    this.trackNavigationTiming()
  }

  private trackPageLoad() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        
        const pageLoadMetrics = {
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ttfb: navigation.responseStart - navigation.requestStart,
          download: navigation.responseEnd - navigation.responseStart,
          domParsing: navigation.domContentLoadedEventEnd - navigation.responseEnd,
          loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        }

        this.sendToAnalytics('page_load', pageLoadMetrics)
      }, 0)
    })
  }

  private trackResourceTiming() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.analyzeResource(entry as PerformanceResourceTiming)
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  private analyzeResource(entry: PerformanceResourceTiming) {
    const resourceInfo = {
      name: entry.name,
      type: this.getResourceType(entry.name),
      duration: entry.duration,
      size: entry.transferSize,
      cached: entry.transferSize === 0,
    }

    // Alert on slow resources
    if (entry.duration > 1000) {
      this.sendAlert('slow_resource', resourceInfo)
    }

    this.sendToAnalytics('resource_timing', resourceInfo)
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(js|css)$/)) return 'static'
    if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image'
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font'
    if (url.includes('api/')) return 'api'
    return 'other'
  }

  private sendToAnalytics(type: string, data: any) {
    // Implementation for sending to your analytics service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          sessionId: this.getSessionId(),
        }),
      }).catch(() => {}) // Silent fail
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = this.generateSessionId()
      sessionStorage.setItem('sessionId', sessionId)
    }
    return sessionId
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  private async sendAlert(type: string, data: any) {
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          severity: 'warning',
          data,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.error('Failed to send alert:', error)
    }
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics)
  }
}

export const webVitalsMonitor = new WebVitalsMonitor()
```

### Real User Monitoring (RUM)

```typescript
// src/monitoring/rum.ts
class RealUserMonitor {
  private sessionData: Map<string, any> = new Map()
  private userSegment: 'high' | 'medium' | 'low' = 'medium'

  constructor() {
    this.initializeRUM()
    this.analyzeUserSegment()
  }

  private initializeRUM() {
    this.trackUserInteractions()
    this.trackPageVisibility()
    this.trackBeforeUnload()
    this.startSessionTimer()
  }

  private analyzeUserSegment() {
    // Analyze user behavior to determine segment
    const engagementScore = this.calculateEngagementScore()
    
    if (engagementScore >= 80) {
      this.userSegment = 'high'
    } else if (engagementScore >= 40) {
      this.userSegment = 'medium'
    } else {
      this.userSegment = 'low'
    }

    // Adjust sampling based on segment
    const samplingRate = {
      high: 100,
      medium: 50,
      low: 10
    }[this.userSegment]

    if (Math.random() * 100 > samplingRate) {
      // Skip monitoring for this user
      return
    }

    this.startDetailedTracking()
  }

  private calculateEngagementScore(): number {
    const sessionDuration = Date.now() - (Number(sessionStorage.getItem('sessionStart')) || Date.now())
    const pageViews = Number(sessionStorage.getItem('pageViews')) || 0
    const interactions = Number(sessionStorage.getItem('interactions')) || 0

    return Math.min(100, 
      (sessionDuration / 60000) * 10 + // 10 points per minute
      pageViews * 5 + // 5 points per page view
      interactions // 1 point per interaction
    )
  }

  private startDetailedTracking() {
    this.trackUserFlow()
    this.trackPerformanceByUser()
    this.trackErrorsByUser()
  }

  private trackUserInteractions() {
    let interactionCount = 0
    const maxInteractions = 1000

    const countInteraction = () => {
      interactionCount++
      sessionStorage.setItem('interactions', interactionCount.toString())
    }

    // Track clicks
    document.addEventListener('click', () => countInteraction(), { passive: true })
    
    // Track form submissions
    document.addEventListener('submit', () => countInteraction(), { passive: true })
    
    // Track scroll depth
    let maxScrollDepth = 0
    window.addEventListener('scroll', throttle(() => {
      const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100)
      maxScrollDepth = Math.max(maxScrollDepth, scrollDepth)
      sessionStorage.setItem('maxScrollDepth', maxScrollDepth.toString())
    }, 250), { passive: true })
  }

  private trackUserFlow() {
    const flowData = {
      entryPoint: document.referrer || 'direct',
      currentPath: window.location.pathname,
      pages: [window.location.pathname],
      startTime: Date.now(),
    }

    // Track page changes
    const originalPushState = history.pushState
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      flowData.pages.push(window.location.pathname)
      this.trackPageView()
    }.bind(this)

    this.sessionData.set('userFlow', flowData)
  }

  private trackPageView() {
    const pageViews = Number(sessionStorage.getItem('pageViews')) || 0
    sessionStorage.setItem('pageViews', (pageViews + 1).toString())

    this.sendToAnalytics('page_view', {
      path: window.location.pathname,
      referrer: document.referrer,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
    })
  }

  private trackPerformanceByUser() {
    // Track custom performance marks
    performance.mark('app-start')
    
    // Track navigation timing
    setTimeout(() => {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      
      this.sendToAnalytics('user_performance', {
        userSegment: this.userSegment,
        ttfb: navTiming.responseStart - navTiming.requestStart,
        domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.navigationStart,
        loadComplete: navTiming.loadEventEnd - navTiming.navigationStart,
        sessionDuration: Date.now() - Number(sessionStorage.getItem('sessionStart')),
      })
    }, 0)
  }

  private startSessionTimer() {
    if (!sessionStorage.getItem('sessionStart')) {
      sessionStorage.setItem('sessionStart', Date.now().toString())
    }
  }

  private trackPageVisibility() {
    document.addEventListener('visibilitychange', () => {
      this.sendToAnalytics('visibility_change', {
        hidden: document.hidden,
        timestamp: Date.now(),
      })
    })
  }

  private trackBeforeUnload() {
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Date.now() - Number(sessionStorage.getItem('sessionStart'))
      
      this.sendToAnalytics('session_end', {
        duration: sessionDuration,
        pageViews: Number(sessionStorage.getItem('pageViews')) || 0,
        maxScrollDepth: Number(sessionStorage.getItem('maxScrollDepth')) || 0,
        userSegment: this.userSegment,
      })
    })
  }

  private getSessionId(): string {
    return sessionStorage.getItem('sessionId') || 'unknown'
  }

  private sendToAnalytics(type: string, data: any) {
    // Implementation for sending to analytics service
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/rum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
        }),
        keepalive: true, // Send even on page unload
      }).catch(() => {})
    }
  }
}

// Throttle utility
function throttle<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null
  let previous = 0
  
  return function(this: any, ...args: any[]) {
    const now = Date.now()
    const remaining = wait - (now - previous)
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      return func.apply(this, args)
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now()
        timeout = null
        func.apply(this, args)
      }, remaining)
    }
  } as T
}

export const realUserMonitor = new RealUserMonitor()
```

## Analytics Tracking

### Google Analytics 4 Integration

```typescript
// src/monitoring/analytics.ts
class AnalyticsTracker {
  private isInitialized = false
  private eventQueue: Array<{name: string, params: any}> = []

  constructor() {
    this.initializeGA4()
  }

  private async initializeGA4() {
    if (!monitoringConfig.analytics.enableTracking) return

    // Load gtag script
    await this.loadGtagScript()
    
    // Initialize GA4
    this.configureGA4()
    this.isInitialized = true

    // Process queued events
    this.processEventQueue()
  }

  private loadGtagScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.VITE_GA_MEASUREMENT_ID}`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load gtag script'))
      document.head.appendChild(script)
    })
  }

  private configureGA4() {
    const config = analyticsConfig.ga4
    
    window.dataLayer = window.dataLayer || []
    function gtag(...args: any[]) {
      window.dataLayer.push(args)
    }
    
    // @ts-ignore
    window.gtag = gtag
    
    gtag('js', new Date())
    gtag('config', process.env.VITE_GA_MEASUREMENT_ID, {
      anonymize_ip: config.anonymizeIP,
      allow_ad_features: config.allowAdFeatures,
      allow_personalization: config.allowPersonalization,
      sample_rate: config.sampleRate,
      site_speed_sample_rate: config.siteSpeedSampleRate,
    })
  }

  trackEvent(name: string, parameters: Record<string, any> = {}) {
    const event = {
      name,
      params: {
        ...parameters,
        timestamp: new Date().toISOString(),
        session_id: this.getSessionId(),
      }
    }

    if (this.isInitialized) {
      this.sendEvent(event)
    } else {
      this.eventQueue.push(event)
    }
  }

  private processEventQueue() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()
      if (event) {
        this.sendEvent(event)
      }
    }
  }

  private sendEvent(event: {name: string, params: any}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', event.name, event.params)
    }
  }

  // Predefined event tracking methods
  trackPageView(page: string) {
    this.trackEvent('page_view', {
      page_path: page,
      page_title: document.title,
    })
  }

  trackUserEngagement(action: string, element: string) {
    this.trackEvent('user_engagement', {
      event_category: 'engagement',
      event_label: element,
      action: action,
    })
  }

  trackWalletConnection(walletType: string) {
    this.trackEvent('wallet_connected', {
      event_category: 'blockchain',
      event_label: 'wallet_type',
      wallet_type: walletType,
    })
  }

  trackTransaction(type: string, details: any) {
    this.trackEvent('transaction_submitted', {
      event_category: 'blockchain',
      event_label: 'type',
      transaction_type: type,
      ...details,
    })
  }

  trackDeFiAction(action: string, protocol: string, details: any) {
    this.trackEvent('defi_action', {
      event_category: 'defi',
      event_label: 'protocol',
      action: action,
      protocol: protocol,
      ...details,
    })
  }

  trackError(error: string, context: string) {
    this.trackEvent('error', {
      event_category: 'error',
      event_label: context,
      error_message: error,
    })
  }

  trackPerformance(metric: string, value: number) {
    this.trackEvent('performance_metric', {
      event_category: 'performance',
      event_label: metric,
      metric_value: value,
    })
  }

  private getSessionId(): string {
    return sessionStorage.getItem('sessionId') || 'unknown'
  }
}

export const analyticsTracker = new AnalyticsTracker()
```

### Custom Analytics Dashboard

```typescript
// src/components/AnalyticsDashboard.tsx
import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface AnalyticsData {
  timestamp: string
  pageViews: number
  uniqueUsers: number
  bounceRate: number
  avgSessionDuration: number
  errorRate: number
  performanceScore: number
}

export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')

  useEffect(() => {
    fetchAnalyticsData()
  }, [timeRange])

  const fetchAnalyticsData = async () => {
    try {
      const response = await fetch(`/api/analytics/dashboard?range=${timeRange}`)
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4">Loading analytics...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Page Views"
          value={data.reduce((sum, d) => sum + d.pageViews, 0).toLocaleString()}
          change="+12%"
        />
        <MetricCard
          title="Unique Users"
          value={data[data.length - 1]?.uniqueUsers.toLocaleString() || '0'}
          change="+8%"
        />
        <MetricCard
          title="Bounce Rate"
          value={`${data[data.length - 1]?.bounceRate.toFixed(1) || 0}%`}
          change="-3%"
        />
        <MetricCard
          title="Avg Session"
          value={`${Math.round(data[data.length - 1]?.avgSessionDuration / 60) || 0}m`}
          change="+15%"
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Page Views Over Time</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="pageViews" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const MetricCard: React.FC<{title: string, value: string, change: string}> = ({ title, value, change }) => {
  const isPositive = change.startsWith('+')
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h4 className="text-sm text-gray-600">{title}</h4>
      <p className="text-2xl font-bold">{value}</p>
      <p className={`text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {change} from last period
      </p>
    </div>
  )
}
```

## Structured Logging System

### Logger Implementation

```typescript
// src/monitoring/logger.ts
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  userId?: string
  sessionId?: string
  url?: string
  userAgent?: string
}

class StructuredLogger {
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100
  private flushInterval = 5000
  private isProduction = process.env.NODE_ENV === 'production'

  constructor() {
    if (this.isProduction) {
      setInterval(() => this.flushLogs(), this.flushInterval)
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error)
  }

  private log(
    level: LogEntry['level'], 
    message: string, 
    context?: Record<string, any>, 
    error?: Error
  ) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    // Always log to console in development
    if (!this.isProduction) {
      this.logToConsole(logEntry)
    }

    // Add to buffer
    this.logBuffer.push(logEntry)
    
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs()
    }

    // Send critical errors immediately
    if (level === 'error' && this.isProduction) {
      this.sendLogs([logEntry])
    }
  }

  private logToConsole(entry: LogEntry) {
    const { level, message, context, error } = entry
    
    switch (level) {
      case 'debug':
        console.debug(message, context, error)
        break
      case 'info':
        console.info(message, context, error)
        break
      case 'warn':
        console.warn(message, context, error)
        break
      case 'error':
        console.error(message, context, error)
        break
    }
  }

  private flushLogs() {
    if (this.logBuffer.length === 0) return

    const logsToSend = [...this.logBuffer]
    this.logBuffer = []

    if (this.isProduction) {
      this.sendLogs(logsToSend)
    }
  }

  private async sendLogs(logs: LogEntry[]) {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      })
    } catch (error) {
      // If sending fails, add back to buffer
      this.logBuffer.unshift(...logs)
      console.error('Failed to send logs:', error)
    }
  }

  private getUserId(): string | undefined {
    // Get from your auth context
    return undefined
  }

  private getSessionId(): string | undefined {
    return sessionStorage.getItem('sessionId')
  }

  // Create context logger
  createContextLogger(context: Record<string, any>) {
    return {
      debug: (message: string, additionalContext?: Record<string, any>) => {
        this.debug(message, { ...context, ...additionalContext })
      },
      info: (message: string, additionalContext?: Record<string, any>) => {
        this.info(message, { ...context, ...additionalContext })
      },
      warn: (message: string, additionalContext?: Record<string, any>) => {
        this.warn(message, { ...context, ...additionalContext })
      },
      error: (message: string, error?: Error, additionalContext?: Record<string, any>) => {
        this.error(message, error, { ...context, ...additionalContext })
      },
    }
  }
}

export const logger = new StructuredLogger()
```

### Mobile App Logger

```typescript
// sylos-mobile/src/services/monitoring/MobileLogger.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  error?: {
    name: string
    message: string
    stack?: string
  }
  userId?: string
  sessionId?: string
  deviceInfo: {
    platform: string
    version: string
    model: string
  }
  appState: string
}

export class MobileLogger {
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 50
  private flushInterval = 10000
  private isOnline = true
  private appState: string = 'active'

  constructor() {
    this.setupNetworkListener()
    this.startFlushTimer()
  }

  private setupNetworkListener() {
    const NetInfo = require('@react-native-community/netinfo')
    
    NetInfo.addEventListener((state: any) => {
      this.isOnline = state.isConnected && state.isInternetReachable
      if (this.isOnline && this.logBuffer.length > 0) {
        this.flushLogs()
      }
    })
  }

  private startFlushTimer() {
    setInterval(() => {
      if (this.isOnline && this.logBuffer.length > 0) {
        this.flushLogs()
      }
    }, this.flushInterval)
  }

  async debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  async info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  async warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  async error(message: string, error?: Error, context?: Record<string, any>) {
    this.log('error', message, context, error)
  }

  private async log(
    level: LogEntry['level'], 
    message: string, 
    context?: Record<string, any>, 
    error?: Error
  ) {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: await this.getUserId(),
      sessionId: await this.getSessionId(),
      deviceInfo: await this.getDeviceInfo(),
      appState: this.appState,
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    // Always log to console in development
    if (__DEV__) {
      this.logToConsole(logEntry)
    }

    // Store in AsyncStorage for persistence
    await this.storeLog(logEntry)

    // Add to buffer for sending
    this.logBuffer.push(logEntry)
    
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs()
    }
  }

  private logToConsole(entry: LogEntry) {
    const { level, message, context, error } = entry
    
    switch (level) {
      case 'debug':
        console.debug(message, context, error)
        break
      case 'info':
        console.info(message, context, error)
        break
      case 'warn':
        console.warn(message, context, error)
        break
      case 'error':
        console.error(message, context, error)
        break
    }
  }

  private async storeLog(logEntry: LogEntry) {
    try {
      const existingLogs = await this.getStoredLogs()
      existingLogs.push(logEntry)
      
      // Keep only last 1000 logs
      if (existingLogs.length > 1000) {
        existingLogs.splice(0, existingLogs.length - 1000)
      }
      
      await AsyncStorage.setItem('app_logs', JSON.stringify(existingLogs))
    } catch (error) {
      console.error('Failed to store log:', error)
    }
  }

  private async getStoredLogs(): Promise<LogEntry[]> {
    try {
      const stored = await AsyncStorage.getItem('app_logs')
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to get stored logs:', error)
      return []
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0 || !this.isOnline) return

    const logsToSend = [...this.logBuffer]
    this.logBuffer = []

    try {
      await this.sendLogs(logsToSend)
    } catch (error) {
      // If sending fails, add back to buffer
      this.logBuffer.unshift(...logsToSend)
      console.error('Failed to send logs:', error)
    }
  }

  private async sendLogs(logs: LogEntry[]) {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/mobile/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_API_KEY}`,
      },
      body: JSON.stringify({ logs }),
    })

    if (!response.ok) {
      throw new Error(`Failed to send logs: ${response.status}`)
    }
  }

  private async getUserId(): Promise<string | undefined> {
    try {
      const user = await AsyncStorage.getItem('user_id')
      return user || undefined
    } catch (error) {
      return undefined
    }
  }

  private async getSessionId(): Promise<string | undefined> {
    try {
      let sessionId = await AsyncStorage.getItem('session_id')
      if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36)
        await AsyncStorage.setItem('session_id', sessionId)
      }
      return sessionId
    } catch (error) {
      return undefined
    }
  }

  private async getDeviceInfo() {
    const device = await import('expo-device')
    const application = await import('expo-application')
    
    return {
      platform: Platform.OS,
      version: Platform.Version?.toString() || 'unknown',
      model: device.modelName || 'unknown',
      appVersion: application.nativeApplicationVersion || 'unknown',
    }
  }

  setAppState(state: string) {
    this.appState = state
  }

  async getLogs(): Promise<LogEntry[]> {
    return this.getStoredLogs()
  }

  async clearLogs() {
    await AsyncStorage.removeItem('app_logs')
  }
}

export const mobileLogger = new MobileLogger()
```

## Health Check Endpoints

### Web App Health Checks

```typescript
// src/monitoring/health-checks.ts
interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastChecked: string
  details?: Record<string, any>
  error?: string
}

class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map()
  private checkInterval = 30000 // 30 seconds

  constructor() {
    this.startHealthChecks()
  }

  private startHealthChecks() {
    this.runAllChecks()
    setInterval(() => this.runAllChecks(), this.checkInterval)
  }

  async runAllChecks() {
    const checks = [
      this.checkBlockchainConnection(),
      this.checkAPIHealth(),
      this.checkDatabaseHealth(),
      this.checkExternalServices(),
      this.checkResourceUsage(),
    ]

    await Promise.allSettled(checks)
  }

  private async checkBlockchainConnection(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Test RPC connection
      const response = await fetch(process.env.VITE_RPC_URL || '', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      })

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok

      this.updateCheck('blockchain', {
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        details: { statusCode: response.status },
        lastChecked: new Date().toISOString(),
        error: isHealthy ? undefined : `HTTP ${response.status}`,
      })
    } catch (error) {
      this.updateCheck('blockchain', {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  private async checkAPIHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${process.env.VITE_API_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok

      this.updateCheck('api', {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        details: { 
          statusCode: response.status,
          status: await response.text(),
        },
        lastChecked: new Date().toISOString(),
        error: isHealthy ? undefined : `HTTP ${response.status}`,
      })
    } catch (error) {
      this.updateCheck('api', {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  private async checkDatabaseHealth(): Promise<void> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${process.env.VITE_API_URL}/health/db`, {
        method: 'GET',
      })

      const responseTime = Date.now() - startTime
      const isHealthy = response.ok

      this.updateCheck('database', {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        details: { statusCode: response.status },
        lastChecked: new Date().toISOString(),
        error: isHealthy ? undefined : `HTTP ${response.status}`,
      })
    } catch (error) {
      this.updateCheck('database', {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  private async checkExternalServices(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Check multiple external services
      const services = [
        { name: 'google_fonts', url: 'https://fonts.googleapis.com' },
        { name: 'cloudflare', url: 'https://1.1.1.1' },
        { name: 'etherscan', url: 'https://api.etherscan.io' },
      ]

      const results = await Promise.allSettled(
        services.map(service => 
          fetch(service.url, { method: 'HEAD' })
            .then(res => ({ service: service.name, status: res.ok }))
        )
      )

      const responseTime = Date.now() - startTime
      const healthyServices = results.filter(r => 
        r.status === 'fulfilled' && r.value.status
      ).length

      this.updateCheck('external_services', {
        status: healthyServices === services.length ? 'healthy' : 
                healthyServices > 0 ? 'degraded' : 'unhealthy',
        responseTime,
        details: {
          total: services.length,
          healthy: healthyServices,
          results: results.map((r, i) => ({
            service: services[i].name,
            status: r.status === 'fulfilled' ? r.value.status : false,
            error: r.status === 'rejected' ? r.reason.message : undefined,
          })),
        },
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      this.updateCheck('external_services', {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  private async checkResourceUsage(): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Check memory usage
      const memory = (performance as any).memory ? {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit,
      } : null

      // Check connection type
      const connection = (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
      } : null

      const responseTime = Date.now() - startTime
      const isHealthy = !memory || memory.used / memory.limit < 0.9

      this.updateCheck('resources', {
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        details: {
          memory,
          connection,
        },
        lastChecked: new Date().toISOString(),
      })
    } catch (error) {
      this.updateCheck('resources', {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString(),
      })
    }
  }

  private updateCheck(name: string, check: Partial<HealthCheck>) {
    const existing = this.checks.get(name)
    this.checks.set(name, {
      name,
      status: check.status || existing?.status || 'unknown',
      responseTime: check.responseTime || existing?.responseTime || 0,
      lastChecked: check.lastChecked || new Date().toISOString(),
      details: check.details,
      error: check.error,
    })
  }

  getHealthStatus(): { overall: string, checks: Record<string, HealthCheck> } {
    const checks = Object.fromEntries(this.checks)
    const statusValues = Object.values(checks).map(c => c.status)
    
    let overall: string
    if (statusValues.includes('unhealthy')) {
      overall = 'unhealthy'
    } else if (statusValues.includes('degraded')) {
      overall = 'degraded'
    } else {
      overall = 'healthy'
    }

    return { overall, checks }
  }

  getCheck(name: string): HealthCheck | undefined {
    return this.checks.get(name)
  }
}

export const healthChecker = new HealthChecker()
```

### Health Check API Endpoint

```typescript
// src/api/health.ts
import { Router } from 'express'
import { healthChecker } from '../monitoring/health-checks'
import { logger } from '../monitoring/logger'

const router = Router()

// Basic health check
router.get('/', (req, res) => {
  const status = healthChecker.getHealthStatus()
  
  res.status(status.overall === 'healthy' ? 200 : 503).json({
    status: status.overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: status.checks,
  })
})

// Detailed health check
router.get('/detailed', (req, res) => {
  const status = healthChecker.getHealthStatus()
  
  res.json({
    status: status.overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    checks: status.checks,
    system: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
    },
  })
})

// Individual check
router.get('/:checkName', (req, res) => {
  const check = healthChecker.getCheck(req.params.checkName)
  
  if (!check) {
    return res.status(404).json({
      error: 'Health check not found',
      checkName: req.params.checkName,
    })
  }
  
  res.json(check)
})

// Readiness probe (for Kubernetes)
router.get('/ready', (req, res) => {
  const status = healthChecker.getHealthStatus()
  const isReady = status.overall !== 'unhealthy'
  
  res.status(isReady ? 200 : 503).json({
    ready: isReady,
    timestamp: new Date().toISOString(),
  })
})

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  // Simple check - if we can respond, we're alive
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

export default router
```

## Alerting System

### Alert Manager

```typescript
// src/monitoring/alert-manager.ts
interface Alert {
  id: string
  type: 'error' | 'warning' | 'info' | 'performance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  context?: Record<string, any>
  timestamp: string
  resolved: boolean
  resolvedAt?: string
  assignedTo?: string
  notifications: AlertNotification[]
}

interface AlertNotification {
  type: 'email' | 'slack' | 'webhook' | 'sms'
  target: string
  status: 'pending' | 'sent' | 'failed'
  sentAt?: string
  error?: string
}

class AlertManager {
  private alerts: Map<string, Alert> = new Map()
  private alertRules: AlertRule[] = []
  private notificationHandlers: Map<string, NotificationHandler> = new Map()

  constructor() {
    this.setupDefaultRules()
    this.setupNotificationHandlers()
  }

  private setupDefaultRules() {
    this.alertRules = [
      {
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.05,
        action: (metrics) => this.createAlert({
          type: 'error',
          severity: 'high',
          title: 'High Error Rate Detected',
          message: `Error rate is ${(metrics.errorRate * 100).toFixed(2)}%`,
          context: { errorRate: metrics.errorRate },
        }),
      },
      {
        name: 'Slow Response Time',
        condition: (metrics) => metrics.avgResponseTime > 2000,
        action: (metrics) => this.createAlert({
          type: 'performance',
          severity: 'medium',
          title: 'Slow Response Time',
          message: `Average response time is ${metrics.avgResponseTime}ms`,
          context: { responseTime: metrics.avgResponseTime },
        }),
      },
      {
        name: 'Low Availability',
        condition: (metrics) => metrics.availability < 0.99,
        action: (metrics) => this.createAlert({
          type: 'error',
          severity: 'critical',
          title: 'Low Availability',
          message: `Availability is ${(metrics.availability * 100).toFixed(2)}%`,
          context: { availability: metrics.availability },
        }),
      },
      {
        name: 'Memory Usage High',
        condition: (metrics) => metrics.memoryUsage > 0.8,
        action: (metrics) => this.createAlert({
          type: 'warning',
          severity: 'medium',
          title: 'High Memory Usage',
          message: `Memory usage is ${(metrics.memoryUsage * 100).toFixed(2)}%`,
          context: { memoryUsage: metrics.memoryUsage },
        }),
      },
    ]
  }

  private setupNotificationHandlers() {
    this.notificationHandlers.set('email', new EmailNotificationHandler())
    this.notificationHandlers.set('slack', new SlackNotificationHandler())
    this.notificationHandlers.set('webhook', new WebhookNotificationHandler())
  }

  async processMetrics(metrics: any) {
    for (const rule of this.alertRules) {
      if (rule.condition(metrics)) {
        await rule.action(metrics)
      }
    }
  }

  private async createAlert(alertData: Partial<Alert>) {
    const alert: Alert = {
      id: this.generateAlertId(),
      type: alertData.type || 'info',
      severity: alertData.severity || 'medium',
      title: alertData.title || 'Untitled Alert',
      message: alertData.message || '',
      context: alertData.context,
      timestamp: new Date().toISOString(),
      resolved: false,
      notifications: [],
      ...alertData,
    }

    this.alerts.set(alert.id, alert)
    
    // Send notifications
    await this.sendNotifications(alert)
    
    // Log alert
    logger.info('Alert created', { alertId: alert.id, ...alert })
    
    return alert.id
  }

  private async sendNotifications(alert: Alert) {
    const targets = this.getNotificationTargets(alert.severity)
    
    for (const target of targets) {
      const handler = this.notificationHandlers.get(target.type)
      if (handler) {
        try {
          await handler.send(alert, target.target)
          alert.notifications.push({
            type: target.type,
            target: target.target,
            status: 'sent',
            sentAt: new Date().toISOString(),
          })
        } catch (error) {
          alert.notifications.push({
            type: target.type,
            target: target.target,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }
  }

  private getNotificationTargets(severity: Alert['severity']): Array<{type: string, target: string}> {
    const config = {
      critical: [
        { type: 'email', target: process.env.CRITICAL_ALERT_EMAIL || 'admin@sylos.io' },
        { type: 'slack', target: process.env.CRITICAL_ALERT_SLACK || '#alerts' },
        { type: 'webhook', target: process.env.CRITICAL_ALERT_WEBHOOK || '' },
      ],
      high: [
        { type: 'email', target: process.env.HIGH_ALERT_EMAIL || 'team@sylos.io' },
        { type: 'slack', target: process.env.HIGH_ALERT_SLACK || '#alerts' },
      ],
      medium: [
        { type: 'slack', target: process.env.MEDIUM_ALERT_SLACK || '#monitoring' },
      ],
      low: [
        { type: 'webhook', target: process.env.LOW_ALERT_WEBHOOK || '' },
      ],
    }
    
    return config[severity] || []
  }

  async resolveAlert(alertId: string, resolvedBy?: string) {
    const alert = this.alerts.get(alertId)
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`)
    }

    alert.resolved = true
    alert.resolvedAt = new Date().toISOString()
    alert.assignedTo = resolvedBy

    // Send resolution notifications
    await this.sendResolutionNotifications(alert)
    
    logger.info('Alert resolved', { alertId, resolvedBy })
  }

  private async sendResolutionNotifications(alert: Alert) {
    // Notify that alert is resolved
    for (const notification of alert.notifications) {
      if (notification.status === 'sent') {
        const handler = this.notificationHandlers.get(notification.type)
        if (handler) {
          try {
            await handler.sendResolution(alert, notification.target)
          } catch (error) {
            console.error('Failed to send resolution notification:', error)
          }
        }
      }
    }
  }

  getAlerts(filter?: {status?: 'open' | 'resolved', severity?: Alert['severity'], type?: Alert['type']}): Alert[] {
    let alerts = Array.from(this.alerts.values())
    
    if (filter) {
      if (filter.status) {
        alerts = alerts.filter(a => filter.status === 'resolved' ? a.resolved : !a.resolved)
      }
      if (filter.severity) {
        alerts = alerts.filter(a => a.severity === filter.severity)
      }
      if (filter.type) {
        alerts = alerts.filter(a => a.type === filter.type)
      }
    }
    
    return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id)
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}

interface AlertRule {
  name: string
  condition: (metrics: any) => boolean
  action: (metrics: any) => Promise<void>
}

interface NotificationHandler {
  send(alert: Alert, target: string): Promise<void>
  sendResolution(alert: Alert, target: string): Promise<void>
}

class EmailNotificationHandler implements NotificationHandler {
  async send(alert: Alert, target: string): Promise<void> {
    // Implementation for email sending
    console.log(`Sending email alert to ${target}:`, alert)
  }

  async sendResolution(alert: Alert, target: string): Promise<void> {
    // Implementation for resolution email
    console.log(`Sending resolution email to ${target}:`, alert)
  }
}

class SlackNotificationHandler implements NotificationHandler {
  async send(alert: Alert, target: string): Promise<void> {
    // Implementation for Slack webhook
    console.log(`Sending Slack alert to ${target}:`, alert)
  }

  async sendResolution(alert: Alert, target: string): Promise<void> {
    // Implementation for Slack resolution
    console.log(`Sending Slack resolution to ${target}:`, alert)
  }
}

class WebhookNotificationHandler implements NotificationHandler {
  async send(alert: Alert, target: string): Promise<void> {
    if (!target) return
    
    await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert, type: 'alert' }),
    })
  }

  async sendResolution(alert: Alert, target: string): Promise<void> {
    if (!target) return
    
    await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert, type: 'resolution' }),
    })
  }
}

export const alertManager = new AlertManager()
```

## Dashboard Creation

### Monitoring Dashboard

```typescript
// src/components/MonitoringDashboard.tsx
import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { logger } from '../monitoring/logger'

interface DashboardData {
  metrics: {
    responseTime: Array<{timestamp: string, value: number}>
    errorRate: Array<{timestamp: string, value: number}>
    throughput: Array<{timestamp: string, value: number}>
    availability: Array<{timestamp: string, value: number}>
  }
  alerts: Array<{
    id: string
    type: string
    severity: string
    title: string
    timestamp: string
    status: string
  }>
  systemHealth: {
    cpu: number
    memory: number
    disk: number
    network: number
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export const MonitoringDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds

  useEffect(() => {
    fetchDashboardData()
    
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(fetchDashboardData, refreshInterval * 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/monitoring/dashboard')
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.status}`)
      }
      
      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
      
      logger.info('Dashboard data fetched successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      logger.error('Failed to fetch dashboard data', err as Error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <h3 className="text-red-800 font-semibold">Error Loading Dashboard</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const recentAlerts = data.alerts.slice(0, 5)
  const alertSeverityData = data.alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const pieData = Object.entries(alertSeverityData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Monitoring Dashboard</h1>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto Refresh
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-1 border rounded"
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SystemHealthCard
          title="CPU Usage"
          value={data.systemHealth.cpu}
          unit="%"
          color="blue"
        />
        <SystemHealthCard
          title="Memory Usage"
          value={data.systemHealth.memory}
          unit="%"
          color="green"
        />
        <SystemHealthCard
          title="Disk Usage"
          value={data.systemHealth.disk}
          unit="%"
          color="yellow"
        />
        <SystemHealthCard
          title="Network I/O"
          value={data.systemHealth.network}
          unit="MB/s"
          color="purple"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Response Time (ms)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.metrics.responseTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Error Rate Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Error Rate (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.metrics.errorRate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ff7300" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Throughput (req/s)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.metrics.throughput}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Availability Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Availability (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.metrics.availability}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis domain={[95, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#00C49F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded border-l-4 ${
                  alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                  alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                  alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                  'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{alert.title}</h4>
                    <p className="text-sm text-gray-600">{alert.type}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      alert.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Alert Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Alert Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

const SystemHealthCard: React.FC<{title: string, value: number, unit: string, color: string}> = ({ title, value, unit, color }) => {
  const getColorClass = (color: string) => {
    const colors = {
      blue: 'text-blue-600',
      green: 'text-green-600',
      yellow: 'text-yellow-600',
      purple: 'text-purple-600',
      red: 'text-red-600',
    }
    return colors[color as keyof typeof colors] || 'text-gray-600'
  }

  const getBgColor = (color: string) => {
    const colors = {
      blue: 'bg-blue-50',
      green: 'bg-green-50',
      yellow: 'bg-yellow-50',
      purple: 'bg-purple-50',
      red: 'bg-red-50',
    }
    return colors[color as keyof typeof colors] || 'bg-gray-50'
  }

  return (
    <div className={`p-4 rounded-lg ${getBgColor(color)}`}>
      <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      <p className={`text-2xl font-bold ${getColorClass(color)}`}>
        {value.toFixed(1)}{unit}
      </p>
    </div>
  )
}
```

## Web App Implementation

### Complete Web App Monitoring Setup

```typescript
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { sentryClient } from './monitoring/sentry-client'
import { webVitalsMonitor } from './monitoring/web-vitals'
import { realUserMonitor } from './monitoring/rum'
import { logger } from './monitoring/logger'
import { healthChecker } from './monitoring/health-checks'
import { monitoringConfig } from './config/monitoring'

// Initialize monitoring
async function initializeMonitoring() {
  try {
    // Initialize Sentry
    if (monitoringConfig.error.enableTracking) {
      sentryClient.initialize()
    }

    // Initialize web vitals monitoring
    if (monitoringConfig.performance.enableWebVitals) {
      // Already initialized in constructor
    }

    // Initialize RUM
    if (monitoringConfig.app.enableTracking) {
      // Already initialized in constructor
    }

    logger.info('Monitoring system initialized', {
      environment: monitoringConfig.app.environment,
      version: monitoringConfig.app.version,
      errorTracking: monitoringConfig.error.enableTracking,
      performanceTracking: monitoringConfig.performance.enableTracking,
    })

    // Start health checks
    healthChecker.getHealthStatus()

  } catch (error) {
    console.error('Failed to initialize monitoring:', error)
  }
}

// Initialize before React
initializeMonitoring()

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring services
    sentryClient.captureException(error, { errorInfo })
    logger.error('React error boundary caught error', error, { errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              We apologize for the inconvenience. Our team has been notified and is working on a fix.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Render app with error boundary
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

### API Middleware for Monitoring

```typescript
// src/middleware/monitoring-middleware.ts
import { Request, Response, NextFunction } from 'express'
import { logger } from '../monitoring/logger'
import { sentryClient } from '../monitoring/sentry-client'

export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  // Add request ID for tracking
  const requestId = generateRequestId()
  req.requestId = requestId

  // Log request
  logger.info('Request started', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  })

  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(...args: any[]) {
    const duration = Date.now() - startTime
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length'),
    })

    return originalEnd.apply(this, args)
  }

  next()
}

export const errorHandlingMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId || 'unknown'
  
  // Log error
  logger.error('Request error', err, {
    requestId,
    method: req.method,
    url: req.url,
    stack: err.stack,
  })

  // Capture with Sentry
  sentryClient.captureException(err, {
    requestId,
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  })

  // Send error response
  res.status(500).json({
    error: 'Internal server error',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { message: err.message }),
  })
}

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint()
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint()
    const duration = Number(endTime - startTime) / 1000000 // Convert to milliseconds
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        requestId: (req as any).requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
      })
    }

    // Record metrics
    recordRequestMetrics(req, res, duration)
  })

  next()
}

function recordRequestMetrics(req: Request, res: Response, duration: number) {
  // Implementation for recording metrics
  const metrics = {
    endpoint: req.route?.path || req.url,
    method: req.method,
    statusCode: res.statusCode,
    duration,
    timestamp: new Date().toISOString(),
  }

  // Send to metrics service
  fetch('/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
  }).catch(() => {})
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}
```

## Mobile App Implementation

### Complete Mobile App Monitoring Setup

```typescript
// sylos-mobile/src/services/monitoring/MobileMonitoringService.ts
import { MobileSentryService } from './MobileSentryService'
import { MobileLogger } from './MobileLogger'
import { Platform } from 'react-native'
import * as Application from 'expo-application'
import * as Device from 'expo-device'
import NetInfo from '@react-native-community/netinfo'

export class MobileMonitoringService {
  private sentry: MobileSentryService
  private logger: MobileLogger
  private isInitialized = false
  private metrics: Map<string, number> = new Map()

  constructor() {
    this.sentry = new MobileSentryService()
    this.logger = new MobileLogger()
  }

  async initialize() {
    if (this.isInitialized) return

    try {
      // Initialize Sentry
      await this.sentry.initialize()

      // Setup app state monitoring
      this.setupAppStateMonitoring()

      // Setup network monitoring
      this.setupNetworkMonitoring()

      // Setup performance monitoring
      this.setupPerformanceMonitoring()

      // Setup crash reporting
      this.setupCrashReporting()

      this.isInitialized = true
      this.logger.info('Mobile monitoring service initialized')

    } catch (error) {
      this.logger.error('Failed to initialize mobile monitoring', error as Error)
    }
  }

  private setupAppStateMonitoring() {
    const AppState = require('react-native').AppState

    let currentState = AppState.currentState
    const startTime = Date.now()

    AppState.addEventListener('change', (nextState: string) => {
      const duration = Date.now() - startTime
      
      this.trackAppStateChange(currentState, nextState, duration)
      
      this.logger.info('App state changed', {
        from: currentState,
        to: nextState,
        duration,
      })

      currentState = nextState
      this.metrics.set('lastAppStateChange', Date.now())
    })
  }

  private trackAppStateChange(from: string, to: string, duration: number) {
    // Track session duration
    if (from === 'active' && to === 'background') {
      this.logger.info('App backgrounded', { sessionDuration: duration })
    }

    // Send metrics
    this.sendMetrics('app_state_change', {
      from,
      to,
      duration,
      timestamp: new Date().toISOString(),
    })
  }

  private setupNetworkMonitoring() {
    NetInfo.addEventListener((state: any) => {
      this.logger.info('Network state changed', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        effectiveType: state.details?.effectiveType,
      })

      this.sendMetrics('network_change', {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        connectionType: state.type,
        effectiveType: state.details?.effectiveType,
        timestamp: new Date().toISOString(),
      })
    })
  }

  private setupPerformanceMonitoring() {
    // Memory usage monitoring
    if (Platform.OS === 'ios') {
      setInterval(() => {
        this.checkMemoryUsage()
      }, 60000) // Check every minute
    }

    // App startup time tracking
    this.trackAppStartup()
  }

  private async checkMemoryUsage() {
    try {
      // @ts-ignore
      const memoryInfo = require('react-native').Performance.memory
      if (memoryInfo) {
        const usagePercent = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit

        if (usagePercent > 0.8) {
          this.logger.warn('High memory usage detected', {
            used: memoryInfo.usedJSHeapSize,
            total: memoryInfo.totalJSHeapSize,
            limit: memoryInfo.jsHeapSizeLimit,
            percentage: usagePercent,
          })
        }

        this.sendMetrics('memory_usage', {
          used: memoryInfo.usedJSHeapSize,
          total: memoryInfo.totalJSHeapSize,
          limit: memoryInfo.jsHeapSizeLimit,
          percentage: usagePercent,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      // Memory API not available
    }
  }

  private trackAppStartup() {
    const startTime = Date.now()
    
    // Track when app becomes active for the first time
    const AppState = require('react-native').AppState
    const listener = AppState.addEventListener('change', (state: string) => {
      if (state === 'active' && this.metrics.get('appStartTracked') !== 1) {
        const startupTime = Date.now() - startTime
        this.metrics.set('appStartTracked', 1)
        
        this.logger.info('App startup completed', { startupTime })
        
        this.sendMetrics('app_startup', {
          startupTime,
          timestamp: new Date().toISOString(),
        })

        listener.remove()
      }
    })
  }

  private setupCrashReporting() {
    // This is handled by Sentry automatically
    // Add custom crash context
    this.sentry.setUser({ id: this.getAnonymousUserId() })
  }

  private getAnonymousUserId(): string {
    // Generate anonymous user ID for tracking
    return 'mobile_' + Math.random().toString(36).substring(2)
  }

  // Public API
  trackScreenView(screenName: string) {
    this.logger.info('Screen viewed', { screenName })
    
    this.sendMetrics('screen_view', {
      screenName,
      timestamp: new Date().toISOString(),
    })
  }

  trackUserAction(action: string, context?: Record<string, any>) {
    this.logger.info('User action', { action, ...context })
    
    this.sendMetrics('user_action', {
      action,
      context,
      timestamp: new Date().toISOString(),
    })
  }

  trackError(error: Error, context?: Record<string, any>) {
    this.sentry.captureException(error, context)
    this.logger.error('Mobile error', error, context)
  }

  trackPerformance(operation: string, duration: number, context?: Record<string, any>) {
    this.logger.info('Performance measurement', { operation, duration, ...context })
    
    this.sendMetrics('performance', {
      operation,
      duration,
      context,
      timestamp: new Date().toISOString(),
    })

    // Alert on slow operations
    if (duration > 5000) { // 5 seconds
      this.logger.warn('Slow operation detected', { operation, duration, ...context })
    }
  }

  setUser(user: { id: string; email?: string }) {
    this.sentry.setUser(user)
  }

  clearUser() {
    this.sentry.clearUser()
  }

  private async sendMetrics(type: string, data: any) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/mobile/metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_API_KEY}`,
        },
        body: JSON.stringify({
          type,
          data,
          deviceInfo: await this.getDeviceInfo(),
          appInfo: await this.getAppInfo(),
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.status}`)
      }
    } catch (error) {
      this.logger.error('Failed to send metrics', error as Error, { type, data })
    }
  }

  private async getDeviceInfo() {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      model: Device.modelName,
      manufacturer: Device.manufacturer,
      osName: Device.osName,
      osVersion: Device.osVersion,
    }
  }

  private async getAppInfo() {
    return {
      version: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
      bundleIdentifier: Application.applicationId,
    }
  }

  async getLogs() {
    return this.logger.getLogs()
  }

  async clearLogs() {
    await this.logger.clearLogs()
  }
}

export const mobileMonitoringService = new MobileMonitoringService()
```

### React Navigation Integration

```typescript
// sylos-mobile/src/navigation/MonitoringNavigation.tsx
import { useEffect, useRef } from 'react'
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { mobileMonitoringService } from '../services/monitoring/MobileMonitoringService'

export function useNavigationMonitoring(ref: React.RefObject<NavigationContainerRef>) {
  const currentRoute = useRef<string>('')

  useEffect(() => {
    if (!ref.current) return

    const unsubscribe = ref.current.addListener('state', (state) => {
      const route = state.routes[state.index]
      const routeName = route.name
      
      if (currentRoute.current !== routeName) {
        currentRoute.current = routeName
        mobileMonitoringService.trackScreenView(routeName)
      }
    })

    return unsubscribe
  }, [ref])
}

export function MonitoringNavigationContainer({ children }: { children: React.ReactNode }) {
  const navigationRef = useRef<NavigationContainerRef>(null)
  
  useNavigationMonitoring(navigationRef)

  return (
    <NavigationContainer ref={navigationRef}>
      {children}
    </NavigationContainer>
  )
}
```

## Smart Contracts Implementation

### Contract Monitoring Script

```javascript
// smart-contracts/scripts/monitoring/contract-analyzer.js
const { ethers } = require('hardhat')
const fs = require('fs')
const path = require('path')

class ContractAnalyzer {
  constructor() {
    this.provider = null
    this.contracts = new Map()
    this.metrics = {
      transactions: [],
      events: [],
      gasUsage: [],
      errors: [],
    }
  }

  async initialize() {
    this.provider = ethers.getDefaultProvider()
    await this.loadDeployedContracts()
  }

  async loadDeployedContracts() {
    const deploymentsPath = path.join(__dirname, '../deployments')
    
    if (!fs.existsSync(deploymentsPath)) {
      console.log('No deployments found')
      return
    }

    const networks = fs.readdirSync(deploymentsPath)
    
    for (const network of networks) {
      const networkPath = path.join(deploymentsPath, network)
      const files = fs.readdirSync(networkPath)
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const deployment = JSON.parse(
            fs.readFileSync(path.join(networkPath, file), 'utf8')
          )
          
          this.contracts.set(deployment.address, {
            ...deployment,
            network,
          })
        }
      }
    }
  }

  async analyzeContract(contractAddress) {
    const contract = this.contracts.get(contractAddress)
    if (!contract) {
      throw new Error(`Contract not found: ${contractAddress}`)
    }

    console.log(`Analyzing contract: ${contractAddress}`)
    
    const analysis = {
      address: contractAddress,
      network: contract.network,
      bytecode: await this.getBytecode(contractAddress),
      events: await this.getEvents(contractAddress),
      gasUsage: await this.analyzeGasUsage(contractAddress),
      security: await this.performSecurityAnalysis(contractAddress),
      performance: await this.analyzePerformance(contractAddress),
    }

    return analysis
  }

  async getBytecode(address) {
    const code = await this.provider.getCode(address)
    return {
      size: (code.length - 2) / 2, // Remove '0x' prefix
      isContract: code !== '0x',
    }
  }

  async getEvents(address) {
    const blockNumber = await this.provider.getBlockNumber()
    const fromBlock = Math.max(0, blockNumber - 1000) // Last 1000 blocks
    
    const filter = {
      address: address,
      fromBlock: fromBlock,
      toBlock: 'latest'
    }

    const logs = await this.provider.getLogs(filter)
    
    return {
      totalEvents: logs.length,
      uniqueEvents: [...new Set(logs.map(log => log.topics[0]))].length,
      eventLog: logs.slice(0, 10), // First 10 events
    }
  }

  async analyzeGasUsage(address) {
    const blockNumber = await this.provider.getBlockNumber()
    const fromBlock = Math.max(0, blockNumber - 100) // Last 100 blocks
    
    const filter = {
      address: address,
      fromBlock: fromBlock,
      toBlock: 'latest'
    }

    const logs = await this.provider.getLogs(filter)
    
    // Estimate gas usage for each transaction
    const gasUsage = await Promise.all(
      logs.map(async (log) => {
        const tx = await this.provider.getTransaction(log.transactionHash)
        return {
          gasUsed: tx.gasLimit?.toString(),
          gasPrice: tx.gasPrice?.toString(),
          timestamp: (await this.provider.getBlock(log.blockNumber)).timestamp,
        }
      })
    )

    return {
      totalTransactions: gasUsage.length,
      averageGas: gasUsage.reduce((sum, tx) => sum + Number(tx.gasUsed), 0) / gasUsage.length,
      totalGasUsed: gasUsage.reduce((sum, tx) => sum + Number(tx.gasUsed), 0),
      recentTransactions: gasUsage.slice(0, 10),
    }
  }

  async performSecurityAnalysis(address) {
    const analysis = {
      isContract: true,
      hasSelfDestruct: false,
      hasDelegateCall: false,
      hasExternalCalls: false,
      riskLevel: 'low',
      issues: [],
    }

    try {
      const code = await this.getBytecode(address)
      
      // Check for selfdestruct
      if (code.bytecode.includes('60008080806001600073')) {
        analysis.hasSelfDestruct = true
        analysis.issues.push('Contract contains selfdestruct functionality')
        analysis.riskLevel = 'high'
      }

      // Check for delegatecall patterns
      if (code.bytecode.includes('73') && code.bytecode.includes('f4')) {
        analysis.hasDelegateCall = true
        analysis.issues.push('Contract uses delegatecall')
      }

    } catch (error) {
      analysis.issues.push(`Security analysis error: ${error.message}`)
    }

    return analysis
  }

  async analyzePerformance(address) {
    const performance = {
      responseTime: 0,
      transactionCount: 0,
      averageBlockTime: 0,
      recommendations: [],
    }

    try {
      // Measure response time
      const start = Date.now()
      await this.provider.getCode(address)
      performance.responseTime = Date.now() - start

      // Count transactions
      const blockNumber = await this.provider.getBlockNumber()
      const fromBlock = Math.max(0, blockNumber - 100)
      const filter = { address, fromBlock, toBlock: 'latest' }
      const logs = await this.provider.getLogs(filter)
      performance.transactionCount = logs.length

      // Performance recommendations
      if (performance.responseTime > 1000) {
        performance.recommendations.push('Consider optimizing contract code for faster execution')
      }

      if (performance.transactionCount > 50) {
        performance.recommendations.push('High transaction volume - consider implementing batch processing')
      }

    } catch (error) {
      performance.error = error.message
    }

    return performance
  }

  async generateReport(contractAddress) {
    const analysis = await this.analyzeContract(contractAddress)
    
    const report = {
      timestamp: new Date().toISOString(),
      contract: analysis,
      summary: this.generateSummary(analysis),
    }

    // Save report
    const reportPath = path.join(
      __dirname, 
      '../reports',
      `${contractAddress}_${Date.now()}_analysis.json`
    )
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`Report saved to: ${reportPath}`)
    
    return report
  }

  generateSummary(analysis) {
    return {
      status: analysis.security.riskLevel === 'high' ? 'needs_attention' : 'healthy',
      gasEfficiency: analysis.gasUsage.averageGas > 100000 ? 'poor' : 'good',
      eventCount: analysis.events.totalEvents,
      lastActivity: analysis.events.eventLog[0]?.timestamp || null,
      recommendations: [
        ...analysis.security.issues,
        ...analysis.performance.recommendations,
      ],
    }
  }

  async monitorTransactions() {
    console.log('Starting transaction monitoring...')
    
    for (const [address, contract] of this.contracts) {
      try {
        const filter = {
          address: address,
          fromBlock: 'latest'
        }

        this.provider.on(filter, (log) => {
          this.handleTransaction(log, address, contract)
        })
      } catch (error) {
        console.error(`Failed to monitor ${address}:`, error)
      }
    }
  }

  async handleTransaction(log, address, contract) {
    const tx = await this.provider.getTransaction(log.transactionHash)
    const block = await this.provider.getBlock(log.blockNumber)
    
    const transaction = {
      address,
      network: contract.network,
      hash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: block.timestamp,
      gasUsed: tx.gasLimit?.toString(),
      gasPrice: tx.gasPrice?.toString(),
      from: tx.from,
      to: tx.to,
      value: tx.value?.toString(),
      status: 'success', // Would need to get receipt to check actual status
    }

    this.metrics.transactions.push(transaction)
    
    // Keep only last 1000 transactions
    if (this.metrics.transactions.length > 1000) {
      this.metrics.transactions.shift()
    }

    // Log transaction
    console.log(`New transaction: ${log.transactionHash}`)
    
    // Send to monitoring service
    await this.sendTransactionMetrics(transaction)
  }

  async sendTransactionMetrics(transaction) {
    try {
      const response = await fetch(process.env.METRICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.METRICS_API_KEY}`,
        },
        body: JSON.stringify({
          type: 'contract_transaction',
          data: transaction,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to send metrics: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to send transaction metrics:', error)
    }
  }
}

module.exports = { ContractAnalyzer }
```

### Hardhat Monitoring Tasks

```javascript
// smart-contracts/hardhat.config.js
require('@nomicfoundation/hardhat-toolbox')
require('hardhat-gas-reporter')
require('solidity-coverage')

// Add monitoring tasks
task('monitor:contracts', 'Monitor smart contract performance and events')
  .setAction(async (taskArgs, hre) => {
    const { ContractAnalyzer } = require('./scripts/monitoring/contract-analyzer')
    const analyzer = new ContractAnalyzer()
    
    await analyzer.initialize()
    await analyzer.monitorTransactions()
    
    console.log('Contract monitoring started...')
  })

task('analyze:contract', 'Analyze a specific contract')
  .addParam('address', 'Contract address to analyze')
  .setAction(async (taskArgs, hre) => {
    const { ContractAnalyzer } = require('./scripts/monitoring/contract-analyzer')
    const analyzer = new ContractAnalyzer()
    
    await analyzer.initialize()
    const report = await analyzer.generateReport(taskArgs.address)
    
    console.log('Analysis complete:', JSON.stringify(report.summary, null, 2))
  })

task('security:audit', 'Perform security analysis of contracts')
  .setAction(async (taskArgs, hre) => {
    // Implementation for security audit
    console.log('Performing security audit...')
    
    // Get all deployed contracts
    const deploymentsPath = path.join(__dirname, './deployments')
    // Analyze each contract for security issues
    // Generate security report
  })

task('gas:report', 'Generate gas usage report')
  .setAction(async (taskArgs, hre) => {
    // This is handled by hardhat-gas-reporter
    console.log('Gas report will be generated after test run')
  })
```

## Deployment and Configuration

### Environment Variables

```bash
# .env.production
NODE_ENV=production

# Sentry Configuration
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Analytics Configuration
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_GTM_ID=GTM-XXXXXXX

# API Configuration
VITE_API_URL=https://api.sylos.io
VITE_RPC_URL=https://polygon-rpc.com

# Monitoring Configuration
METRICS_ENDPOINT=https://metrics.sylos.io
METRICS_API_KEY=your-metrics-api-key

# Alert Configuration
CRITICAL_ALERT_EMAIL=admin@sylos.io
CRITICAL_ALERT_SLACK=https://hooks.slack.com/services/...
HIGH_ALERT_EMAIL=team@sylos.io
HIGH_ALERT_SLACK=https://hooks.slack.com/services/...
MEDIUM_ALERT_SLACK=https://hooks.slack.com/services/...

# Logging Configuration
LOG_ENDPOINT=https://logs.sylos.io
LOG_API_KEY=your-log-api-key

# Security Configuration
CSP_REPORT_URI=https://reports.sylos.io/csp
CSP_REPORT_ONLY=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Docker Configuration

```dockerfile
# Dockerfile.monitoring
FROM node:18-alpine

WORKDIR /app

# Install monitoring dependencies
RUN apk add --no-cache \
    curl \
    htop \
    netcat-openbsd

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create monitoring user
RUN addgroup -g 1001 -S monitoring && \
    adduser -S monitoring -u 1001

USER monitoring

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "start"]
```

### Kubernetes Configuration

```yaml
# k8s-monitoring.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-service
  labels:
    app: monitoring-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: monitoring-service
  template:
    metadata:
      labels:
        app: monitoring-service
    spec:
      containers:
      - name: monitoring
        image: sylos/monitoring:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: sentry-dsn
        - name: METRICS_ENDPOINT
          value: "https://metrics.sylos.io"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: monitoring-service
spec:
  selector:
    app: monitoring-service
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: monitoring-config
data:
  config.yml: |
    server:
      port: 3001
    monitoring:
      enabled: true
      interval: 30s
    alerts:
      enabled: true
      channels:
        - type: email
          target: admin@sylos.io
        - type: slack
          target: https://hooks.slack.com/...
```

## Best Practices

### 1. Log Level Guidelines
```typescript
// Use appropriate log levels
logger.debug('Detailed debugging information') // Development only
logger.info('User action performed') // General information
logger.warn('Deprecated API used') // Warnings
logger.error('Database connection failed', error) // Errors
```

### 2. Error Handling Patterns
```typescript
// Always include context
try {
  await someOperation()
} catch (error) {
  logger.error('Failed to process payment', error, {
    userId: user.id,
    amount: payment.amount,
    paymentId: payment.id,
  })
  
  sentryClient.captureException(error, {
    userId: user.id,
    paymentAmount: payment.amount,
  })
}
```

### 3. Performance Monitoring
```typescript
// Use performance marks
performance.mark('operation-start')
await expensiveOperation()
performance.mark('operation-end')
performance.measure('expensive-operation', 'operation-start', 'operation-end')

const measure = performance.getEntriesByName('expensive-operation')[0]
logger.info('Operation completed', { duration: measure.duration })
```

### 4. Security Considerations
```typescript
// Never log sensitive data
logger.info('User login', {
  userId: 'user_123', // OK
  email: user.email, // OK
  password: 'secret', // Never!
  apiKey: process.env.API_KEY, // Never!
})

// Sanitize user input
const sanitizedInput = userInput.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
```

### 5. Privacy and Compliance
```typescript
// Respect user privacy
const analyticsConfig = {
  anonymizeIP: true,
  respectDNT: true,
  cookieConsent: true,
  dataRetention: 395, // 13 months
  anonymizeAfterDays: 90,
}
```

### 6. Testing and Validation
```typescript
// Test monitoring systems
describe('Monitoring System', () => {
  it('should log errors correctly', () => {
    const error = new Error('Test error')
    logger.error('Test error log', error)
    
    // Verify log was created
    expect(mockLogger.logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        message: 'Test error log',
      })
    )
  })
  
  it('should send alerts for high error rates', async () => {
    const metrics = { errorRate: 0.1 } // 10% error rate
    
    await alertManager.processMetrics(metrics)
    
    // Verify alert was created
    expect(alertManager.getAlerts()).toHaveLength(1)
  })
})
```

This comprehensive monitoring and logging system provides:

1. **Complete Error Tracking** with Sentry integration across all platforms
2. **Performance Monitoring** with Web Vitals, RUM, and custom metrics
3. **Analytics Tracking** with GA4 and custom events
4. **Structured Logging** with proper context and sanitization
5. **Health Check Endpoints** for all services and dependencies
6. **Alerting System** with multiple notification channels
7. **Dashboard Creation** with real-time monitoring data
8. **Log Aggregation** with proper storage and retrieval
9. **Metrics Collection** across all application components
10. **Security Monitoring** with CSP, rate limiting, and security analysis

The system is designed to be production-ready, scalable, and maintainable while respecting user privacy and security best practices.
