// Database Query Optimization Utilities
import { CacheOptimizer } from './performance'

export interface QueryConfig {
  key: string
  query: string | (() => Promise<any>)
  ttl?: number
  retryCount?: number
  retryDelay?: number
  staleWhileRevalidate?: boolean
  enabled?: boolean
  dependencies?: any[]
}

export interface QueryResult<T> {
  data: T | null
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  refetch: () => Promise<void>
  mutate: (newData: T) => void
}

// Advanced query cache with smart invalidation
export class QueryCache {
  private static instance: QueryCache
  private cache: Map<string, {
    data: any
    error: Error | null
    timestamp: number
    ttl: number
    dependencies: string[]
    subscribers: Set<() => void>
  }> = new Map()
  private cacheOptimizer = CacheOptimizer.getInstance()
  private cleanupInterval: NodeJS.Timeout | null = null

  static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache()
    }
    return QueryCache.instance
  }

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  // Get cached query result
  get<T>(key: string): {
    data: T | null
    isStale: boolean
    isValid: boolean
  } | null {
    const cached = this.cache.get(key)
    
    if (!cached) return null

    const now = Date.now()
    const age = now - cached.timestamp
    const isValid = age < cached.ttl
    const isStale = age > cached.ttl * 0.8 // 80% of TTL considered stale

    return {
      data: isValid ? cached.data : null,
      isStale: !isValid && age < cached.ttl * 2, // Double TTL for stale
      isValid
    }
  }

  // Set cached query result
  set(
    key: string,
    data: any,
    config: {
      ttl?: number
      dependencies?: string[]
    } = {}
  ): void {
    const ttl = config.ttl || 300000 // 5 minutes default
    const dependencies = config.dependencies || []

    this.cache.set(key, {
      data,
      error: null,
      timestamp: Date.now(),
      ttl,
      dependencies,
      subscribers: new Set()
    })

    // Cache in underlying cache optimizer for persistence
    this.cacheOptimizer.set(`query:${key}`, data, ttl)

    // Notify subscribers
    this.notifySubscribers(key)
  }

  // Set error for query
  setError(key: string, error: Error, config: { ttl?: number } = {}): void {
    const ttl = config.ttl || 60000 // 1 minute for errors
    const existing = this.cache.get(key)

    this.cache.set(key, {
      data: existing?.data || null,
      error,
      timestamp: Date.now(),
      ttl,
      dependencies: existing?.dependencies || [],
      subscribers: existing?.subscribers || new Set()
    })

    this.notifySubscribers(key)
  }

  // Subscribe to query changes
  subscribe(key: string, callback: () => void): () => void {
    const cached = this.cache.get(key)
    if (cached) {
      cached.subscribers.add(callback)
    }

    return () => {
      const cached = this.cache.get(key)
      if (cached) {
        cached.subscribers.delete(callback)
      }
    }
  }

  // Invalidate queries
  invalidate(key?: string, pattern?: string): void {
    if (key) {
      this.cache.delete(key)
      this.cacheOptimizer.set(`query:${key}`, null, 1) // Short TTL
    } else if (pattern) {
      const regex = new RegExp(pattern)
      for (const cacheKey of this.cache.keys()) {
        if (regex.test(cacheKey)) {
          this.cache.delete(cacheKey)
        }
      }
    } else {
      // Clear all
      this.cache.clear()
      this.cacheOptimizer.set('query:*', null, 1)
    }
  }

  // Invalidate by dependencies
  invalidateByDependency(dependency: string): void {
    for (const [key, cached] of this.cache.entries()) {
      if (cached.dependencies.includes(dependency)) {
        this.invalidate(key)
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    let valid = 0
    let stale = 0
    let expired = 0
    let totalSize = 0

    for (const cached of this.cache.values()) {
      const age = now - cached.timestamp
      if (age < cached.ttl) {
        valid++
      } else if (age < cached.ttl * 2) {
        stale++
      } else {
        expired++
      }
      totalSize += JSON.stringify(cached.data).length
    }

    return {
      total: this.cache.size,
      valid,
      stale,
      expired,
      totalSize,
      hitRate: valid / this.cache.size || 0
    }
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl * 2) {
        this.cache.delete(key)
      }
    }
  }

  // Notify subscribers
  private notifySubscribers(key: string): void {
    const cached = this.cache.get(key)
    if (cached) {
      cached.subscribers.forEach(callback => {
        try {
          callback()
        } catch (error) {
          console.warn('Query subscriber error:', error)
        }
      })
    }
  }

  // Destroy instance
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.cache.clear()
  }
}

