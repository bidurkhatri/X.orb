// Network Request Optimization Utilities
import { NetworkOptimizer, CacheOptimizer } from './performance'

export interface RequestConfig {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
  retryDelay?: number
  cache?: boolean
  cacheTTL?: number
  priority?: 'low' | 'normal' | 'high'
  signal?: AbortSignal
  networkAware?: boolean
}

export interface ResponseConfig<T = any> {
  data: T | null
  error: Error | null
  status: number
  headers: Record<string, string>
  cached: boolean
  duration: number
}

export class NetworkRequestManager {
  private static instance: NetworkRequestManager
  private networkOptimizer = NetworkOptimizer.getInstance()
  private cacheOptimizer = CacheOptimizer.getInstance()
  private requestQueue: Array<{
    config: RequestConfig
    resolve: (value: any) => void
    reject: (error: Error) => void
    priority: number
    attempts: number
  }> = []
  private activeRequests = 0
  private maxConcurrent: number
  private requestCache = new Map<string, { response: any; timestamp: number; ttl: number }>()

  static getInstance(): NetworkRequestManager {
    if (!NetworkRequestManager.instance) {
      NetworkRequestManager.instance = new NetworkRequestManager()
    }
    return NetworkRequestManager.instance
  }

  constructor() {
    this.maxConcurrent = this.networkOptimizer.getOptimalConcurrency()
    this.startQueueProcessor()
  }

  // Main request method with optimizations
  async request<T = any>(config: RequestConfig): Promise<ResponseConfig<T>> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(config)
    const { 
      timeout, 
      retries = 3, 
      retryDelay = 1000, 
      cache = true,
      cacheTTL = 300000, // 5 minutes
      networkAware = true 
    } = config

