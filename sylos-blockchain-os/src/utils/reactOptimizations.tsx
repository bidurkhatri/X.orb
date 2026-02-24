// React Performance Optimizations and Memoization
import React, { 
  ComponentType, 
  memo, 
  useMemo, 
  useCallback, 
  useEffect, 
  useRef, 
  useState, 
  forwardRef,
  useImperativeHandle
} from 'react'
import { usePerformanceMonitor, useOptimizedMemo } from '../hooks/usePerformance'

// Higher-order component for performance optimization
export function withPerformanceOptimization<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    name?: string
    trackRenders?: boolean
    trackProps?: boolean
    maxRenderTime?: number
  } = {}
) {
  const {
    name = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    trackRenders = process.env.NODE_ENV === 'development',
    trackProps = process.env.NODE_ENV === 'development',
    maxRenderTime = 16
  } = options

  const OptimizedComponent = memo(WrappedComponent, (prevProps, nextProps) => {
    // Custom comparison for specific prop changes
    const shouldReRender = !Object.keys(prevProps).every(key => {
      const prevValue = (prevProps as any)[key]
      const nextValue = (nextProps as any)[key]
      
      // Shallow comparison for objects/arrays
      if (typeof prevValue === 'object' && prevValue !== null) {
        return JSON.stringify(prevValue) === JSON.stringify(nextValue)
      }
      
      return prevValue === nextValue
    })

    return !shouldReRender
  })

  OptimizedComponent.displayName = `PerformanceOptimized(${name})`

  if (trackRenders) {
    const OriginalComponent = OptimizedComponent
    const TrackedComponent = forwardRef<any, P>((props, ref) => {
      const renderCount = useRef(0)
      const { recordEvent } = usePerformanceMonitor(name)
      
      renderCount.current++
      
      useEffect(() => {
        recordEvent('render', renderCount.current)
      })

      return <OriginalComponent ref={ref} {...props} />
    })
    
    TrackedComponent.displayName = OptimizedComponent.displayName
    return TrackedComponent
  }

  return OptimizedComponent
}

// Advanced memoization utilities
export function createSmartMemo<T extends object>(
  Component: ComponentType<T>,
  compareProps?: (prev: T, next: T) => boolean
) {
  return memo(Component, compareProps || ((prevProps, nextProps) => {
    // Deep comparison for complex props
    return JSON.stringify(prevProps) === JSON.stringify(nextProps)
  }))
}

// Performance-optimized context provider
export function createOptimizedContext<T>(
  initialValue: T,
  options: {
    enablePersistence?: boolean
    persistenceKey?: string
    debugMode?: boolean
  } = {}
) {
  const {
    enablePersistence = false,
    persistenceKey = 'context',
    debugMode = process.env.NODE_ENV === 'development'
  } = options

  const Context = React.createContext<T | null>(null)
  
  function Provider({ children, value }: { children: React.ReactNode; value?: T }) {
    const [state, setState] = useState<T>(() => {
      if (enablePersistence) {
        try {
          const saved = localStorage.getItem(persistenceKey)
          if (saved) return JSON.parse(saved)
        } catch (error) {
          console.warn('Failed to load persisted context:', error)
        }
      }
      return value || initialValue
    })

    // Persist state changes
    useEffect(() => {
      if (enablePersistence) {
        try {
          localStorage.setItem(persistenceKey, JSON.stringify(state))
        } catch (error) {
          console.warn('Failed to persist context:', error)
        }
      }
    }, [state, enablePersistence, persistenceKey])

    const contextValue = useOptimizedMemo(() => state, [state])
    
    if (debugMode) {
      console.log(`${persistenceKey} context updated:`, state)
    }

    return (
      <Context.Provider value={contextValue}>
        {children}
      </Context.Provider>
    )
  }

  function useContext() {
    const context = React.useContext(Context)
    if (context === null) {
      throw new Error(`useContext must be used within a ${persistenceKey}Provider`)
    }
    return context
  }

  return { Provider, useContext, Context }
}

// Virtual scrolling for large lists
export function useVirtualScrolling(
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const {
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
    offsetY
  } = useOptimizedMemo(() => {
    const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIdx = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    const visible = items.slice(startIdx, endIdx + 1)
    const total = items.length * itemHeight
    const offset = startIdx * itemHeight
    
    return {
      startIndex: startIdx,
      endIndex: endIdx,
      visibleItems: visible,
      totalHeight: total,
      offsetY: offset
    }
  }, [items, itemHeight, containerHeight, scrollTop, overscan])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    virtualItems: visibleItems,
    totalSize: totalHeight,
    offsetY,
    startIndex,
    endIndex,
    handleScroll,
    innerStyle: {
      height: `${totalHeight}px`
    },
    outerStyle: {
      height: `${containerHeight}px`,
      overflow: 'auto'
    }
  }
}