// Query manager for React
export class QueryManager {
  private static instance: QueryManager
  private queryCache = QueryCache.getInstance()
  private activeQueries = new Map<string, Promise<any>>()

  static getInstance(): QueryManager {
    if (!QueryManager.instance) {
      QueryManager.instance = new QueryManager()
    }
    return QueryManager.instance
  }

  // Execute query with optimization
  async executeQuery<T>(
    config: QueryConfig
  ): Promise<QueryResult<T>> {
    const { key, query, ttl, retryCount, retryDelay, enabled = true } = config

    if (!enabled) {
      return {
        data: null,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: async () => {},
        mutate: () => {}
      }
    }

    // Check cache first
    const cached = this.queryCache.get<T>(key)
    if (cached?.data !== null) {
      return {
        data: cached.data,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: () => this.executeQuery(config),
        mutate: (newData: T) => this.queryCache.set(key, newData, { ttl })
      }
    }

    // Check if query is already running
    if (this.activeQueries.has(key)) {
      try {
        const result = await this.activeQueries.get(key)
        return {
          data: result,
          error: null,
          isLoading: false,
          isError: false,
          isSuccess: true,
          refetch: () => this.executeQuery(config),
          mutate: (newData: T) => this.queryCache.set(key, newData, { ttl })
        }
      } catch (error) {
        // Query failed, will retry below
      }
    }

    // Execute query with retry logic
    const queryPromise = this.executeWithRetry(config)
    this.activeQueries.set(key, queryPromise)

    try {
      const result = await queryPromise
      this.queryCache.set(key, result, { ttl })
      
      return {
        data: result,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
        refetch: () => this.executeQuery(config),
        mutate: (newData: T) => this.queryCache.set(key, newData, { ttl })
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Query failed')
      this.queryCache.setError(key, err, { ttl: 60000 })

      return {
        data: null,
        error: err,
        isLoading: false,
        isError: true,
        isSuccess: false,
        refetch: () => this.executeQuery(config),
        mutate: () => {}
      }
    } finally {
      this.activeQueries.delete(key)
    }
  }

  // Execute query with retry logic
  private async executeWithRetry<T>(config: QueryConfig): Promise<T> {
    const { query, retryCount = 3, retryDelay = 1000 } = config
    
    let lastError: Error
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const result = typeof query === 'function' ? await query() : await this.executeRawQuery(query)
        return result as T
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Query execution failed')
        
        if (attempt === retryCount) break
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1)
        await this.sleep(delay)
      }
    }
    
    throw lastError!
  }

  // Execute raw SQL query (placeholder)
  private async executeRawQuery(query: string): Promise<any> {
    // This would integrate with actual database
    // For now, return a placeholder
    return { data: [], count: 0 }
  }

  // Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Prefetch queries
  async prefetch(config: QueryConfig): Promise<void> {
    const { key, ttl } = config
    const cached = this.queryCache.get(key)
    
    if (!cached || cached.isStale) {
      this.executeQuery(config).catch(console.warn)
    }
  }

  // Batch execute multiple queries
  async batchExecute<T>(configs: QueryConfig[]): Promise<QueryResult<T>[]> {
    const results = await Promise.allSettled(
      configs.map(config => this.executeQuery(config))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          data: null,
          error: result.reason,
          isLoading: false,
          isError: true,
          isSuccess: false,
          refetch: () => this.executeQuery(configs[index]),
          mutate: () => {}
        }
      }
    })
  }
}