    try {
      // Check cache first
      if (cache && config.method === 'GET') {
        const cached = this.getCachedResponse<T>(cacheKey)
        if (cached) {
          return {
            ...cached,
            cached: true,
            duration: Date.now() - startTime
          }
        }
      }

      // Network-aware adjustments
      let finalConfig = { ...config }
      if (networkAware) {
        finalConfig.timeout = timeout || this.networkOptimizer.getOptimalTimeout()
        finalConfig.retries = Math.min(retries, this.networkOptimizer.getNetworkQuality() === 'slow' ? 1 : retries)
      }

      // Add to queue for prioritization
      const response = await this.queueRequest(finalConfig)

      // Cache successful GET requests
      if (cache && config.method === 'GET' && response.status < 400) {
        this.setCachedResponse(cacheKey, response, cacheTTL)
      }

      return {
        ...response,
        cached: false,
        duration: Date.now() - startTime
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Network request failed'),
        status: 0,
        headers: {},
        cached: false,
        duration: Date.now() - startTime
      }
    }
  }

  // Queue-based request processing
  private queueRequest(config: RequestConfig): Promise<ResponseConfig> {
    return new Promise((resolve, reject) => {
      const priority = this.getPriorityValue(config.priority || 'normal')
      
      this.requestQueue.push({
        config,
        resolve,
        reject,
        priority,
        attempts: 0
      })

      this.requestQueue.sort((a, b) => a.priority - b.priority)
      this.processQueue()
    })
  }

  // Process request queue
  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrent || this.requestQueue.length === 0) {
      return
    }

    const request = this.requestQueue.shift()
    if (!request) return

    this.activeRequests++

    try {
      const response = await this.executeRequest(request.config, request.attempts)
      request.resolve(response)
    } catch (error) {
      request.attempts++
      
      if (request.attempts < (request.config.retries || 1)) {
        // Retry with exponential backoff
        const delay = (request.config.retryDelay || 1000) * Math.pow(2, request.attempts - 1)
        setTimeout(() => {
          this.requestQueue.unshift(request)
          this.processQueue()
        }, delay)
      } else {
        request.reject(error instanceof Error ? error : new Error('Request failed after retries'))
      }
    } finally {
      this.activeRequests--
      this.processQueue() // Process next request
    }
  }

  // Execute individual request
  private async executeRequest(config: RequestConfig, attempt: number): Promise<ResponseConfig> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000)

    try {
      const fetchConfig: RequestInit = {
        method: config.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        signal: config.signal || controller.signal
      }

      if (config.body && config.method && config.method !== 'GET') {
        fetchConfig.body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
      }

      const response = await fetch(config.url, fetchConfig)
      clearTimeout(timeoutId)

      // Parse response
      const contentType = response.headers.get('content-type') || ''
      let data: any = null

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else if (contentType.includes('text/')) {
        data = await response.text()
      } else {
        data = await response.blob()
      }

      // Get response headers as object
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      return {
        data,
        error: response.status >= 400 ? new Error(`HTTP ${response.status}`) : null,
        status: response.status,
        headers,
        cached: false,
        duration: 0 // Will be set by caller
      }
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      
      throw error
    }
  }

  // Batch requests for efficiency
  async batchRequest<T = any>(configs: RequestConfig[]): Promise<ResponseConfig<T>[]> {
    // Group similar requests
    const grouped = this.groupSimilarRequests(configs)
    const results: ResponseConfig<T>[] = []

    for (const group of grouped) {
      if (group.length === 1) {
        // Single request
        const result = await this.request(group[0])
        results.push(result)
      } else {
        // Multiple requests - try to batch
        const batchResult = await this.executeBatch(group)
        results.push(...batchResult)
      }
    }

    return results
  }

  // Group similar requests to enable batching
  private groupSimilarRequests(configs: RequestConfig[]): RequestConfig[][] {
    const groups: RequestConfig[][] = []
    const processed = new Set<number>()

    for (let i = 0; i < configs.length; i++) {
      if (processed.has(i)) continue

      const group = [configs[i]]
      processed.add(i)

      // Find similar requests (same base URL, method, etc.)
      for (let j = i + 1; j < configs.length; j++) {
        if (processed.has(j)) continue

        if (this.areRequestsSimilar(configs[i], configs[j])) {
          group.push(configs[j])
          processed.add(j)
        }
      }

      groups.push(group)
    }

    return groups
  }

  // Check if two requests are similar enough to batch
  private areRequestsSimilar(config1: RequestConfig, config2: RequestConfig): boolean {
    return config1.method === config2.method &&
           config1.url.split('?')[0] === config2.url.split('?')[0] &&
           config1.headers?.['content-type'] === config2.headers?.['content-type']
  }

  // Execute batch request
  private async executeBatch(configs: RequestConfig[]): Promise<ResponseConfig[]> {
    // For HTTP/2 or similar protocols, multiple requests can be sent concurrently
    // This is a simplified implementation
    const promises = configs.map(config => this.request(config))
    return Promise.all(promises)
  }

  // Preload critical resources
  async preloadResources(urls: string[], priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> {
    const configs: RequestConfig[] = urls.map(url => ({
      url,
      method: 'GET',
      cache: true,
      priority
    }))

    await Promise.allSettled(configs.map(config => this.request(config)))
  }

  // Stream large responses
  async streamRequest(
    config: RequestConfig,
    onChunk: (chunk: any) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const controller = new AbortController()
    
    try {
      const response = await fetch(config.url, {
        method: config.method || 'GET',
        headers: config.headers,
        signal: config.signal || controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          onComplete()
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        onChunk(chunk)
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Streaming failed'))
    }
  }

  // WebSocket manager for real-time data
  createWebSocket(url: string, config: {
    protocols?: string[]
    onMessage?: (data: any) => void
    onOpen?: () => void
    onClose?: () => void
    onError?: (error: Event) => void
    reconnect?: boolean
    maxReconnectAttempts?: number
  } = {}): WebSocketManager {
    return new WebSocketManager(url, config)
  }

  // Cache management
  private generateCacheKey(config: RequestConfig): string {
    const { url, method, headers, body } = config
    return `${method || 'GET'}:${url}:${JSON.stringify(headers)}:${JSON.stringify(body)}`
  }

  private getCachedResponse<T>(cacheKey: string): ResponseConfig<T> | null {
    const cached = this.requestCache.get(cacheKey)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > cached.ttl) {
      this.requestCache.delete(cacheKey)
      return null
    }

    return {
      ...cached.response,
      cached: true
    }
  }

  private setCachedResponse(cacheKey: string, response: ResponseConfig, ttl: number): void {
    this.requestCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      ttl
    })
  }

  private getPriorityValue(priority: 'low' | 'normal' | 'high'): number {
    switch (priority) {
      case 'high': return 1
      case 'normal': return 2
      case 'low': return 3
      default: return 2
    }
  }

  // Start queue processor
  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue()
    }, 100)
  }

  // Get network statistics
  getStats() {
    return {
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      maxConcurrent: this.maxConcurrent,
      cacheSize: this.requestCache.size,
      networkQuality: this.networkOptimizer.getNetworkQuality()
    }
  }
}

