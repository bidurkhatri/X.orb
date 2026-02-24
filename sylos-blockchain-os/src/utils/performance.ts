// Advanced Performance Optimization Utilities
export interface PerformanceMetrics {
  // Core Web Vitals
  LCP: number | null // Largest Contentful Paint
  FID: number | null // First Input Delay  
  CLS: number | null // Cumulative Layout Shift
  FCP: number | null // First Contentful Paint
  TTFB: number | null // Time to First Byte
  TTI: number | null // Time to Interactive
  
  // Memory metrics
  heapSize: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  
  // Network metrics
  connectionType: string
  effectiveType: string
  downlink: number
  
  // Custom metrics
  bundleSize: number
  cacheHitRate: number
  renderTime: number
}

export interface PerformanceThresholds {
  LCP: number // 2.5s
  FID: number // 100ms
  CLS: number // 0.1
  FCP: number // 1.8s
  TTFB: number // 0.6s
  TTI: number // 3.5s
  memoryUsage: number // 50MB
  bundleSize: number // 500KB
  renderTime: number // 16ms
}

// Default performance thresholds (Core Web Vitals + custom)
export const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  LCP: 2500, // 2.5s
  FID: 100, // 100ms  
  CLS: 0.1,
  FCP: 1800, // 1.8s
  TTFB: 600, // 0.6s
  TTI: 3500, // 3.5s
  memoryUsage: 50 * 1024 * 1024, // 50MB
  bundleSize: 500 * 1024, // 500KB
  renderTime: 16 // 16ms (60fps)
}

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Partial<PerformanceMetrics> = {}
  private observers: PerformanceObserver[] = []
  private thresholds: PerformanceThresholds
  private callbacks: Map<string, (metrics: PerformanceMetrics) => void> = new Map()

  private constructor() {
    this.thresholds = PERFORMANCE_THRESHOLDS
    this.initializeObservers()
    this.startMemoryMonitoring()
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  private initializeObservers() {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Paint timing
      try {
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.FCP = entry.startTime
            }
          }
        })
        paintObserver.observe({ entryTypes: ['paint'] })
        this.observers.push(paintObserver)
      } catch (e) {
        console.warn('Paint observer not supported')
      }

      // Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          this.metrics.LCP = lastEntry.startTime
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)
      } catch (e) {
        console.warn('LCP observer not supported')
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-input') {
              this.metrics.FID = entry.processingStart - entry.startTime
            }
          }
        })
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)
      } catch (e) {
        console.warn('FID observer not supported')
      }

      // Layout shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          }
          this.metrics.CLS = clsValue
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })
        this.observers.push(clsObserver)
      } catch (e) {
        console.warn('CLS observer not supported')
      }

      // Navigation timing
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming
              this.metrics.TTFB = navEntry.responseStart - navEntry.requestStart
              
              // Calculate Time to Interactive (approximation)
              const tti = navEntry.domInteractive - navEntry.navigationStart
              this.metrics.TTI = tti
            }
          }
        })
        navObserver.observe({ entryTypes: ['navigation'] })
        this.observers.push(navObserver)
      } catch (e) {
        console.warn('Navigation observer not supported')
      }
    }
  }

  private startMemoryMonitoring() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      setInterval(() => {
        if (performance.memory) {
          this.metrics.heapSize = performance.memory.usedJSHeapSize
          this.metrics.usedJSHeapSize = performance.memory.usedJSHeapSize
          this.metrics.totalJSHeapSize = performance.memory.totalJSHeapSize
        }
      }, 5000) // Monitor every 5 seconds
    }
  }

  // Get current performance metrics
  getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics
  }

  // Check if performance is within thresholds
  isPerformanceGood(): boolean {
    const metrics = this.getMetrics()
    
    if (metrics.LCP && metrics.LCP > this.thresholds.LCP) return false
    if (metrics.FID && metrics.FID > this.thresholds.FID) return false  
    if (metrics.CLS && metrics.CLS > this.thresholds.CLS) return false
    if (metrics.FCP && metrics.FCP > this.thresholds.FCP) return false
    if (metrics.TTFB && metrics.TTFB > this.thresholds.TTFB) return false
    if (metrics.TTI && metrics.TTI > this.thresholds.TTI) return false
    if (metrics.heapSize && metrics.heapSize > this.thresholds.memoryUsage) return false
    
    return true
  }

  // Get performance score (0-100)
  getPerformanceScore(): number {
    const metrics = this.getMetrics()
    let score = 100
    let metricsChecked = 0

    if (metrics.LCP) {
      const lcpScore = Math.max(0, 100 - (metrics.LCP / this.thresholds.LCP) * 100)
      score += lcpScore
      metricsChecked++
    }

    if (metrics.FID) {
      const fidScore = Math.max(0, 100 - (metrics.FID / this.thresholds.FID) * 100)
      score += fidScore
      metricsChecked++
    }

    if (metrics.CLS) {
      const clsScore = Math.max(0, 100 - (metrics.CLS / this.thresholds.CLS) * 100)
      score += clsScore
      metricsChecked++
    }

    if (metricsChecked > 0) {
      return Math.round(score / (metricsChecked + 1))
    }

    return 50 // Default score if no metrics available
  }

  // Record custom performance event
  recordEvent(name: string, duration: number) {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${name}-start`)
      setTimeout(() => {
        performance.mark(`${name}-end`)
        performance.measure(name, `${name}-start`, `${name}-end`)
      }, duration)
    }
  }

  // Register callback for performance updates
  onPerformanceUpdate(callback: (metrics: PerformanceMetrics) => void): string {
    const id = Math.random().toString(36).substr(2, 9)
    this.callbacks.set(id, callback)
    return id
  }

  // Remove callback
  removeCallback(id: string) {
    this.callbacks.delete(id)
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.callbacks.clear()
  }
}

// Network performance utility
export class NetworkOptimizer {
  private static instance: NetworkOptimizer

  static getInstance(): NetworkOptimizer {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer()
    }
    return NetworkOptimizer.instance
  }

  // Check network conditions and adjust behavior
  getNetworkQuality(): 'slow' | 'fast' | 'unknown' {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection
      if (connection) {
        const effectiveType = connection.effectiveType
        if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          return 'slow'
        }
        return 'fast'
      }
    }
    return 'unknown'
  }

  // Get optimal request concurrency based on network
  getOptimalConcurrency(): number {
    const quality = this.getNetworkQuality()
    switch (quality) {
      case 'slow':
        return 1
      case 'fast':
        return 6
      default:
        return 3
    }
  }

  // Get optimal timeout based on network
  getOptimalTimeout(): number {
    const quality = this.getNetworkQuality()
    switch (quality) {
      case 'slow':
        return 30000 // 30s
      case 'fast':
        return 10000 // 10s
      default:
        return 15000 // 15s
    }
  }
}

// Cache performance utility
export class CacheOptimizer {
  private static instance: CacheOptimizer
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()

  static getInstance(): CacheOptimizer {
    if (!CacheOptimizer.instance) {
      CacheOptimizer.instance = new CacheOptimizer()
    }
    return CacheOptimizer.instance
  }

  // Set cache with TTL
  set(key: string, data: any, ttl: number = 300000) { // 5min default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  // Get cache
  get(key: string): any | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  // Clear expired cache
  clearExpired() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    let expired = 0
    let valid = 0

    for (const item of this.cache.values()) {
      if (now - item.timestamp > item.ttl) {
        expired++
      } else {
        valid++
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      hitRate: valid / this.cache.size || 0
    }
  }
}

// Memory optimization utility
export class MemoryOptimizer {
  private static instance: MemoryOptimizer
  private cleanupCallbacks: Set<() => void> = new Set()

  static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer()
    }
    return MemoryOptimizer.instance
  }

  // Register cleanup callback
  registerCleanup(callback: () => void): void {
    this.cleanupCallbacks.add(callback)
  }

  // Unregister cleanup callback
  unregisterCleanup(callback: () => void): void {
    this.cleanupCallbacks.delete(callback)
  }

  // Run all cleanup callbacks
  cleanup(): void {
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback()
      } catch (e) {
        console.warn('Cleanup callback failed:', e)
      }
    })
  }

  // Get memory usage info
  getMemoryInfo() {
    if (typeof window !== 'undefined' && 'performance' in window && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      }
    }
    return null
  }

  // Force garbage collection (if available)
  forceGC(): void {
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc()
    }
  }
}

// Bundle size analyzer
export class BundleAnalyzer {
  static async analyzeBundle(): Promise<{
    totalSize: number
    chunks: Array<{ name: string; size: number; gzipped?: number }>
    largestChunks: Array<{ name: string; size: number }>
  }> {
    if (typeof window === 'undefined') {
      return { totalSize: 0, chunks: [], largestChunks: [] }
    }

    try {
      const response = await fetch('/build-stats.json')
      const stats = await response.json()
      
      const chunks = Object.entries(stats.chunks).map(([name, data]: [string, any]) => ({
        name,
        size: data.size,
        gzipped: data.gzipped
      }))

      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0)
      const largestChunks = chunks
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)

      return { totalSize, chunks, largestChunks }
    } catch (error) {
      console.warn('Could not analyze bundle:', error)
      return { totalSize: 0, chunks: [], largestChunks: [] }
    }
  }
}

// Performance degradation detector
export class PerformanceDetector {
  private static instance: PerformanceDetector
  private metrics: number[] = []
  private frameCount = 0
  private lastTime = performance.now()
  private observers: PerformanceObserver[] = []

  static getInstance(): PerformanceDetector {
    if (!PerformanceDetector.instance) {
      PerformanceDetector.instance = new PerformanceDetector()
    }
    return PerformanceDetector.instance
  }

  startMonitoring(): void {
    this.startFrameRateMonitoring()
    this.startMemoryMonitoring()
  }

  private startFrameRateMonitoring(): void {
    const checkFrame = () => {
      const currentTime = performance.now()
      const deltaTime = currentTime - this.lastTime
      
      if (deltaTime > 0) {
        const fps = 1000 / deltaTime
        this.metrics.push(fps)
        
        // Keep only last 60 measurements
        if (this.metrics.length > 60) {
          this.metrics.shift()
        }
      }
      
      this.lastTime = currentTime
      this.frameCount++
      
      requestAnimationFrame(checkFrame)
    }
    
    requestAnimationFrame(checkFrame)
  }

  private startMemoryMonitoring(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure' && entry.name === 'memory') {
              console.warn('High memory usage detected:', entry.duration)
            }
          }
        })
        observer.observe({ entryTypes: ['measure'] })
        this.observers.push(observer)
      } catch (e) {
        console.warn('Memory monitoring not supported')
      }
    }
  }

  // Get average FPS over last measurements
  getAverageFPS(): number {
    if (this.metrics.length === 0) return 60
    const sum = this.metrics.reduce((a, b) => a + b, 0)
    return sum / this.metrics.length
  }

  // Check if performance is degraded
  isPerformanceDegraded(): boolean {
    const avgFPS = this.getAverageFPS()
    return avgFPS < 30 // Below 30 FPS is considered degraded
  }

  // Stop monitoring
  stopMonitoring(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

export default PerformanceMonitor