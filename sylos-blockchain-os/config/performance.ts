// Performance optimization configuration for Xorb Blockchain OS
export interface PerformanceConfig {
  // Bundle optimization
  bundle: {
    chunkSizeWarningLimit: number
    maxParallelRequests: number
    enableTreeShaking: boolean
    enableCodeSplitting: boolean
    manualChunks: Record<string, string[]>
  }
  
  // Caching configuration
  cache: {
    enableServiceWorker: boolean
    enableBrowserCache: boolean
    cacheDuration: number
    cacheStrategies: {
      static: string
      api: string
      blockchain: string
    }
  }
  
  // Image optimization
  image: {
    enableOptimization: boolean
    formats: ('webp' | 'avif' | 'jpeg' | 'png')[]
    quality: number
    lazyLoading: boolean
  }
  
  // Code splitting
  codeSplitting: {
    enabled: boolean
    strategies: {
      route: boolean
      vendor: boolean
      feature: boolean
    }
  }
  
  // Resource hints
  hints: {
    preload: boolean
    prefetch: boolean
    preconnect: boolean
  }
}

export const performanceConfig: PerformanceConfig = {
  // Bundle optimization
  bundle: {
    chunkSizeWarningLimit: 1000, // 1MB
    maxParallelRequests: 6,
    enableTreeShaking: process.env.NODE_ENV === 'production',
    enableCodeSplitting: true,
    manualChunks: {
      // React ecosystem
      'react-vendor': [
        'react',
        'react-dom',
        'react-router-dom'
      ],
      // Blockchain libraries
      'blockchain-vendor': [
        'ethers',
        '@rainbow-me/rainbowkit',
        'wagmi',
        'viem'
      ],
      // UI libraries
      'ui-vendor': [
        'lucide-react',
        '@supabase/supabase-js'
      ],
      // State management
      'state-vendor': [
        '@tanstack/react-query',
        '@tanstack/react-query-devtools'
      ],
      // Utilities
      'utils-vendor': [
        'date-fns',
        'lodash-es',
        'clsx',
        'tailwind-merge'
      ],
      // DeFi components
      'defi-vendor': [
        'web3-utils',
        'bn.js'
      ]
    }
  },
  
  // Caching configuration
  cache: {
    enableServiceWorker: process.env.NODE_ENV === 'production',
    enableBrowserCache: process.env.NODE_ENV === 'production',
    cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
    cacheStrategies: {
      static: 'max-age=31536000, immutable', // 1 year for static assets
      api: 'max-age=60, stale-while-revalidate=300', // 1 minute with 5 min SWR
      blockchain: 'max-age=30, stale-while-revalidate=60' // 30 seconds with 1 min SWR
    }
  },
  
  // Image optimization
  image: {
    enableOptimization: process.env.NODE_ENV === 'production',
    formats: ['webp', 'avif', 'jpeg'],
    quality: 80,
    lazyLoading: true
  },
  
  // Code splitting
  codeSplitting: {
    enabled: true,
    strategies: {
      route: true, // Route-based splitting
      vendor: true, // Vendor library splitting
      feature: true // Feature-based splitting
    }
  },
  
  // Resource hints
  hints: {
    preload: process.env.NODE_ENV === 'production',
    prefetch: process.env.NODE_ENV === 'production',
    preconnect: true
  }
}

// Performance monitoring
export interface PerformanceMonitoring {
  // Core Web Vitals
  vitals: {
    enableTracking: boolean
    thresholds: {
      LCP: number // Largest Contentful Paint
      FID: number // First Input Delay
      CLS: number // Cumulative Layout Shift
    }
  }
  
  // Memory monitoring
  memory: {
    enableTracking: boolean
    threshold: number // in MB
  }
  
  // Network monitoring
  network: {
    enableTracking: boolean
    connectionType: boolean
    effectiveType: boolean
  }
}

export const performanceMonitoring: PerformanceMonitoring = {
  // Core Web Vitals
  vitals: {
    enableTracking: process.env.NODE_ENV === 'production',
    thresholds: {
      LCP: 2500, // 2.5 seconds
      FID: 100, // 100 milliseconds
      CLS: 0.1 // 0.1 threshold
    }
  },
  
  // Memory monitoring
  memory: {
    enableTracking: true,
    threshold: 50 // 50MB
  },
  
  // Network monitoring
  network: {
    enableTracking: true,
    connectionType: true,
    effectiveType: true
  }
}

// Bundle analyzer configuration
export const bundleAnalyzer = {
  // Analyzer mode
  mode: 'analyze',
  
  // Output options
  output: {
    filename: 'stats.html',
    reportFilename: 'report.html',
    reportTitle: 'Xorb Bundle Analysis',
    
    // Open browser automatically
    openAnalyzer: false,
    
    // Generate Gzip size
    gzipSize: true,
    
    // Generate Brotli size
    brotliSize: true,
    
    // Exclude dependencies from stats
    excludeDependencies: [
      // Large but necessary dependencies
    ]
  },
  
  // Bundle size warnings
  warnings: {
    chunkSize: 500 * 1024, // 500KB
    totalSize: 2 * 1024 * 1024 // 2MB
  }
}

// Performance budgets
export const performanceBudgets = {
  // Resource budgets
  resources: {
    javascript: 500 * 1024, // 500KB
    css: 50 * 1024, // 50KB
    images: 200 * 1024, // 200KB
    fonts: 100 * 1024, // 100KB
    total: 1 * 1024 * 1024 // 1MB total
  },
  
  // Runtime budgets
  runtime: {
    firstContentfulPaint: 1500, // 1.5s
    largestContentfulPaint: 2500, // 2.5s
    firstInputDelay: 100, // 100ms
    cumulativeLayoutShift: 0.1, // 0.1
    timeToInteractive: 3000, // 3s
    totalBlockingTime: 300 // 300ms
  }
}

export default performanceConfig