// WebSocket Manager for real-time connections
class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts: number
  private reconnectDelay = 1000

  constructor(
    private url: string,
    private config: {
      protocols?: string[]
      onMessage?: (data: any) => void
      onOpen?: () => void
      onClose?: () => void
      onError?: (error: Event) => void
      reconnect?: boolean
      maxReconnectAttempts?: number
    }
  ) {
    this.maxReconnectAttempts = config.maxReconnectAttempts || 5
    this.connect()
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url, this.config.protocols)
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.config.onOpen?.()
      }
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.config.onMessage?.(data)
        } catch {
          this.config.onMessage?.(event.data)
        }
      }
      
      this.ws.onclose = () => {
        this.config.onClose?.()
        
        if (this.config.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++
            this.connect()
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts))
        }
      }
      
      this.ws.onerror = (error) => {
        this.config.onError?.(error)
      }
    } catch (error) {
      this.config.onError?.(error as any)
    }
  }

  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  close(): void {
    this.config.reconnect = false
    this.ws?.close()
  }

  get readyState(): number {
    return this.ws?.readyState || WebSocket.CLOSED
  }
}

// HTTP/2 optimizations
export class HTTP2Optimizer {
  private static instance: HTTP2Optimizer
  private connectionPool = new Map<string, any>()

  static getInstance(): HTTP2Optimizer {
    if (!HTTP2Optimizer.instance) {
      HTTP2Optimizer.instance = new HTTP2Optimizer()
    }
    return HTTP2Optimizer.instance
  }

  // Enable HTTP/2 push
  async enablePush(url: string): Promise<void> {
    // This would configure HTTP/2 server push
    // Implementation depends on server capabilities
  }

  // Optimize for HTTP/2 multiplexing
  optimizeForHTTP2(): void {
    // Enable connection pooling, reduce round trips, etc.
  }
}

// Network quality adapter
export class NetworkQualityAdapter {
  private static instance: NetworkQualityAdapter
  private networkOptimizer = NetworkOptimizer.getInstance()
  private qualityThresholds = {
    slow: { rtt: 300, downloadSpeed: 1 }, // 300ms RTT, 1Mbps
    fast: { rtt: 100, downloadSpeed: 10 } // 100ms RTT, 10Mbps
  }

  static getInstance(): NetworkQualityAdapter {
    if (!NetworkQualityQualityAdapter.instance) {
      NetworkQualityAdapter.instance = new NetworkQualityAdapter()
    }
    return NetworkQualityAdapter.instance
  }

  // Adapt request based on network quality
  adaptRequest(config: RequestConfig): RequestConfig {
    const quality = this.networkOptimizer.getNetworkQuality()
    
    switch (quality) {
      case 'slow':
        return {
          ...config,
          timeout: Math.max(config.timeout || 0, 30000),
          retries: Math.min(config.retries || 1, 1),
          cache: config.cache !== false // Force caching on slow connections
        }
      
      case 'fast':
        return {
          ...config,
          timeout: Math.min(config.timeout || 30000, 10000),
          retries: Math.max(config.retries || 1, 3)
        }
      
      default:
        return config
    }
  }

  // Adapt content based on network quality
  adaptContent(type: 'image' | 'video' | 'data', quality: 'slow' | 'fast' | 'unknown'): any {
    switch (type) {
      case 'image':
        return {
          quality: quality === 'slow' ? 60 : 90,
          format: quality === 'fast' ? 'webp' : 'jpeg',
          progressive: quality === 'slow'
        }
      
      case 'video':
        return {
          bitrate: quality === 'slow' ? 500 : 2000, // kbps
          resolution: quality === 'slow' ? '480p' : '1080p'
        }
      
      default:
        return {}
    }
  }
}

export default NetworkRequestManager