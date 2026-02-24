// Code Splitting and Lazy Loading Configuration
import React, { lazy, Suspense, ComponentType } from 'react'

// Lazy loading for main application components
export const LazyDesktop = lazy(() => import('../components/Desktop'))
export const LazyLockScreen = lazy(() => import('../components/LockScreen'))
export const LazyTaskbar = lazy(() => import('../components/Taskbar'))
export const LazyAppWindow = lazy(() => import('../components/AppWindow'))

// Lazy loading for app modules
export const LazyFileManagerApp = lazy(() => import('../components/apps/FileManagerApp'))
export const LazyPoPTrackerApp = lazy(() => import('../components/apps/PoPTrackerApp'))
export const LazySettingsApp = lazy(() => import('../components/apps/SettingsApp'))
export const LazyTokenDashboardApp = lazy(() => import('../components/apps/TokenDashboardApp'))
export const LazyWalletApp = lazy(() => import('../components/apps/WalletApp'))

// Advanced lazy loading with performance tracking
export interface LazyComponentOptions {
  componentName: string
  fallback?: ComponentType
  preload?: boolean
  onLoad?: () => void
  onError?: (error: Error) => void
  timeout?: number
}

export function createOptimizedLazyComponent(
  importFn: () => Promise<{ default: ComponentType<any> }>,
  options: LazyComponentOptions
) {
  const LazyComponent = lazy(() =>
    Promise.race([
      importFn(),
      new Promise<{ default: ComponentType<any> }>((_, reject) =>
        setTimeout(() => reject(new Error(`Lazy load timeout for ${options.componentName}`)),
          options.timeout || 10000)
      )
    ])
  )

  return {
    Component: LazyComponent,
    preload: () => {
      if (options.preload) {
        importFn().catch(error => {
          console.warn(`Failed to preload ${options.componentName}:`, error)
          options.onError?.(error)
        })
      }
    }
  }
}

// Predefined optimized lazy components
export const OptimizedLazyComponents = {
  Desktop: createOptimizedLazyComponent(
    () => import('../components/Desktop'),
    {
      componentName: 'Desktop',
      fallback: () => <div className="flex items-center justify-center h-full">Loading Desktop...</div>,
      preload: true
    }
  ),
  LockScreen: createOptimizedLazyComponent(
    () => import('../components/LockScreen'),
    {
      componentName: 'LockScreen',
      fallback: () => <div className="flex items-center justify-center h-full">Loading Lock Screen...</div>,
      preload: true
    }
  ),
  FileManager: createOptimizedLazyComponent(
    () => import('../components/apps/FileManagerApp'),
    {
      componentName: 'FileManager',
      fallback: () => <div className="p-4">Loading File Manager...</div>,
      preload: false,
      timeout: 5000
    }
  ),
  Wallet: createOptimizedLazyComponent(
    () => import('../components/apps/WalletApp'),
    {
      componentName: 'Wallet',
      fallback: () => <div className="p-4">Loading Wallet...</div>,
      preload: false,
      timeout: 8000
    }
  ),
  TokenDashboard: createOptimizedLazyComponent(
    () => import('../components/apps/TokenDashboardApp'),
    {
      componentName: 'TokenDashboard',
      fallback: () => <div className="p-4">Loading Token Dashboard...</div>,
      preload: false,
      timeout: 6000
    }
  ),
  PoPTracker: createOptimizedLazyComponent(
    () => import('../components/apps/PoPTrackerApp'),
    {
      componentName: 'PoPTracker',
      fallback: () => <div className="p-4">Loading PoP Tracker...</div>,
      preload: false,
      timeout: 7000
    }
  ),
  Settings: createOptimizedLazyComponent(
    () => import('../components/apps/SettingsApp'),
    {
      componentName: 'Settings',
      fallback: () => <div className="p-4">Loading Settings...</div>,
      preload: false,
      timeout: 5000
    }
  )
}

// Route-based code splitting configuration
export interface RouteConfig {
  path: string
  component: ComponentType<any>
  preload?: boolean
  requireAuth?: boolean
  critical?: boolean
}

