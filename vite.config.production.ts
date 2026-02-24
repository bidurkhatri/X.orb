import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { createHtmlPlugin } from 'vite-plugin-html'
import { splitVendorChunkPlugin } from 'vite'
import { getEnvironment } from './config/environments'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = getEnvironment(mode)
  const isProduction = env.name === 'production'
  const isStaging = env.name === 'staging'
  const isDevelopment = env.name === 'development'

  return {
    // Core plugins with advanced configuration
    plugins: [
      // React plugin with production optimizations
      react({
        fastRefresh: !isProduction,
        jsxRuntime: 'automatic',
        babel: {
          plugins: isProduction ? [
            // Remove console logs in production
            ['transform-remove-console', { exclude: ['error', 'warn'] }],
            // Optimize JSX
            ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
          ] : []
        }
      }),

      // Split vendor chunks for better caching
      splitVendorChunkPlugin(),

      // HTML plugin with advanced CSP
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: 'SylOS Blockchain OS',
            description: 'Next-generation blockchain operating system',
            csp: isProduction ? generateCSP() : generateCSPStaging(),
            preload: isProduction,
            ...getEnvironmentSpecificData(env)
          }
        }
      }),

      // Bundle analyzer (staging and production only)
      ...(isProduction || isStaging ? [
        visualizer({
          filename: 'dist/stats.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
          sourcemap: true,
          projectRoot: process.cwd(),
          template: 'treemap'
        })
      ] : [])
    ].filter(Boolean),

    // Base configuration
    base: isProduction ? 'https://cdn.sylos.io' : isStaging ? 'https://staging-cdn.sylos.io' : '/',
    publicDir: 'public',
    root: '.',

    // Advanced build configuration
    build: {
      // Target modern browsers with fallbacks
      target: isProduction ? [
        'es2015',
        'chrome80',
        'firefox78',
        'safari14',
        'edge80',
        'ios14'
      ] : 'esnext',

      // Minification options
      minify: isProduction ? {
        esbuild: {
          drop: isProduction ? ['console', 'debugger'] : [],
          legalComments: 'none',
          asciiOnly: true,
          dropLabels: isProduction ? ['DEBUG'] : []
        }
      } : false,

      // Source maps for debugging
      sourcemap: {
        level: isProduction ? 3 : 4,
        all: !isProduction,
        inlineSources: !isProduction,
        hideFrameworks: isProduction,
        maxWorkers: 4
      },

      // CSS optimization
      cssCodeSplit: true,
      cssMinify: isProduction,
      experimentalMinifyGlobalCss: isProduction,

      // Asset optimization
      assetsInlineLimit: isProduction ? 4096 : 0, // Inline small assets
      reportCompressedSize: isProduction,
      chunkSizeWarningLimit: isProduction ? 1000 : 5000,

      // Rollup configuration
      rollupOptions: {
        // External dependencies for smaller bundles
        external: (id) => {
          // Keep heavy libraries external for CDN loading
          const heavyLibraries = [
            'react', 'react-dom', 'react-router-dom',
            'ethers', '@rainbow-me/rainbowkit', 'wagmi', 'viem',
            'lodash-es', 'date-fns'
          ]
          return heavyLibraries.some(lib => id.includes(lib))
        },

        output: {
          // Advanced chunk splitting
          manualChunks: (id) => {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            // Blockchain libraries
            if (id.includes('ethers') || id.includes('@rainbow-me') || id.includes('wagmi') || id.includes('viem')) {
              return 'blockchain-vendor'
            }
            // UI libraries
            if (id.includes('lucide-react') || id.includes('tailwind')) {
              return 'ui-vendor'
            }
            // Utility libraries
            if (id.includes('date-fns') || id.includes('lodash')) {
              return 'utils-vendor'
            }
            // Query libraries
            if (id.includes('@tanstack') || id.includes('zustand')) {
              return 'query-vendor'
            }
            // Large dependencies
            if (id.includes('chart') || id.includes('d3')) {
              return 'charts-vendor'
            }
          },

          // Advanced asset naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.')
            const ext = info?.[info.length - 1]

            if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(assetInfo.name || '')) {
              return `assets/images/[name]-[hash][extname]`
            }
            if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
              return `assets/fonts/[name]-[hash][extname]`
            }
            if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i.test(assetInfo.name || '')) {
              return `assets/media/[name]-[hash][extname]`
            }
            if (/\.(pdf|doc|txt)$/i.test(assetInfo.name || '')) {
              return `assets/docs/[name]-[hash][extname]`
            }
            return `assets/[name]-[hash][extname]`
          },

          // Chunk naming with hashes
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',

          // Improve caching
          format: 'es',
          sourcemap: !isProduction
        }
      },

      // Security optimizations
      ...(isProduction && {
        // Remove console statements and debuggers
        minify: 'esbuild',
        // Drop debugger statements
        dropDebugger: true,
        // Optimize for tree shaking
        sourcemap: false
      }),

      // Clear dist directory
      emptyOutDir: true
    },

    // Development server
    server: {
      port: isProduction ? 3000 : 5173,
      host: true,
      https: isStaging || isProduction,
      cors: true,
      // HMR configuration
      hmr: {
        overlay: isDevelopment,
        port: 24678
      },
      // Open browser in development
      open: isDevelopment,
      // Proxy configuration
      proxy: getProxyConfig()
    },

    // Preview server for production builds
    preview: {
      port: 4173,
      host: true,
      https: isProduction,
      cors: true,
      headers: isProduction ? getSecurityHeaders() : {}
    },

    // Dependency optimization
    optimizeDeps: {
      include: [
        'react', 'react-dom', 'react-router-dom',
        'ethers', '@rainbow-me/rainbowkit', 'wagmi', 'viem',
        'lucide-react', '@supabase/supabase-js',
        '@tanstack/react-query', '@tanstack/react-query-devtools',
        'date-fns', 'lodash-es', 'clsx', 'tailwind-merge'
      ],
      // Pre-bundle for development
      force: !isProduction,
      // Exclude problematic dependencies
      exclude: [
        'fsevents', // macOS only
        'node-hid'  // Native modules
      ]
    },

    // Environment variables
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __ENV__: JSON.stringify(mode),
      __DEV__: isDevelopment,
      __PROD__: isProduction,
      __STAGING__: isStaging,
      __ENABLE_DEBUGGING__: env.features.enableDebugging,
      __ENABLE_ANALYTICS__: env.features.enableAnalytics,
      __ENABLE_ERROR_REPORTING__: env.features.enableErrorReporting
    },

    // CSS configuration
    css: {
      // CSS modules
      modules: {
        localsConvention: 'camelCase',
        exportGlobals: true
      },
      // Preprocessor options
      preprocessorOptions: {
        scss: {
          additionalData: `
            $env: ${mode};
            $is-production: ${isProduction};
            $is-staging: ${isStaging};
            $is-development: ${isDevelopment};
          `
        },
        less: {
          javascriptEnabled: true
        }
      },
      // Dev CSS sourcemap
      devSourcemap: isDevelopment,
      // Extract CSS in production
      extract: isProduction
    },

    // JSON configuration
    json: {
      namedExports: true,
      stringify: false
    },

    // Worker configuration
    worker: {
      format: 'es',
      plugins: []
    },

    // WebAssembly configuration
    wasm: {
      async: true
    },

    // Experimental features
    experimental: {
      renderBuiltUrl(filename, { hostType }) {
        if (hostType === 'js') {
          return { relative: true }
        } else {
          return { absolute: true }
        }
      }
    }
  }
})

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

function getProxyConfig() {
  if (process.env.NODE_ENV !== 'development') return {}

  return {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      secure: false
    },
    '/socket.io': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true
    }
  }
}

function getSecurityHeaders() {
  return {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
}

function getEnvironmentSpecificData(env: any) {
  return {
    networkName: env.networkName,
    chainId: env.chainId,
    explorerUrl: env.explorerUrl,
    apiUrl: env.apiUrl,
    wsUrl: env.wsUrl,
    supabaseUrl: env.supabaseUrl
  }
}
