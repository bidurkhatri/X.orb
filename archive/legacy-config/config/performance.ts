import { resolve } from 'path';

export const performanceConfig = {
  // Memory leak detection
  memory: {
    enabled: true,
    interval: 5000, // 5 seconds
    threshold: 100 * 1024 * 1024, // 100MB
    maxHeapSize: 1024 * 1024 * 1024, // 1GB
    monitoring: {
      enableProfiling: true,
      enableHeapSnapshot: true,
      snapshotInterval: 30000, // 30 seconds
      retentionCount: 10
    },
    detection: {
      algorithm: 'moving-average',
      windowSize: 20,
      sensitivity: 'medium', // low, medium, high
      adaptiveThreshold: true
    }
  },

  // Performance profiling
  profiling: {
    cpu: {
      enabled: true,
      sampleRate: 1000, // 1ms
      depth: 50,
      filter: {
        minDuration: 0.1, // 100ms minimum
        include: ['**/*.js', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules/**', '**/*.test.*']
      }
    },
    async: {
      enabled: true,
      trackPromises: true,
      trackTimeouts: true,
      trackIntervals: true
    },
    io: {
      enabled: true,
      trackFileIO: true,
      trackNetworkIO: true,
      bufferSize: 1024 * 1024 // 1MB
    }
  },

  // Performance monitoring
  monitoring: {
    realTime: {
      enabled: true,
      port: 9090,
      dashboard: 'http://localhost:9090',
      refreshInterval: 1000 // 1 second
    },
    metrics: {
      collection: {
        cpu: {
          enabled: true,
          interval: 1000,
          averaging: 'exponential',
          smoothing: 0.1
        },
        memory: {
          enabled: true,
          interval: 1000,
          fields: ['heapUsed', 'heapTotal', 'external', 'arrayBuffers']
        },
        eventLoop: {
          enabled: true,
          interval: 1000,
          lagThreshold: 10, // 10ms
          unrefTimers: false
        },
        garbage: {
          enabled: true,
          trackIncremental: true,
          trackFullGC: true
        }
      }
    },
    alerts: {
      conditions: {
        highMemoryUsage: {
          threshold: 0.8, // 80% of max heap
          duration: 30000 // 30 seconds
        },
        memoryLeak: {
          threshold: 50 * 1024 * 1024, // 50MB growth
          duration: 60000 // 1 minute
        },
        highCPUUsage: {
          threshold: 0.8, // 80% CPU
          duration: 30000 // 30 seconds
        },
        eventLoopLag: {
          threshold: 100, // 100ms
          duration: 10000 // 10 seconds
        }
      },
      actions: {
        logWarning: true,
        takeSnapshot: true,
        createAlert: true,
        sendNotification: false
      }
    }
  },

  // Bundle analysis
  bundle: {
    analysis: {
      enabled: true,
      formats: ['gzip', 'brotli'],
      chunkThreshold: 100 * 1024, // 100KB
      includeSourceMap: true,
      includeModuleIds: true
    },
    optimization: {
      treeShaking: true,
      codeSplitting: true,
      minification: {
        enabled: true,
        mangle: true,
        compress: {
          dead_code: true,
          drop_debugger: true,
          drop_console: true
        }
      }
    }
  },

  // Reporting
  reporting: {
    formats: ['json', 'html', 'csv', 'svg'],
    outputDir: 'reports/performance',
    retention: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxFiles: 100
    },
    dashboards: {
      local: 'http://localhost:3001',
      production: 'https://dashboard.sylos.io/performance',
      integration: 'https://staging-dashboard.sylos.io/performance'
    }
  },

  // Development
  development: {
    debug: {
      enabled: process.env.DEBUG === 'true',
      level: 'verbose' // verbose, info, warn, error
    },
    devtools: {
      enabled: process.env.NODE_ENV === 'development',
      memory: true,
      cpu: true,
      async: true
    }
  }
};

export default performanceConfig;