export const routeConfigs: RouteConfig[] = [
  {
    path: '/',
    component: OptimizedLazyComponents.Desktop.Component,
    preload: true,
    critical: true
  },
  {
    path: '/lockscreen',
    component: OptimizedLazyComponents.LockScreen.Component,
    preload: true,
    critical: true
  },
  {
    path: '/file-manager',
    component: OptimizedLazyComponents.FileManager.Component,
    preload: false
  },
  {
    path: '/wallet',
    component: OptimizedLazyComponents.Wallet.Component,
    preload: false,
    requireAuth: true
  },
  {
    path: '/token-dashboard',
    component: OptimizedLazyComponents.TokenDashboard.Component,
    preload: false
  },
  {
    path: '/pop-tracker',
    component: OptimizedLazyComponents.PoPTracker.Component,
    preload: false
  },
  {
    path: '/settings',
    component: OptimizedLazyComponents.Settings.Component,
    preload: false
  }
]

// Feature-based code splitting
export const featureChunks = {
  // Core OS features (always loaded)
  core: {
    components: ['Desktop', 'LockScreen', 'Taskbar'],
    priority: 'critical',
    preload: true
  },

  // File management features
  fileManager: {
    components: ['FileManager'],
    priority: 'high',
    preload: false
  },

  // Blockchain features
  blockchain: {
    components: ['Wallet', 'TokenDashboard', 'PoPTracker'],
    priority: 'high',
    preload: false
  },

  // Settings and utilities
  utilities: {
    components: ['Settings'],
    priority: 'low',
    preload: false
  }
}

// Preload strategy based on user behavior
export class PreloadManager {
  private static instance: PreloadManager
  private preloadedFeatures: Set<string> = new Set()
  private userBehavior: { visitedPaths: Set<string>, interactions: number } = {
    visitedPaths: new Set(),
    interactions: 0
  }
  private preloadQueue: Array<{ feature: string; priority: number }> = []

  static getInstance(): PreloadManager {
    if (!PreloadManager.instance) {
      PreloadManager.instance = new PreloadManager()
    }
    return PreloadManager.instance
  }

  // Track user behavior for intelligent preloading
  trackUserBehavior(path: string, interaction: boolean = false) {
    this.userBehavior.visitedPaths.add(path)
    if (interaction) {
      this.userBehavior.interactions++
    }

    // Predict next likely features based on user behavior
    this.predictAndPreload()
  }

  // Intelligent preloading based on user patterns
  private predictAndPreload() {
    const visitedPaths = Array.from(this.userBehavior.visitedPaths)

    // Preload common next steps
    if (visitedPaths.includes('/') && !this.preloadedFeatures.has('fileManager')) {
      this.queuePreload('fileManager', 1)
    }

    if (visitedPaths.includes('/file-manager') && !this.preloadedFeatures.has('blockchain')) {
      this.queuePreload('blockchain', 2)
    }

    if (this.userBehavior.interactions > 10 && !this.preloadedFeatures.has('utilities')) {
      this.queuePreload('utilities', 3)
    }

    this.processPreloadQueue()
  }

  // Queue feature for preloading
  queuePreload(feature: string, priority: number = 5) {
    // Don't re-preload already loaded features
    if (this.preloadedFeatures.has(feature)) return

    this.preloadQueue.push({ feature, priority })
    this.preloadQueue.sort((a, b) => a.priority - b.priority)
  }

  // Process the preload queue
  private processPreloadQueue() {
    while (this.preloadQueue.length > 0 && this.preloadedFeatures.size < 3) {
      const { feature } = this.preloadQueue.shift()!
      this.preloadFeature(feature)
    }
  }

  // Preload a specific feature chunk
  async preloadFeature(feature: string) {
    const featureConfig = featureChunks[feature as keyof typeof featureChunks]
    if (!featureConfig || this.preloadedFeatures.has(feature)) return

    try {
      for (const componentName of featureConfig.components) {
        const component = OptimizedLazyComponents[componentName as keyof typeof OptimizedLazyComponents]
        if (component) {
          component.preload()
        }
      }
      this.preloadedFeatures.add(feature)
    } catch (error) {
      console.warn(`Failed to preload feature: ${feature}`, error)
    }
  }

  // Get preloaded features
  getPreloadedFeatures(): string[] {
    return Array.from(this.preloadedFeatures)
  }