// Infinite scrolling with performance optimization
export function useInfiniteScrolling<T>(
  fetchMore: (page: number) => Promise<T[]>,
  hasMore: boolean,
  options: {
    threshold?: number
    initialPage?: number
    batchSize?: number
  } = {}
) {
  const {
    threshold = 100,
    initialPage = 1,
    batchSize = 20
  } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(initialPage)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    setError(null)

    try {
      const newItems = await fetchMore(page)
      setData(prev => [...prev, ...newItems])
      setPage(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more'))
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page, fetchMore])

  // Intersection observer for auto-loading
  useEffect(() => {
    const container = containerRef.current
    if (!container || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      {
        rootMargin: `${threshold}px`
      }
    )

    observer.observe(container)

    return () => observer.disconnect()
  }, [loadMore, hasMore, loading, threshold])

  return {
    data,
    loading,
    error,
    loadMore,
    containerRef,
    hasMore: hasMore && !loading
  }
}

// Component for rendering virtualized lists
export const VirtualizedList = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  ...props
}: {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
  [key: string]: any
}) => {
  const {
    virtualItems,
    totalSize,
    offsetY,
    handleScroll,
    innerStyle,
    outerStyle
  } = useVirtualScrolling(items, itemHeight, containerHeight, overscan)

  return (
    <div
      style={outerStyle}
      onScroll={handleScroll}
      className={className}
      {...props}
    >
      <div style={innerStyle}>
        {virtualItems.map((item, index) => {
          const actualIndex = items.indexOf(item)
          return (
            <div
              key={actualIndex}
              style={{
                position: 'absolute',
                top: actualIndex * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Debounced input component
export const DebouncedInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    debounceMs?: number
    onDebouncedChange?: (value: string) => void
  }
>(({ debounceMs = 300, onDebouncedChange, onChange, value, ...props }, ref) => {
  const [debouncedValue, setDebouncedValue] = useState(value as string)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    setDebouncedValue(value as string)
  }, [value])

  useEffect(() => {
    if (onDebouncedChange) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        onDebouncedChange(debouncedValue)
      }, debounceMs)
    }
  }, [debouncedValue, debounceMs, onDebouncedChange])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setDebouncedValue(newValue)
    onChange?.(e)
  }, [onChange])

  return (
    <input
      ref={ref}
      value={debouncedValue}
      onChange={handleChange}
      {...props}
    />
  )
})

DebouncedInput.displayName = 'DebouncedInput'

// Lazy component wrapper with performance monitoring
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    fallback?: ComponentType
    timeout?: number
    onLoad?: () => void
    onError?: (error: Error) => void
  } = {}
) {
  const LazyWrapper = forwardRef<any, React.ComponentProps<T>>((props, ref) => {
    const [component, setComponent] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const { recordEvent } = usePerformanceMonitor(`Lazy${options.fallback?.name || 'Component'}`)

    useEffect(() => {
      let mounted = true
      setLoading(true)

      const loadComponent = async () => {
        const startTime = performance.now()
        
        try {
          const module = await Promise.race([
            importFn(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Component load timeout')), options.timeout || 10000)
            )
          ])

          if (mounted) {
            setComponent(() => module.default)
            recordEvent('load', performance.now() - startTime)
            options.onLoad?.()
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Component failed to load')
          if (mounted) {
            setError(error)
            options.onError?.(error)
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

      loadComponent()

      return () => {
        mounted = false
      }
    }, [recordEvent])

    if (loading) {
      const Fallback = options.fallback || (() => <div>Loading...</div>)
      return <Fallback />
    }

    if (error || !component) {
      const Fallback = options.fallback || (() => <div>Failed to load component</div>)
      return <Fallback error={error} />
    }

    const Component = component
    return <Component {...props} ref={ref} />
  })

  LazyWrapper.displayName = `LazyComponent(${options.fallback?.name || 'Component'})`
  return LazyWrapper
}

// Performance monitoring wrapper
export function withPerformanceMonitoring<P extends object>(
  Component: ComponentType<P>,
  config: {
    trackMounts?: boolean
    trackUpdates?: boolean
    trackUnmounts?: boolean
    customMetrics?: Record<string, () => number>
  } = {}
) {
  const {
    trackMounts = true,
    trackUpdates = false,
    trackUnmounts = false,
    customMetrics = {}
  } = config

  return forwardRef<any, P>((props, ref) => {
    const { recordEvent } = usePerformanceMonitor(Component.displayName || Component.name || 'Component')
    const mountTime = useRef<number>()
    const updateCount = useRef(0)

    useEffect(() => {
      if (trackMounts) {
        mountTime.current = performance.now()
        recordEvent('mount', 0)
      }

      return () => {
        if (trackUnmounts && mountTime.current) {
          const lifeTime = performance.now() - mountTime.current
          recordEvent('unmount', lifeTime)
        }
      }
    }, [])

    useEffect(() => {
      if (trackUpdates) {
        updateCount.current++
        recordEvent('update', updateCount.current)
      }
    })

    // Monitor custom metrics
    useEffect(() => {
      const interval = setInterval(() => {
        Object.entries(customMetrics).forEach(([name, metric]) => {
          const value = metric()
          recordEvent(name, value)
        })
      }, 1000)

      return () => clearInterval(interval)
    }, [customMetrics])

    return <Component {...props} ref={ref} />
  })
}

export default {
  withPerformanceOptimization,
  createSmartMemo,
  createOptimizedContext,
  useVirtualScrolling,
  useInfiniteScrolling,
  VirtualizedList,
  DebouncedInput,
  createLazyComponent,
  withPerformanceMonitoring
}