// Database connection pool optimization
export class ConnectionPool {
  private static instance: ConnectionPool
  private pool: any[] = []
  private maxConnections = 10
  private activeConnections = 0

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool()
    }
    return ConnectionPool.instance
  }

  // Get connection from pool
  async getConnection(): Promise<any> {
    if (this.pool.length > 0) {
      return this.pool.pop()
    }

    if (this.activeConnections < this.maxConnections) {
      this.activeConnections++
      return this.createConnection()
    }

    // Wait for connection to become available
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (this.pool.length > 0) {
          resolve(this.pool.pop())
        } else {
          setTimeout(checkConnection, 100)
        }
      }
      checkConnection()
    })
  }

  // Return connection to pool
  returnConnection(conn: any): void {
    if (this.pool.length < this.maxConnections) {
      this.pool.push(conn)
    } else {
      this.closeConnection(conn)
    }
  }

  // Create new connection
  private async createConnection(): Promise<any> {
    // This would create actual database connection
    return {
      query: (sql: string) => ({ exec: () => Promise.resolve({ data: [] }) })
    }
  }

  // Close connection
  private closeConnection(conn: any): void {
    this.activeConnections--
    // Close actual connection
  }

  // Get pool statistics
  getStats() {
    return {
      totalConnections: this.pool.length + this.activeConnections,
      availableConnections: this.pool.length,
      activeConnections: this.activeConnections,
      maxConnections: this.maxConnections
    }
  }
}

// Query optimization utilities
export class QueryOptimizer {
  // Analyze query performance
  static analyzeQuery(query: string): {
    score: number
    issues: string[]
    suggestions: string[]
  } {
    const issues: string[] = []
    const suggestions: string[] = []
    let score = 100

    // Check for SELECT *
    if (query.includes('SELECT *')) {
      issues.push('Using SELECT * may fetch unnecessary data')
      suggestions.push('Specify only required columns')
      score -= 10
    }

    // Check for missing WHERE clause
    if (query.includes('FROM') && !query.includes('WHERE') && !query.includes('LIMIT')) {
      issues.push('Query without WHERE clause may scan entire table')
      suggestions.push('Add WHERE clause or LIMIT to reduce scanned rows')
      score -= 20
    }

    // Check for LIKE with leading wildcard
    if (query.includes('LIKE \'%')) {
      issues.push('LIKE with leading wildcard prevents index usage')
      suggestions.push('Consider full-text search or different indexing strategy')
      score -= 15
    }

    // Check for OR conditions
    if (query.includes(' OR ')) {
      issues.push('OR conditions may not use indexes efficiently')
      suggestions.push('Consider using UNION or different query structure')
      score -= 5
    }

    return { score, issues, suggestions }
  }

  // Generate optimized query
  static optimizeQuery(originalQuery: string, tableStats?: any): string {
    // Simple query optimization rules
    let optimized = originalQuery

    // Add LIMIT if missing and query is large
    if (optimized.includes('FROM') && !optimized.includes('LIMIT') && !optimized.includes('ORDER BY')) {
      optimized = optimized.replace(/;?\s*$/, ' LIMIT 100;')
    }

    // Suggest index creation
    const columns = this.extractColumns(optimized)
    
    return optimized
  }

  // Extract columns from query
  private static extractColumns(query: string): string[] {
    // Simple regex to extract column names
    const matches = query.match(/\b(?:SELECT|WHERE|ORDER BY|GROUP BY)\s+([^;]+)/gi)
    if (!matches) return []
    
    return matches[0]
      .split(/[,\s]+/)
      .filter(col => col.length > 0 && !['SELECT', 'WHERE', 'ORDER', 'BY', 'GROUP'].includes(col.toUpperCase()))
  }
}

export default {
  QueryCache,
  QueryManager,
  ConnectionPool,
  QueryOptimizer
}