  // Reset preloading (for testing or user preference changes)
  reset() {
    this.preloadedFeatures.clear()
    this.preloadQueue = []
    this.userBehavior = { visitedPaths: new Set(), interactions: 0 }
  }
}

// Resource hint manager for optimal loading
export class ResourceHintManager {
  private static instance: ResourceHintManager
  private hints: Map<string, HTMLLinkElement> = new Map()

  static getInstance(): ResourceHintManager {
    if (!ResourceHintManager.instance) {
      ResourceHintManager.instance = new ResourceHintManager()
    }
    return ResourceHintManager.instance
  }

  // Add resource hint
  addHint(resource: string, type: 'preload' | 'prefetch' | 'preconnect' = 'preload', as?: string) {
    if (this.hints.has(resource)) return

    const link = document.createElement('link')
    link.rel = type
    link.href = resource

    if (as) {
      link.as = as
    }

    document.head.appendChild(link)
    this.hints.set(resource, link)
  }

  // Add preconnect hints for external domains
  addPreconnect(domain: string) {
    this.addHint(`https://${domain}`, 'preconnect')
  }

  // Add preload hints for critical resources
  addPreload(resource: string, as?: string) {
    this.addHint(resource, 'preload', as)
  }

  // Add prefetch hints for non-critical resources
  addPrefetch(resource: string, as?: string) {
    this.addHint(resource, 'prefetch', as)
  }

  // Remove hint
  removeHint(resource: string) {
    const hint = this.hints.get(resource)
    if (hint) {
      document.head.removeChild(hint)
      this.hints.delete(resource)
    }
  }

  // Clear all hints
  clear() {
    for (const [resource, hint] of this.hints.entries()) {
      document.head.removeChild(hint)
    }
    this.hints.clear()
  }
}

// Bundle size optimization
export class BundleOptimizer {
  private static instance: BundleOptimizer
  private loadedChunks: Set<string> = new Set()

  static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer()
    }
    return BundleOptimizer.instance
  }

  // Mark chunk as loaded
  markChunkLoaded(chunkName: string) {
    this.loadedChunks.add(chunkName)
  }

  // Check if chunk is loaded
  isChunkLoaded(chunkName: string): boolean {
    return this.loadedChunks.has(chunkName)
  }

  // Get chunk size information
  async getChunkInfo() {
    try {
      const response = await fetch('/build-stats.json')
      const stats = await response.json()

      return Object.entries(stats.chunks).map(([name, chunk]: [string, any]) => ({
        name,
        size: chunk.size,
        gzipped: chunk.gzipped,
        loaded: this.isChunkLoaded(name)
      }))
    } catch (error) {
      console.warn('Could not get chunk info:', error)
      return []
    }
  }

  // Analyze bundle composition
  async analyzeBundle() {
    const chunks = await this.getChunkInfo()

    const analysis = {
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      totalGzipped: chunks.reduce((sum, chunk) => sum + (chunk.gzipped || 0), 0),
      loadedChunks: chunks.filter(chunk => chunk.loaded).length,
      totalChunks: chunks.length,
      largestChunks: chunks.sort((a, b) => b.size - a.size).slice(0, 5),
      optimizationOpportunities: chunks.filter(chunk => chunk.size > 100 * 1024) // > 100KB
    }

    return analysis
  }
}

// Performance-optimized suspense boundaries
export const SuspenseBoundary = ({
  children,
  fallback: Fallback,
}: {
  children: React.ReactNode
  fallback?: React.ComponentType
  onError?: (error: Error) => void
}) => {
  return (
    <Suspense
      fallback={Fallback ? <Fallback /> : <div className="flex items-center justify-center p-4">Loading...</div>}
    >
      {children}
    </Suspense>
  )
}

// Error boundary for lazy loaded components
export class LazyLoadErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<any>; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: any) {
    console.error('Lazy loading error:', error, errorInfo)
    this.props.onError?.(error)
  }

  override render() {
    if (this.state.hasError) {
      return <this.props.fallback error={this.state.error} />
    }

    return this.props.children
  }
}

export default {
  LazyDesktop,
  LazyLockScreen,
  LazyTaskbar,
  LazyAppWindow,
  OptimizedLazyComponents,
  PreloadManager,
  ResourceHintManager,
  BundleOptimizer,
  SuspenseBoundary,
  LazyLoadErrorBoundary
}