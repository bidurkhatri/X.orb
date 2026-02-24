import { useState, useCallback, useEffect, useRef } from 'react'
import { OptimizedLazyComponents, PreloadManager, ResourceHintManager, SuspenseBoundary } from './utils/codeSplitting'
import { PerformanceMonitor, BundleAnalyzer } from './utils/performance'
import { withPerformanceOptimization, withPerformanceMonitoring } from './utils/reactOptimizations'
import NetworkRequestManager from './utils/networkOptimizations'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingPage } from './components/LoadingStates'
import { Web3Provider } from './components/Web3Provider'
import './App.css'

// Register service worker for performance optimization
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, show update prompt
              console.log('New service worker available')
            }
          })
        }
      })
    } catch (error) {
      console.warn('Service worker registration failed:', error)
    }
  }
}

// Performance monitoring component
const PerformanceMonitorComponent = () => {
  const monitor = PerformanceMonitor.getInstance()
  const [metrics, setMetrics] = useState(monitor.getMetrics())

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(monitor.getMetrics())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Log performance issues in development
  useEffect(() => {
    if (!monitor.isPerformanceGood() && import.meta.env.DEV) {
      console.warn('Performance degradation detected:', metrics)
    }
  }, [metrics])

  return null
}

// Optimized Desktop component with lazy loading
const OptimizedDesktop = withPerformanceMonitoring(
  OptimizedLazyComponents.Desktop.Component,
  { trackMounts: true, trackUnmounts: true }
)

// Optimized Lock Screen component
const OptimizedLockScreen = withPerformanceMonitoring(
  OptimizedLazyComponents.LockScreen.Component,
  { trackMounts: true, trackUnmounts: true }
)

function App() {
  const [isLocked, setIsLocked] = useState(true)
  const [isInitializing, setIsInitializing] = useState(true)
  const [initError, setInitError] = useState<Error | null>(null)
  const [preloadManager] = useState(() => PreloadManager.getInstance())
  const [resourceHints] = useState(() => ResourceHintManager.getInstance())
  const [networkManager] = useState(() => NetworkRequestManager.getInstance())
  const performanceMonitor = useRef(PerformanceMonitor.getInstance())
  const bundleAnalyzer = useRef<any>(null)

  // Enhanced unlock handler with preloading
  const handleUnlock = useCallback(async () => {
    try {
      setIsInitializing(true)

      // Start performance tracking
      performanceMonitor.current.recordEvent('app-unlock', 0)

      // Preload critical components
      preloadManager.queuePreload('core', 1)
      preloadManager.queuePreload('fileManager', 2)

      // Setup resource hints
      resourceHints.addPreconnect('https://polygon-rpc.com')
      resourceHints.addPreconnect('https://fonts.googleapis.com')

      // Simulate initialization with performance optimization
      await new Promise(resolve => setTimeout(resolve, 1000)) // Reduced from 1500ms

      // Check if we should unlock (Wallet connection handled in LockScreen)
      performanceMonitor.current.recordEvent('app-unlock-success', 0)
      setIsLocked(false)

      // Preload next likely features
      preloadManager.trackUserBehavior('/', true)
    } catch (error) {
      performanceMonitor.current.recordEvent('app-unlock-error', 0)
      setInitError(error instanceof Error ? error : new Error('Unknown initialization error'))
    } finally {
      setIsInitializing(false)
    }
  }, [preloadManager, resourceHints])

  // Initialize app with performance optimizations
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Register service worker
        await registerServiceWorker()

        // Performance monitoring auto-starts in constructor — no manual call needed

        // Initialize bundle analysis (if in staging)
        if (import.meta.env.MODE === 'staging') {
          try {
            bundleAnalyzer.current = await BundleAnalyzer.analyzeBundle()
            console.log('Bundle analysis:', bundleAnalyzer.current)
          } catch (error) {
            console.warn('Bundle analysis failed:', error)
          }
        }

      } catch (error) {
        console.warn('App initialization warning:', error)
        // Continue initialization even if some steps fail
      } finally {
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [networkManager, resourceHints])

  // Handle page visibility changes for performance
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce activity
        performanceMonitor.current.recordEvent('page-hidden', 0)
      } else {
        // Page is visible, resume normal activity
        performanceMonitor.current.recordEvent('page-visible', 0)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      performanceMonitor.current.recordEvent('network-online', 0)
    }

    const handleOffline = () => {
      performanceMonitor.current.recordEvent('network-offline', 0)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle initialization error with performance context
  if (initError) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-sylos-dark flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-red-400 text-lg mb-4">
            System Error
          </div>
          <p className="text-gray-300 mb-6">
            Failed to initialize SylOS. Performance optimization may be in progress.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-sylos-primary hover:bg-sylos-primary/80 text-white rounded-lg font-semibold transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={() => setInitError(null)}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
          {import.meta.env.DEV && (
            <details className="mt-4 text-left">
              <summary className="text-gray-400 cursor-pointer text-sm">Performance Details</summary>
              <div className="text-xs text-gray-500 mt-2 p-2 bg-black/20 rounded overflow-auto">
                <div>Performance Score: {performanceMonitor.current.getPerformanceScore()}/100</div>
                <div>Memory Usage: {Math.round((performanceMonitor.current.getMetrics().heapSize || 0) / 1024 / 1024)}MB</div>
                <div>Network Quality: {networkManager.getStats().networkQuality}</div>
                {bundleAnalyzer.current && (
                  <div>Bundle Size: {Math.round(bundleAnalyzer.current.totalSize / 1024)}KB</div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    )
  }

  // Show loading during initialization with progress
  if (isInitializing) {
    return (
      <LoadingPage
        message="Initializing SylOS with performance optimizations..."
        progress={80}
        showProgress={true}
      />
    )
  }

  return (
    <Web3Provider>
      <div className="h-screen w-screen overflow-hidden bg-sylos-dark">
        <PerformanceMonitorComponent />

        {isLocked ? (
          <ErrorBoundary level="page" enableRetry={true}>
            <SuspenseBoundary
              fallback={() => <LoadingPage message="Loading Security Module..." progress={25} />}
            >
              <OptimizedLockScreen onUnlock={handleUnlock} />
            </SuspenseBoundary>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary level="page" enableRetry={true}>
            <SuspenseBoundary
              fallback={() => <LoadingPage message="Loading Desktop Environment..." progress={50} />}
            >
              <OptimizedDesktop />
            </SuspenseBoundary>
          </ErrorBoundary>
        )}

      </div>
    </Web3Provider>
  )
}

export default withPerformanceOptimization(App, {
  name: 'App',
  trackRenders: true,
  trackProps: true
})
