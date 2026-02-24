// Mobile App Performance Optimizations
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { AppState, AppStateStatus, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Performance monitoring for React Native
export class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor
  private metrics: any = {}
  private observers: Map<string, any> = new Map()

  static getInstance(): MobilePerformanceMonitor {
    if (!MobilePerformanceMonitor.instance) {
      MobilePerformanceMonitor.instance = new MobilePerformanceMonitor()
    }
    return MobilePerformanceMonitor.instance
  }

  // Track app state changes
  trackAppState() {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      this.metrics.appState = nextAppState
      this.metrics.lastActiveTime = Date.now()
      
      if (nextAppState === 'background') {
        this.recordEvent('app_background', 0)
      } else if (nextAppState === 'active') {
        this.recordEvent('app_foreground', 0)
      }
    })

    this.observers.set('appState', subscription)
  }

  // Track memory usage (iOS/Android specific)
  trackMemoryUsage() {
    if (Platform.OS === 'android') {
      // Android memory tracking
      import('react-native').then(({ Platform: RNPlatform }) => {
        if (RNPlatform.OS === 'android') {
          setInterval(() => {
            // This would integrate with Android's memory APIs
            // For now, just track as placeholder
            this.metrics.memoryUsage = 'tracked'
          }, 10000)
        }
      })
    } else if (Platform.OS === 'ios') {
      // iOS memory tracking
      setInterval(() => {
        // iOS memory tracking would go here
        this.metrics.memoryUsage = 'tracked'
      }, 10000)
    }
  }

  // Record custom performance event
  recordEvent(name: string, duration: number) {
    this.metrics[`${name}_${Date.now()}`] = {
      duration,
      timestamp: Date.now()
    }
  }

  // Get current performance metrics
  getMetrics() {
    return { ...this.metrics }
  }

  // Clean up observers
  destroy() {
    this.observers.forEach(observer => {
      if (observer?.remove) {
        observer.remove()
      }
    })
    this.observers.clear()
  }
}

// Optimized navigation with lazy loading
export function useOptimizedNavigation() {
  const [currentRoute, setCurrentRoute] = useState('index')
  const [preloadedRoutes] = useState(new Set(['index', 'lockscreen']))
  const navigationRef = useRef<any>(null)

  // Preload critical routes
  const preloadRoute = useCallback((routeName: string) => {
    preloadedRoutes.add(routeName)
  }, [preloadedRoutes])

  // Navigate with performance tracking
  const navigate = useCallback((routeName: string, params?: any) => {
    const startTime = Date.now()
    
    if (navigationRef.current) {
      navigationRef.current.navigate(routeName, params)
    }
    
    // Track navigation performance
    setTimeout(() => {
      const duration = Date.now() - startTime
      MobilePerformanceMonitor.getInstance().recordEvent(`navigation_${routeName}`, duration)
    }, 0)
  }, [])

  return {
    currentRoute,
    setCurrentRoute,
    preloadRoute,
    navigate,
    navigationRef,
    preloadedRoutes: Array.from(preloadedRoutes)
  }
}

// Optimized state management with persistence
export function useOptimizedState<T>(
  key: string,
  initialValue: T,
  options: {
    persistence?: boolean
    compression?: boolean
    maxAge?: number
  } = {}
) {
  const { persistence = true, compression = false, maxAge = 7 * 24 * 60 * 60 * 1000 } = options
  
  const [state, setState] = useState<T>(initialValue)
  const [loading, setLoading] = useState(persistence)
  const monitor = MobilePerformanceMonitor.getInstance()

  // Load persisted state
  useEffect(() => {
    if (persistence) {
      loadState()
    }
  }, [key, persistence])

  const loadState = useCallback(async () => {
    try {
      const startTime = Date.now()
      const stored = await AsyncStorage.getItem(key)
      
      if (stored) {
        const data = JSON.parse(stored)
        const now = Date.now()
        
        // Check if data is expired
        if (data.timestamp && (now - data.timestamp) > maxAge) {
          await AsyncStorage.removeItem(key)
          return
        }
        
        setState(data.value)
        monitor.recordEvent('state_load', Date.now() - startTime)
      }
    } catch (error) {
      console.warn('Failed to load state:', error)
    } finally {
      setLoading(false)
    }
  }, [key, maxAge, monitor])

  // Save state with optimization
  const saveState = useCallback(async (newState: T) => {
    setState(newState)
    
    if (persistence) {
      const startTime = Date.now()
      
      try {
        const dataToStore = {
          value: newState,
          timestamp: Date.now()
        }
        
        await AsyncStorage.setItem(key, JSON.stringify(dataToStore))
        monitor.recordEvent('state_save', Date.now() - startTime)
      } catch (error) {
        console.warn('Failed to save state:', error)
      }
    }
  }, [key, persistence, monitor])

  return [state, saveState, loading] as const
}

