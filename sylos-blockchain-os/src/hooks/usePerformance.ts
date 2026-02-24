// React Performance Hooks and Utilities
import { useState, useEffect, useCallback, useRef, useMemo, DependencyList } from 'react'
import { PerformanceMonitor, PerformanceDetector, MemoryOptimizer, NetworkOptimizer } from '../utils/performance'

// Hook for monitoring component render performance
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance()
  const renderStart = useRef<number>()

  useEffect(() => {
    renderStart.current = performance.now()
    
    return () => {
      if (renderStart.current) {
        const renderTime = performance.now() - renderStart.current
        monitor.recordEvent(`${componentName}-render`, renderTime)
      }
    }
  })

  return {
    recordEvent: (name: string, duration: number) => monitor.recordEvent(`${componentName}-${name}`, duration),
    isPerformanceGood: () => monitor.isPerformanceGood(),
    getPerformanceScore: () => monitor.getPerformanceScore()
  }
}

// Hook for optimizing expensive computations
export function useOptimizedMemo<T>(
  computeFn: () => T,
  dependencies: DependencyList,
  options?: {
    timeout?: number
    maxCacheSize?: number
  }
) {
  const [result, setResult] = useState<T>()
  const computeTimeout = useRef<NodeJS.Timeout>()
  const cacheRef = useRef<Map<string, T>>(new Map())
  
  const timeout = options?.timeout || 100 // 100ms default
  const maxCacheSize = options?.maxCacheSize || 10

  const computeOptimized = useCallback(() => {
    // Create cache key from dependencies
    const cacheKey = JSON.stringify(dependencies)
    
    // Check cache first
    if (cacheRef.current.has(cacheKey)) {
      setResult(cacheRef.current.get(cacheKey))
      return
    }

    // Debounce computation
    clearTimeout(computeTimeout.current)
    computeTimeout.current = setTimeout(() => {
      const computedResult = computeFn()
      
      // Update cache
      if (cacheRef.current.size >= maxCacheSize) {
        const firstKey = cacheRef.current.keys().next().value
        cacheRef.current.delete(firstKey)
      }
      cacheRef.current.set(cacheKey, computedResult)
      
      setResult(computedResult)
    }, timeout)
  }, dependencies)

  useEffect(() => {
    computeOptimized()
  }, [computeOptimized])

  useEffect(() => {
    return () => {
      clearTimeout(computeTimeout.current)
    }
  }, [])

  return result
}

// Hook for lazy loading components with performance tracking
export function useLazyLoad(
  loader: () => Promise<{ default: React.ComponentType<any> }>,
  options?: {
    fallback?: React.ComponentType
    prefetch?: boolean
    onLoad?: () => void
  }
) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const monitor = PerformanceMonitor.getInstance()

  const loadComponent = useCallback(async () => {
    if (Component) return

    setIsLoading(true)
    setError(null)

    const startTime = performance.now()
    
    try {
      const module = await loader()
      const loadTime = performance.now() - startTime
      
      monitor.recordEvent('component-load', loadTime)
      setComponent(() => module.default)
      options?.onLoad?.()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load component'))
    } finally {
      setIsLoading(false)
    }
  }, [Component, loader, options, monitor])

  // Auto-load if not prefetch
  useEffect(() => {
    if (!options?.prefetch) {
      loadComponent()
    }
  }, [loadComponent, options?.prefetch])

  const PrefetchComponent = useCallback(() => {
    if (options?.prefetch) {
      loadComponent()
    }
    return null
  }, [loadComponent, options?.prefetch])

  return {
    Component: Component || (options?.fallback ? options.fallback : null),
    isLoading,
    error,
    load: loadComponent,
    PrefetchComponent
  }
}

// Hook for optimizing context values to prevent unnecessary re-renders
export function useOptimizedContext<T>(
  contextValue: T,
  areEqual?: (prev: T, next: T) => boolean
) {
  const [value, setValue] = useState<T>(contextValue)
  const previousValue = useRef<T>(contextValue)

  useEffect(() => {
    if (!areEqual || !areEqual(previousValue.current, contextValue)) {
      previousValue.current = contextValue
      setValue(contextValue)
    }
  }, [contextValue, areEqual])

  return value
}

// Hook for debouncing state updates
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
) {
  const [value, setValue] = useState<T>(initialValue)
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const setValueDebounced = useCallback((newValue: T) => {
    setValue(newValue)
    
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(newValue)
    }, delay)
  }, [delay])

  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return [value, debouncedValue, setValueDebounced] as const
}

// Hook for managing async operations with caching
export function useAsyncOperation<T>(
  asyncFn: () => Promise<T>,
  dependencies: DependencyList,
  options?: {
    cacheKey?: string
    ttl?: number
    retryCount?: number
    retryDelay?: number
  }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const cacheKey = options?.cacheKey || JSON.stringify(dependencies)
  const retryCount = options?.retryCount || 3
  const retryDelay = options?.retryDelay || 1000

  const execute = useCallback(async (attempt = 1) => {
    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn()
      setData(result)
    } catch (err) {
      if (attempt < retryCount) {
        setTimeout(() => execute(attempt + 1), retryDelay * attempt)
      } else {
        setError(err instanceof Error ? err : new Error('Operation failed'))
      }
    } finally {
      setLoading(false)
    }
  }, [asyncFn, dependencies, retryCount, retryDelay])

  useEffect(() => {
    execute()
  }, dependencies)

  return { data, loading, error, execute, refetch: () => execute() }
}

