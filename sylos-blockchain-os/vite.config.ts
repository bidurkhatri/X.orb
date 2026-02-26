import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import autoprefixer from 'autoprefixer'
import { createHtmlPlugin } from 'vite-plugin-html'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isStaging = mode === 'staging'
  const isAnalyze = mode === 'analyze'

  // Use VITE_CDN_URL env var for custom CDN, otherwise serve from same origin
  const baseUrl = process.env.VITE_CDN_URL || '/'

  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
      // HTML plugin for CSP and performance optimization
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: 'SylOS Blockchain OS',
            description: 'Next-generation blockchain operating system',
            csp: isProduction ? generateCSP() : generateCSPStaging(),
            // Performance optimizations
            preloadCritical: isProduction,
            serviceWorker: isProduction,
            resourceHints: generateResourceHints()
          }
        }
      }),
      // Node.js polyfills for Web3 libraries (Buffer, process, etc.)
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'crypto'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ].filter(Boolean),

    // Base configuration
    base: baseUrl,

    // Path aliases
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    // Build configuration with performance optimizations
    build: {
      // Source map generation (only for staging/production debugging)
      sourcemap: isStaging || isAnalyze,

      // Enhanced minification for production
      minify: isProduction ? 'esbuild' : false,

      target: ['es2020', 'chrome80', 'firefox78', 'safari14', 'edge80'],

      // CSS code splitting
      cssCodeSplit: true,

      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return
          if (warning.code === 'CIRCULAR_DEPENDENCY') return
          warn(warning)
        },
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // Keep React separate for caching (rarely changes)
              if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor'
              // Blockchain libs are large — separate chunk
              if (/\/node_modules\/(ethers|@rainbow-me|wagmi|viem|@walletconnect|@reown|@coinbase)\//.test(id)) return 'blockchain-vendor'
            }
          },
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        }
      },

      // Performance budgets
      chunkSizeWarningLimit: 1000, // 1MB
      assetsInlineLimit: 4096, // 4KB

      // Compressed size reporting
      reportCompressedSize: isProduction,

      // Clean output directory
      emptyOutDir: true,

      // Module pre-bundling
    },

    // Development server optimizations
    server: {
      port: 5173,
      host: true,
      cors: true,
      // Security headers
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
      // HMR optimizations
      hmr: {
        overlay: !isProduction
      },
      // Optimized dependencies
      fs: {
        allow: ['..', '..']
      }
    },

    // Preview server
    preview: {
      port: 4173,
      host: true,
      cors: true,
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      }
    },

    // Enhanced dependencies optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'ethers',
        '@rainbow-me/rainbowkit',
        'wagmi',
        'viem',
        'lucide-react',
        '@supabase/supabase-js',
        '@tanstack/react-query',
        'date-fns',
        'clsx',
        'tailwind-merge'
      ],
      // Pre-bundle for development
      force: !isProduction,
      // Exclude large dependencies from pre-bundling
      exclude: [
        // Exclude if too large
      ]
    },

    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __ENV__: JSON.stringify(mode),
      __PERFORMANCE_MODE__: JSON.stringify(isProduction),
    },

    // Enhanced CSS configuration
    css: {
      // CSS modules
      modules: {
        localsConvention: 'camelCase'
      },
      // Preprocessor options
      preprocessorOptions: {
        scss: {
          additionalData: `$env: ${mode};`
        }
      },
      // Dev tools
      devSourcemap: !isProduction,
      // PostCSS plugins
      postcss: {
        plugins: [
          autoprefixer(),
        ]
      }
    },

    // Worker configuration
    worker: {
      format: 'es',
    },

    // JSON configuration
    json: {
      namedExports: true,
      stringify: false
    }
  }
})

// Generate strict CSP for production
function generateCSP() {
  return `
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' 'unsafe-eval' https://cdn.sylos.io;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://polygon-rpc.com https://api.sylos.io wss://ws.sylos.io;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim()
}

// Generate relaxed CSP for staging
function generateCSPStaging() {
  return `
    default-src 'self' 'unsafe-inline' 'unsafe-eval';
    script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' 'unsafe-eval' https://staging-cdn.sylos.io;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https:;
    connect-src 'self' https://rpc-amoy.polygon.technology https://staging-api.sylos.io ws://localhost:*;
    frame-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s{2,}/g, ' ').trim()
}

// Generate resource hints for performance
function generateResourceHints() {
  return {
    preconnect: [
      'https://polygon-rpc.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://api.sylos.io'
    ],
    preload: [
      '/static/js/main.js',
      '/static/css/main.css',
      '/manifest.json'
    ],
    dnsPrefetch: [
      'https://polygon-rpc.com',
      'https://api.sylos.io'
    ]
  }
}