// Network request optimization for mobile
export class MobileNetworkOptimizer {
  private static instance: MobileNetworkOptimizer
  private requestQueue: any[] = []
  private maxConcurrent = Platform.OS === 'ios' ? 4 : 6

  static getInstance(): MobileNetworkOptimizer {
    if (!MobileNetworkOptimizer.instance) {
      MobileNetworkOptimizer.instance = new MobileNetworkOptimizer()
    }
    return MobileNetworkOptimizer.instance
  }

  // Optimized fetch with retry and caching
  async request(url: string, options: any = {}) {
    const {
      retries = 3,
      timeout = 15000,
      cache = true,
      cacheTTL = 5 * 60 * 1000 // 5 minutes
    } = options

    // Check cache first
    if (cache && options.method === 'GET') {
      const cached = await this.getCachedResponse(url)
      if (cached) {
        return cached
      }
    }

    // Add to queue
    return this.queueRequest(url, { ...options, retries, timeout, cache, cacheTTL })
  }

  private async queueRequest(url: string, options: any) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.requestQueue.length === 0) return

    const batch = this.requestQueue.splice(0, this.maxConcurrent)
    await Promise.allSettled(
      batch.map(({ url, options, resolve, reject }) => 
        this.executeRequest(url, options).then(resolve).catch(reject)
      )
    )

    // Process next batch
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 100)
    }
  }

  private async executeRequest(url: string, options: any) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Cache successful GET requests
      if (options.cache && options.method === 'GET' && response.ok) {
        await this.cacheResponse(url, response, options.cacheTTL)
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private async getCachedResponse(url: string) {
    try {
      const cached = await AsyncStorage.getItem(`cache:${url}`)
      if (cached) {
        const data = JSON.parse(cached)
        if (Date.now() - data.timestamp < data.ttl) {
          return data.response
        }
        await AsyncStorage.removeItem(`cache:${url}`)
      }
    } catch (error) {
      console.warn('Cache retrieval failed:', error)
    }
    return null
  }

  private async cacheResponse(url: string, response: any, ttl: number) {
    try {
      const data = {
        response: await response.json(),
        timestamp: Date.now(),
        ttl
      }
      await AsyncStorage.setItem(`cache:${url}`, JSON.stringify(data))
    } catch (error) {
      console.warn('Cache storage failed:', error)
    }
  }
}