// Hook for network-aware optimizations
export function useNetworkAware() {
  const network = NetworkOptimizer.getInstance()
  const [networkQuality, setNetworkQuality] = useState<'slow' | 'fast' | 'unknown'>('unknown')
  const [connection, setConnection] = useState<any>(null)

  useEffect(() => {
    const quality = network.getNetworkQuality()
    setNetworkQuality(quality)

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      setConnection((navigator as any).connection)
      
      const updateConnection = () => {
        const newQuality = network.getNetworkQuality()
        setNetworkQuality(newQuality)
      }
      
      connection?.addEventListener('change', updateConnection)
      
      return () => {
        connection?.removeEventListener('change', updateConnection)
      }
    }
  }, [network, connection])

  return {
    networkQuality,
    connection,
    optimalConcurrency: network.getOptimalConcurrency(),
    optimalTimeout: network.getOptimalTimeout()
  }
}

// Hook for performance-sensitive animations
export function useOptimizedAnimation(
  animationFn: (progress: number) => void,
  duration: number = 1000,
  options?: {
    easing?: (t: number) => number
    onComplete?: () => void
  }
) {
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const memory = MemoryOptimizer.getInstance()

  const easing = options?.easing || ((t: number) => t)
  const onComplete = options?.onComplete

  const startAnimation = useCallback(() => {
    if (isAnimating) return

    setIsAnimating(true)
    startTimeRef.current = performance.now()

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) return

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easing(progress)

      animationFn(easedProgress)

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
        onComplete?.()
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [isAnimating, duration, easing, animationFn, onComplete])

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setIsAnimating(false)
  }, [])

  // Register cleanup with memory optimizer
  useEffect(() => {
    memory.registerCleanup(stopAnimation)
    return () => {
      memory.unregisterCleanup(stopAnimation)
      stopAnimation()
    }
  }, [memory, stopAnimation])

  return { startAnimation, stopAnimation, isAnimating }
}

// Hook for image lazy loading with performance tracking
export function useLazyImage(
  src: string,
  options?: {
    threshold?: number
    rootMargin?: string
    onLoad?: () => void
    onError?: (error: Error) => void
  }
) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const monitor = PerformanceMonitor.getInstance()

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(img)
          }
        })
      },
      {
        threshold: options?.threshold || 0.1,
        rootMargin: options?.rootMargin || '50px'
      }
    )

    observer.observe(img)

    return () => {
      observer.disconnect()
    }
  }, [options?.threshold, options?.rootMargin])

  useEffect(() => {
    if (!isInView) return

    const img = imgRef.current
    if (!img) return

    const startTime = performance.now()
    
    const handleLoad = () => {
      const loadTime = performance.now() - startTime
      monitor.recordEvent('image-load', loadTime)
      setIsLoaded(true)
      options?.onLoad?.()
    }

    const handleError = () => {
      const error = new Error(`Failed to load image: ${src}`)
      setError(error)
      options?.onError?.(error)
    }

    img.addEventListener('load', handleLoad)
    img.addEventListener('error', handleError)

    if (img.complete) {
      handleLoad()
    }

    return () => {
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
    }
  }, [isInView, src, options, monitor])

  return {
    imgRef,
    isLoaded,
    isInView,
    error
  }
}

// Hook for preloading critical resources
export function useResourcePreloader() {
  const preloadRef = useRef<Set<string>>(new Set())
  const monitor = PerformanceMonitor.getInstance()

  const preload = useCallback(async (resource: string) => {
    if (preloadRef.current.has(resource)) return

    const startTime = performance.now()
    
    try {
      if (resource.match(/\.(js|css)$/)) {
        // Preload script or stylesheet
        const link = document.createElement('link')
        link.rel = 'preload'
        link.href = resource
        link.as = resource.endsWith('.js') ? 'script' : 'style'
        document.head.appendChild(link)
      } else if (resource.match(/\.(png|jpg|jpeg|webp|avif)$/)) {
        // Preload image
        const img = new Image()
        img.src = resource
      } else {
        // Generic fetch for other resources
        await fetch(resource)
      }

      const preloadTime = performance.now() - startTime
      monitor.recordEvent('resource-preload', preloadTime)
      preloadRef.current.add(resource)
    } catch (error) {
      console.warn(`Failed to preload resource: ${resource}`, error)
    }
  }, [monitor])

  return { preload }
}

// Hook for bundle size monitoring
export function useBundleSize() {
  const [bundleSize, setBundleSize] = useState<number>(0)
  const [chunks, setChunks] = useState<Array<{ name: string; size: number }>>([])

  useEffect(() => {
    // Try to get bundle info from build stats
    fetch('/build-stats.json')
      .then(res => res.json())
      .then(stats => {
        const totalSize = Object.values(stats.chunks).reduce(
          (sum: number, chunk: any) => sum + chunk.size, 0
        )
        setBundleSize(totalSize)
        
        const chunkList = Object.entries(stats.chunks).map(([name, chunk]: [string, any]) => ({
          name,
          size: chunk.size
        }))
        setChunks(chunkList)
      })
      .catch(() => {
        // Fallback: estimate from loaded scripts
        const scripts = Array.from(document.querySelectorAll('script[src]'))
        const totalSize = scripts.reduce((sum, script) => {
          // This is approximate - real implementation would need network timing
          return sum + 50000 // Assume 50KB per script as fallback
        }, 0)
        setBundleSize(totalSize)
      })
  }, [])

  return { bundleSize, chunks }
}

export default {
  usePerformanceMonitor,
  useOptimizedMemo,
  useLazyLoad,
  useOptimizedContext,
  useDebouncedState,
  useAsyncOperation,
  useNetworkAware,
  useOptimizedAnimation,
  useLazyImage,
  useResourcePreloader,
  useBundleSize
}