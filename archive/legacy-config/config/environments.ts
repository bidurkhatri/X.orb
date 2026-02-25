interface BuildEnvironment {
  name: 'development' | 'staging' | 'production'
  apiUrl: string
  wsUrl: string
  networkName: string
  chainId: number
  explorerUrl: string
  supabaseUrl: string
  supabaseAnonKey: string
  features: {
    enableDebugging: boolean
    enableAnalytics: boolean
    enableErrorReporting: boolean
    enableHotReload: boolean
    enableSourceMaps: boolean
  }
  optimizations: {
    minify: boolean
    treeShaking: boolean
    codeSplitting: boolean
    imageOptimization: boolean
    bundleAnalysis: boolean
  }
  caching: {
    strategy: 'aggressive' | 'moderate' | 'conservative'
    maxAge: number
    serviceWorker: boolean
  }
  security: {
    cspEnabled: boolean
    hstsEnabled: boolean
    sriEnabled: boolean
    secureHeaders: boolean
  }
  monitoring: {
    enableLogging: boolean
    enableMetrics: boolean
    enableTracing: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
}

const environments: Record<string, BuildEnvironment> = {
  development: {
    name: 'development',
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001',
    networkName: 'Local Development',
    chainId: 31337,
    explorerUrl: 'http://localhost:8545',
    supabaseUrl: 'http://localhost:54321',
    supabaseAnonKey: 'development-key',
    features: {
      enableDebugging: true,
      enableAnalytics: false,
      enableErrorReporting: false,
      enableHotReload: true,
      enableSourceMaps: true
    },
    optimizations: {
      minify: false,
      treeShaking: false,
      codeSplitting: false,
      imageOptimization: false,
      bundleAnalysis: true
    },
    caching: {
      strategy: 'conservative',
      maxAge: 0,
      serviceWorker: false
    },
    security: {
      cspEnabled: false,
      hstsEnabled: false,
      sriEnabled: false,
      secureHeaders: false
    },
    monitoring: {
      enableLogging: true,
      enableMetrics: true,
      enableTracing: true,
      logLevel: 'debug'
    }
  },

  staging: {
    name: 'staging',
    apiUrl: 'https://staging-api.sylos.io',
    wsUrl: 'wss://staging-ws.sylos.io',
    networkName: 'Polygon Amoy Testnet',
    chainId: 80002,
    explorerUrl: 'https://amoy.polygonscan.com',
    supabaseUrl: 'https://staging.supabase.co',
    supabaseAnonKey: process.env.VITE_STAGING_SUPABASE_ANON_KEY || '',
    features: {
      enableDebugging: true,
      enableAnalytics: true,
      enableErrorReporting: true,
      enableHotReload: false,
      enableSourceMaps: true
    },
    optimizations: {
      minify: true,
      treeShaking: true,
      codeSplitting: true,
      imageOptimization: true,
      bundleAnalysis: true
    },
    caching: {
      strategy: 'moderate',
      maxAge: 3600,
      serviceWorker: true
    },
    security: {
      cspEnabled: true,
      hstsEnabled: false,
      sriEnabled: false,
      secureHeaders: true
    },
    monitoring: {
      enableLogging: true,
      enableMetrics: true,
      enableTracing: true,
      logLevel: 'info'
    }
  },

  production: {
    name: 'production',
    apiUrl: 'https://api.sylos.io',
    wsUrl: 'wss://ws.sylos.io',
    networkName: 'Polygon Mainnet',
    chainId: 137,
    explorerUrl: 'https://polygonscan.com',
    supabaseUrl: 'https://production.supabase.co',
    supabaseAnonKey: process.env.VITE_PRODUCTION_SUPABASE_ANON_KEY || '',
    features: {
      enableDebugging: false,
      enableAnalytics: true,
      enableErrorReporting: true,
      enableHotReload: false,
      enableSourceMaps: false
    },
    optimizations: {
      minify: true,
      treeShaking: true,
      codeSplitting: true,
      imageOptimization: true,
      bundleAnalysis: false
    },
    caching: {
      strategy: 'aggressive',
      maxAge: 31536000,
      serviceWorker: true
    },
    security: {
      cspEnabled: true,
      hstsEnabled: true,
      sriEnabled: true,
      secureHeaders: true
    },
    monitoring: {
      enableLogging: true,
      enableMetrics: true,
      enableTracing: true,
      logLevel: 'error'
    }
  }
}

export const getEnvironment = (envName?: string): BuildEnvironment => {
  const name = (envName || process.env.NODE_ENV || 'development') as keyof typeof environments
  return environments[name] || environments.development
}

export const getEnvironmentVariables = (env: BuildEnvironment) => {
  const variables = {
    // Core URLs
    VITE_API_URL: env.apiUrl,
    VITE_WS_URL: env.wsUrl,
    VITE_NETWORK_NAME: env.networkName,
    VITE_CHAIN_ID: env.chainId.toString(),
    VITE_EXPLORER_URL: env.explorerUrl,
    
    // Supabase
    VITE_SUPABASE_URL: env.supabaseUrl,
    VITE_SUPABASE_ANON_KEY: env.supabaseAnonKey,
    
    // Features
    VITE_ENABLE_DEBUGGING: env.features.enableDebugging.toString(),
    VITE_ENABLE_ANALYTICS: env.features.enableAnalytics.toString(),
    VITE_ENABLE_ERROR_REPORTING: env.features.enableErrorReporting.toString(),
    VITE_ENABLE_HOT_RELOAD: env.features.enableHotReload.toString(),
    VITE_ENABLE_SOURCE_MAPS: env.features.enableSourceMaps.toString(),
    
    // Environment
    NODE_ENV: env.name,
    VITE_ENV: env.name,
    VITE_APP_ENV: env.name
  }
  
  return variables
}

export const validateEnvironment = (env: BuildEnvironment): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  // Required URLs
  if (!env.apiUrl) errors.push('API URL is required')
  if (!env.wsUrl) errors.push('WebSocket URL is required')
  if (!env.networkName) errors.push('Network name is required')
  
  // Chain ID validation
  if (!Number.isInteger(env.chainId) || env.chainId <= 0) {
    errors.push('Valid chain ID is required')
  }
  
  // Supabase configuration
  if (env.features.enableAnalytics || env.features.enableErrorReporting) {
    if (!env.supabaseUrl) errors.push('Supabase URL is required for analytics/error reporting')
    if (!env.supabaseAnonKey) errors.push('Supabase anon key is required for analytics/error reporting')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export const generateEnvironmentReport = (env: BuildEnvironment) => {
  const validation = validateEnvironment(env)
  const variables = getEnvironmentVariables(env)
  
  return {
    environment: env.name,
    validation,
    variables: Object.keys(variables),
    features: {
      debugging: env.features.enableDebugging,
      analytics: env.features.enableAnalytics,
      errorReporting: env.features.enableErrorReporting,
      hotReload: env.features.enableHotReload,
      sourceMaps: env.features.enableSourceMaps
    },
    optimizations: {
      minification: env.optimizations.minify,
      treeShaking: env.optimizations.treeShaking,
      codeSplitting: env.optimizations.codeSplitting,
      imageOptimization: env.optimizations.imageOptimization,
      bundleAnalysis: env.optimizations.bundleAnalysis
    },
    security: {
      csp: env.security.cspEnabled,
      hsts: env.security.hstsEnabled,
      sri: env.security.sriEnabled,
      secureHeaders: env.security.secureHeaders
    },
    caching: {
      strategy: env.caching.strategy,
      maxAge: env.caching.maxAge,
      serviceWorker: env.caching.serviceWorker
    }
  }
}

export default environments