// Image optimization for mobile
export function useOptimizedImage(source: string, options: {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  resize?: boolean
} = {}) {
  const [imageUri, setImageUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!source) return

    const loadImage = async () => {
      try {
        setLoading(true)
        setError(null)

        // For now, just use the original source
        // In a real implementation, this would optimize the image
        setImageUri(source)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Image load failed'))
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [source])

  return { imageUri, loading, error }
}

// Battery-aware performance adjustment
export function useBatteryAwarePerformance() {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [isLowPowerMode, setIsLowPowerMode] = useState(false)
  const monitor = MobilePerformanceMonitor.getInstance()

  useEffect(() => {
    // Battery level monitoring
    const checkBattery = async () => {
      try {
        const { Battery } = await import('expo-battery')
        const level = await Battery.getBatteryLevelAsync()
        const powerState = await Battery.getPowerStateAsync()
        
        setBatteryLevel(Math.round(level * 100))
        setIsLowPowerMode(powerState.lowPowerMode)
        
        // Adjust performance based on battery
        if (powerState.lowPowerMode || level < 0.2) {
          monitor.recordEvent('low_power_mode', 0)
        }
      } catch (error) {
        // Fallback for platforms without battery API
        setBatteryLevel(100)
        setIsLowPowerMode(false)
      }
    }

    checkBattery()
    const interval = setInterval(checkBattery, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [monitor])

  // Get performance mode based on battery state
  const getPerformanceMode = useMemo(() => {
    if (isLowPowerMode || (batteryLevel && batteryLevel < 20)) {
      return 'low' // Reduce animations, debounce more aggressively
    } else if (batteryLevel && batteryLevel < 50) {
      return 'medium' // Moderate optimizations
    } else {
      return 'high' // Full performance
    }
  }, [isLowPowerMode, batteryLevel])

  return {
    batteryLevel,
    isLowPowerMode,
    performanceMode: getPerformanceMode,
    shouldReduceMotion: isLowPowerMode || (batteryLevel && batteryLevel < 30),
    shouldDebounceMore: isLowPowerMode || (batteryLevel && batteryLevel < 20)
  }
}

// Optimized list rendering for large datasets
export function useOptimizedList<T>(
  data: T[],
  options: {
    itemHeight: number
    renderAhead?: number
    maxItems?: number
  }
) {
  const { itemHeight, renderAhead = 10, maxItems = 1000 } = options
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 })
  const [scrollY, setScrollY] = useState(0)

  // Limit data if too large
  const optimizedData = useMemo(() => {
    if (data.length > maxItems) {
      return data.slice(0, maxItems)
    }
    return data
  }, [data, maxItems])

  // Calculate visible range based on scroll
  const updateVisibleRange = useCallback((y: number) => {
    setScrollY(y)
    
    const start = Math.max(0, Math.floor(y / itemHeight) - renderAhead)
    const end = Math.min(
      optimizedData.length - 1,
      Math.ceil((y + itemHeight * 20) / itemHeight) + renderAhead
    )
    
    setVisibleRange({ start, end })
  }, [itemHeight, renderAhead, optimizedData.length])

  // Get visible items
  const visibleItems = useMemo(() => {
    return optimizedData.slice(visibleRange.start, visibleRange.end + 1)
  }, [optimizedData, visibleRange])

  // Calculate total height
  const totalHeight = optimizedData.length * itemHeight

  return {
    visibleItems,
    visibleRange,
    totalHeight,
    updateVisibleRange,
    scrollY,
    itemHeight
  }
}

// Memory cleanup utilities
export function useMemoryCleanup() {
  const cleanupCallbacks = useRef<(() => void)[]>([])

  const registerCleanup = useCallback((callback: () => void) => {
    cleanupCallbacks.current.push(callback)
  }, [])

  const cleanup = useCallback(() => {
    cleanupCallbacks.current.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.warn('Cleanup callback failed:', error)
      }
    })
    cleanupCallbacks.current = []
  }, [])

  // Auto cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  return { registerCleanup, cleanup }
}

// Background sync optimization
export function useBackgroundSync() {
  const [isOnline, setIsOnline] = useState(true)
  const monitor = MobilePerformanceMonitor.getInstance()

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      monitor.recordEvent('network_online', 0)
      
      // Trigger background sync
      triggerBackgroundSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
      monitor.recordEvent('network_offline', 0)
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && isOnline) {
        triggerBackgroundSync()
      }
    })

    // Network status listeners
    const { NetInfo } = require('@react-native-community/netinfo')
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false)
    })

    return () => {
      subscription.remove()
      unsubscribe()
    }
  }, [isOnline, monitor])

  const triggerBackgroundSync = useCallback(async () => {
    try {
      // Implement background sync logic
      monitor.recordEvent('background_sync', 0)
    } catch (error) {
      console.warn('Background sync failed:', error)
    }
  }, [monitor])

  return { isOnline, triggerBackgroundSync }
}

export default {
  MobilePerformanceMonitor,
  useOptimizedNavigation,
  useOptimizedState,
  MobileNetworkOptimizer,
  useOptimizedImage,
  useBatteryAwarePerformance,
  useOptimizedList,
  useMemoryCleanup,
  useBackgroundSync
}