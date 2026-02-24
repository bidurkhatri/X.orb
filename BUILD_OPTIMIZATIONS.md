# Production-Grade Build Optimization System

## Table of Contents
1. [Overview](#overview)
2. [Advanced Vite Configurations](#advanced-vite-configurations)
3. [Webpack Optimizations](#webpack-optimizations)
4. [Minification and Compression](#minification-and-compression)
5. [Source Maps for Production](#source-maps-for-production)
6. [Build Size Analysis and Reporting](#build-size-analysis-and-reporting)
7. [Automated Build Validation](#automated-build-validation)
8. [CI/CD Build Optimizations](#cicd-build-optimizations)
9. [Docker Containerization](#docker-containerization)
10. [Environment-Specific Builds](#environment-specific-builds)

## Overview

This document outlines the comprehensive production-grade build optimization system for the SylOS ecosystem, designed to ensure optimal performance, security, and deployment efficiency across all projects.

## Advanced Vite Configurations

### 1. Base Production Vite Configuration (`vite.config.production.ts`)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { createHtmlPlugin } from 'vite-plugin-html'
import { splitVendorChunkPlugin } from 'vite'
import { getSecurityHeaders } from './src/utils/environment'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isStaging = mode === 'staging'
  const isDevelopment = mode === 'development'

  // Base URLs for different environments
  const baseUrl = getBaseUrl(isProduction, isStaging)

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
            title: getAppTitle(),
            description: getAppDescription(),
            csp: isProduction ? generateStrictCSP() : generateStagingCSP(),
            preload: isProduction,
            ...getEnvironmentSpecificData()
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
    base: baseUrl,
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
        level: isProduction ? 'hidden' : true,
        inlineSources: isDevelopment,
        all: isDevelopment
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

    // Development server configuration
    server: {
      port: isProduction ? 3000 : 5173,
      host: true,
      https: isStaging || isProduction,
      cors: true,
      // Security headers
      headers: !isProduction ? getSecurityHeaders() : {},
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
      __STAGING__: isStaging
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

function getBaseUrl(isProduction: boolean, isStaging: boolean): string {
  if (isProduction) return 'https://cdn.sylos.io'
  if (isStaging) return 'https://staging-cdn.sylos.io'
  return '/'
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
```

### 2. Advanced Vite Configuration for Web (`vite.config.web.ts`)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [
      react(),
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: 'SylOS Web Application',
            viewport: 'width=device-width, initial-scale=1.0'
          }
        }
      }),
      // Web-specific visualizer
      ...(isProduction ? [
        visualizer({
          filename: 'dist/web-stats.html',
          template: 'sunburst',
          gzipSize: true,
          brotliSize: true
        })
      ] : [])
    ],

    build: {
      // Web-specific build settings
      target: isProduction ? ['es2015', 'chrome70', 'firefox63', 'safari12'] : 'esnext',
      sourcemap: !isProduction,
      
      rollupOptions: {
        output: {
          manualChunks: {
            'core-web': ['react', 'react-dom'],
            'ui-framework': ['@chakra-ui/react', '@emotion/react'],
            'web3': ['ethers', 'web3'],
            'routing': ['react-router-dom', 'react-router']
          }
        }
      }
    },

    // Web-specific optimizations
    define: {
      __IS_WEB__: true,
      __IS_MOBILE__: false,
      __IS_DESKTOP__: false
    }
  }
})
```

## Webpack Optimizations

### 1. Advanced Webpack Configuration (`webpack.config.js`)

```javascript
const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const CompressionPlugin = require('compression-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production'
  const isStaging = process.env.NODE_ENV === 'staging'
  
  return {
    // Entry configuration
    entry: {
      main: path.resolve(__dirname, 'src/index.tsx'),
      polyfills: path.resolve(__dirname, 'src/polyfills.ts')
    },

    // Output configuration
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
      assetModuleFilename: 'assets/[name].[contenthash][ext]',
      clean: true,
      publicPath: '/'
    },

    // Module resolution
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@assets': path.resolve(__dirname, 'src/assets')
      }
    },

    // Module rules
    module: {
      rules: [
        // TypeScript
        {
          test: /\.(ts|tsx)$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: !isProduction,
                configFile: path.resolve(__dirname, 'tsconfig.json')
              }
            }
          ],
          exclude: /node_modules/
        },

        // JavaScript
        {
          test: /\.(js|jsx)$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: isProduction ? {
                    browsers: ['> 1%', 'last 2 versions', 'ie >= 11']
                  } : { node: 'current' }
                }],
                '@babel/preset-react'
              ],
              plugins: isProduction ? [
                'transform-remove-console',
                '@babel/plugin-transform-react-constant-elements',
                'transform-react-remove-prop-types',
                ['transform-remove-debugger', { exclude: ['error', 'warn'] }]
              ] : []
            }
          },
          exclude: /node_modules/
        },

        // CSS
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                importLoaders: 2,
                sourceMap: !isProduction
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    require('postcss-preset-env')(),
                    require('autoprefixer')(),
                    ...(isProduction ? [require('cssnano')()] : [])
                  ]
                },
                sourceMap: !isProduction
              }
            }
          ]
        },

        // SCSS
        {
          test: /\.s[ac]ss$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                importLoaders: 2,
                sourceMap: !isProduction
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    require('postcss-preset-env')(),
                    require('autoprefixer')()
                  ]
                }
              }
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: !isProduction,
                additionalData: `
                  $env: ${process.env.NODE_ENV};
                  $is-production: ${isProduction};
                `
              }
            }
          ]
        },

        // Assets
        {
          test: /\.(png|jpg|jpeg|gif|webp|avif)$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8192 // 8kb
            }
          }
        },

        // Fonts
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[contenthash][ext]'
          }
        },

        // Media
        {
          test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/,
          type: 'asset/resource',
          generator: {
            filename: 'media/[name].[contenthash][ext]'
          }
        }
      ]
    },

    // Optimization configuration
    optimization: {
      // Module concatenation (scope hoisting)
      concatenateModules: isProduction,
      
      // Remove empty chunks
      removeEmptyChunks: true,
      
      // Merge duplicate chunks
      mergeDuplicateChunks: true,
      
      // Runtime chunks
      runtimeChunk: {
        name: 'runtime'
      },
      
      // Split chunks
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // React core
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 30
          },
          
          // Web3 libraries
          web3: {
            test: /[\\/]node_modules[\\/](ethers|web3|@web3-react|rainbowkit)[\\/]/,
            name: 'web3',
            chunks: 'all',
            priority: 25
          },
          
          // UI libraries
          ui: {
            test: /[\\/]node_modules[\\/](@chakra-ui|@emotion|material-ui|lucide-react)[\\/]/,
            name: 'ui',
            chunks: 'all',
            priority: 20
          },
          
          // Utilities
          utils: {
            test: /[\\/]node_modules[\\/](lodash|ramda|date-fns|moment)[\\/]/,
            name: 'utils',
            chunks: 'all',
            priority: 15
          },
          
          // Query libraries
          query: {
            test: /[\\/]node_modules[\\/](@tanstack|react-query|swr)[\\/]/,
            name: 'query',
            chunks: 'all',
            priority: 10
          }
        }
      },
      
      // Minification
      minimize: isProduction,
      minimizer: [
        // JavaScript minification
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: isProduction,
              drop_debugger: isProduction,
              pure_funcs: isProduction ? ['console.log', 'console.info'] : [],
              passes: 2,
              dead_code: true,
              drop_unused: true,
              keep_fargs: false,
              keep_fnames: false,
              booleans_as_integers: true,
              unsafe: true,
              unsafe_comps: true,
              unsafe_math: true,
              unsafe_methods: true,
              pure_getters: true,
              conditionals: true,
              comparisons: true,
              evaluate: true,
              cascades: true,
              arrows: true,
              booleans: true,
              if_return: true,
              join_vars: true,
              loops: true,
              unused: true
            },
            mangle: {
              safari10: true
            },
            format: {
              ecma: 2020,
              comments: false,
              ascii_only: true
            }
          },
          extractComments: false,
          parallel: true
        }),
        
        // CSS minification
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: ['default', {
              discardComments: {
                removeAll: true
              }
            }]
          }
        })
      ]
    },

    // Plugins
    plugins: [
      // Clean dist directory
      new CleanWebpackPlugin(),
      
      // Extract CSS in production
      ...(isProduction ? [
        new MiniCssExtractPlugin({
          filename: '[name].[contenthash].css',
          chunkFilename: '[name].[contenthash].css'
        })
      ] : []),
      
      // HTML plugin
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        filename: 'index.html',
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
          minifyCSS: true,
          minifyJS: true,
          keepClosingSlash: true
        } : false,
        inject: true
      }),
      
      // Define plugin for environment variables
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
        __ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
        __PROD__: isProduction,
        __DEV__: !isProduction
      }),
      
      // Compression plugin
      ...(isProduction ? [
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8
        }),
        
        new CompressionPlugin({
          algorithm: 'brotliCompress',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8
        })
      ] : []),
      
      // Bundle analyzer (staging only)
      ...(isStaging ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html'
        })
      ] : [])
    ].filter(Boolean),

    // Performance hints
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 2500000,
      maxAssetSize: 2500000
    },

    // Source maps
    devtool: isProduction ? 'hidden-source-map' : 'eval-source-map',

    // Stats configuration
    stats: isProduction ? 'normal' : {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false,
      reasons: true,
      usedExports: true,
      providedExports: true,
      optimizationBailout: true,
      errorDetails: true,
      publicPath: true
    }
  }
}
```

### 2. Development Webpack Configuration (`webpack.config.dev.js`)

```javascript
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { HotModuleReplacementPlugin } = require('webpack')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

module.exports = {
  mode: 'development',
  devtool: 'eval-source-map',
  
  entry: {
    main: [
      path.resolve(__dirname, 'src/index.tsx'),
      'webpack-hot-middleware/client?reload=true'
    ]
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '/'
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      filename: 'index.html'
    }),
    new HotModuleReplacementPlugin(),
    new ReactRefreshWebpackPlugin()
  ],
  
  // Enhanced development optimizations
  optimization: {
    namedModules: true,
    namedChunks: true,
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 30
        }
      }
    }
  }
}
```

## Minification and Compression

### 1. Advanced Build Script with Multiple Optimization Layers (`scripts/build-optimized.js`)

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const { gzip, brotliCompress } = require('zlib')
const imagemin = require('imagemin')
const imageminWebp = require('imagemin-webp')
const imageminMozjpeg = require('imagemin-mozjpeg')
const imageminPngquant = require('imagemin-pngquant')
const htmlMinifier = require('html-minifier')
const cleanCSS = require('clean-css')

const execAsync = promisify(exec)

class BuildOptimizer {
  constructor(options = {}) {
    this.options = {
      environment: options.environment || 'production',
      target: options.target || 'web',
      enableImageOptimization: options.enableImageOptimization !== false,
      enableCSSOptimization: options.enableCSSOptimization !== false,
      enableJSOptimization: options.enableJSOptimization !== false,
      enableHTMLOptimization: options.enableHTMLOptimization !== false,
      compressionLevel: options.compressionLevel || 6,
      imageQuality: options.imageQuality || 85,
      verbose: options.verbose || false
    }
    
    this.stats = {
      startTime: Date.now(),
      fileSizes: {},
      optimizations: []
    }
  }

  async optimize() {
    console.log('🚀 Starting build optimization...')
    
    try {
      // Step 1: Run build
      await this.runBuild()
      
      // Step 2: Analyze and optimize
      const distPath = path.resolve('dist')
      
      if (!fs.existsSync(distPath)) {
        throw new Error('Dist directory not found after build')
      }
      
      // Step 3: Optimize different file types
      if (this.options.enableImageOptimization) {
        await this.optimizeImages()
      }
      
      if (this.options.enableCSSOptimization) {
        await this.optimizeCSS()
      }
      
      if (this.options.enableHTMLOptimization) {
        await this.optimizeHTML()
      }
      
      // Step 4: Generate compression files
      await this.generateCompressedFiles()
      
      // Step 5: Create report
      const report = await this.generateReport()
      
      // Step 6: Output results
      this.outputResults(report)
      
    } catch (error) {
      console.error('❌ Build optimization failed:', error)
      process.exit(1)
    }
  }

  async runBuild() {
    console.log('📦 Running build...')
    
    const startTime = Date.now()
    await execAsync('pnpm run build')
    const buildTime = Date.now() - startTime
    
    this.log('Build completed in', (buildTime / 1000).toFixed(2), 'seconds')
  }

  async optimizeImages() {
    console.log('🖼️  Optimizing images...')
    
    const imagesPath = path.resolve('dist/assets/images')
    if (!fs.existsSync(imagesPath)) {
      return
    }
    
    try {
      const files = await imagemin([`${imagesPath}/*.{jpg,png,webp}`], {
        destination: imagesPath,
        plugins: [
          imageminWebp({
            quality: this.options.imageQuality,
            method: 6
          }),
          imageminMozjpeg({
            quality: this.options.imageQuality,
            progressive: true
          }),
          imageminPngquant({
            quality: [0.6, 0.8],
            speed: 4
          })
        ]
      })
      
      this.log('Optimized', files.length, 'image files')
      this.stats.optimizations.push({
        type: 'image',
        count: files.length,
        description: 'Image optimization (WebP, JPEG, PNG)'
      })
      
    } catch (error) {
      this.log('Image optimization failed:', error.message)
    }
  }

  async optimizeCSS() {
    console.log('🎨 Optimizing CSS...')
    
    const cssFiles = this.getFilesByExtension('dist', '.css')
    let optimizedCount = 0
    let totalSavings = 0
    
    for (const file of cssFiles) {
      try {
        const originalContent = fs.readFileSync(file, 'utf8')
        const originalSize = Buffer.byteLength(originalContent, 'utf8')
        
        // Minify CSS
        const minified = new cleanCSS({
          level: 2,
          returnPromise: true
        }).minify(originalContent)
        
        if (minified.styles) {
          fs.writeFileSync(file, minified.styles)
          const newSize = Buffer.byteLength(minified.styles, 'utf8')
          const savings = originalSize - newSize
          
          optimizedCount++
          totalSavings += savings
          
          this.log(`Optimized CSS: ${path.basename(file)} (${(savings / 1024).toFixed(2)}KB saved)`)
        }
        
      } catch (error) {
        this.log(`CSS optimization failed for ${file}:`, error.message)
      }
    }
    
    this.stats.optimizations.push({
      type: 'css',
      count: optimizedCount,
      description: 'CSS minification and optimization',
      savings: totalSavings
    })
  }

  async optimizeHTML() {
    console.log('📄 Optimizing HTML...')
    
    const htmlFiles = this.getFilesByExtension('dist', '.html')
    let optimizedCount = 0
    let totalSavings = 0
    
    for (const file of htmlFiles) {
      try {
        const originalContent = fs.readFileSync(file, 'utf8')
        const originalSize = Buffer.byteLength(originalContent, 'utf8')
        
        // Minify HTML
        const minified = htmlMinifier.minify(originalContent, {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          useShortDoctype: true,
          minifyCSS: true,
          minifyJS: true,
          keepClosingSlash: true
        })
        
        fs.writeFileSync(file, minified)
        const newSize = Buffer.byteLength(minified, 'utf8')
        const savings = originalSize - newSize
        
        optimizedCount++
        totalSavings += savings
        
        this.log(`Optimized HTML: ${path.basename(file)} (${(savings / 1024).toFixed(2)}KB saved)`)
        
      } catch (error) {
        this.log(`HTML optimization failed for ${file}:`, error.message)
      }
    }
    
    this.stats.optimizations.push({
      type: 'html',
      count: optimizedCount,
      description: 'HTML minification',
      savings: totalSavings
    })
  }

  async generateCompressedFiles() {
    console.log('🗜️  Generating compressed files...')
    
    const distPath = path.resolve('dist')
    const compressionTasks = []
    
    // JavaScript files
    for (const file of this.getFilesByExtension('dist', '.js')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // CSS files
    for (const file of this.getFilesByExtension('dist', '.css')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // HTML files
    for (const file of this.getFilesByExtension('dist', '.html')) {
      compressionTasks.push(this.createCompressedFile(file, 'gzip'))
      compressionTasks.push(this.createCompressedFile(file, 'brotli'))
    }
    
    // Execute all compression tasks
    const results = await Promise.all(compressionTasks)
    const successful = results.filter(r => r.success)
    
    this.log('Generated', successful.length, 'compressed files')
    this.stats.optimizations.push({
      type: 'compression',
      count: successful.length,
      description: 'Gzip and Brotli compression'
    })
  }

  async createCompressedFile(filePath, algorithm) {
    try {
      const content = fs.readFileSync(filePath)
      const compressed = await new Promise((resolve, reject) => {
        if (algorithm === 'gzip') {
          gzip(content, { level: this.options.compressionLevel }, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        } else {
          brotliCompress(content, {
            params: {
              [require('zlib').constants.BROTLI_PARAM_QUALITY]: this.options.compressionLevel
            }
          }, (err, result) => {
            if (err) reject(err)
            else resolve(result)
          })
        }
      })
      
      const extension = algorithm === 'gzip' ? '.gz' : '.br'
      const compressedPath = filePath + extension
      fs.writeFileSync(compressedPath, compressed)
      
      return { success: true, file: compressedPath, algorithm }
    } catch (error) {
      this.log(`Compression failed for ${filePath}:`, error.message)
      return { success: false, file: filePath, algorithm, error: error.message }
    }
  }

  async generateReport() {
    console.log('📊 Generating optimization report...')
    
    const distPath = path.resolve('dist')
    const report = {
      timestamp: new Date().toISOString(),
      environment: this.options.environment,
      target: this.options.target,
      buildTime: Date.now() - this.stats.startTime,
      fileSizes: this.getFileSizes(),
      optimizations: this.stats.optimizations,
      totalFiles: 0,
      totalSize: 0
    }
    
    // Calculate totals
    for (const [category, files] of Object.entries(report.fileSizes)) {
      report.totalFiles += files.length
      report.totalSize += files.reduce((sum, file) => sum + file.size, 0)
    }
    
    // Save report
    fs.writeFileSync(
      path.resolve('dist/build-report.json'),
      JSON.stringify(report, null, 2)
    )
    
    return report
  }

  getFileSizes() {
    const distPath = path.resolve('dist')
    const fileSizes = {
      javascript: [],
      stylesheet: [],
      images: [],
      fonts: [],
      media: [],
      other: []
    }
    
    const walk = (dir) => {
      const files = fs.readdirSync(dir)
      
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isDirectory()) {
          walk(filePath)
        } else {
          const size = stat.size
          const ext = path.extname(file).toLowerCase()
          
          let category = 'other'
          if (ext.match(/\.(js|mjs)$/)) category = 'javascript'
          else if (ext.match(/\.(css|scss|sass)$/)) category = 'stylesheet'
          else if (ext.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/)) category = 'images'
          else if (ext.match(/\.(woff|woff2|eot|ttf|otf)$/)) category = 'fonts'
          else if (ext.match(/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/)) category = 'media'
          
          fileSizes[category].push({
            name: path.relative(distPath, filePath),
            size,
            sizeFormatted: this.formatBytes(size)
          })
        }
      }
    }
    
    if (fs.existsSync(distPath)) {
      walk(distPath)
    }
    
    return fileSizes
  }

  getFilesByExtension(dir, extension) {
    const files = []
    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath)
        }
      }
    }
    
    walk(dir)
    return files
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  outputResults(report) {
    console.log('\n📈 Build Optimization Results')
    console.log('=' .repeat(50))
    console.log(`Build Time: ${(report.buildTime / 1000).toFixed(2)}s`)
    console.log(`Total Files: ${report.totalFiles}`)
    console.log(`Total Size: ${this.formatBytes(report.totalSize)}`)
    console.log('\nFile Breakdown:')
    
    for (const [category, files] of Object.entries(this.getFileSizes())) {
      if (files.length > 0) {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0)
        console.log(`  ${category}: ${files.length} files, ${this.formatBytes(totalSize)}`)
      }
    }
    
    console.log('\nOptimizations Applied:')
    for (const opt of report.optimizations) {
      if (opt.savings) {
        console.log(`  ✓ ${opt.description}: ${this.formatBytes(opt.savings)} saved`)
      } else {
        console.log(`  ✓ ${opt.description}: ${opt.count} files processed`)
      }
    }
    
    console.log('\n📋 Report saved to: dist/build-report.json')
  }

  log(...args) {
    if (this.options.verbose) {
      console.log(...args)
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const options = {
    environment: args.includes('--staging') ? 'staging' : 'production',
    target: args.includes('--mobile') ? 'mobile' : 'web',
    enableImageOptimization: !args.includes('--no-images'),
    enableCSSOptimization: !args.includes('--no-css'),
    enableJSOptimization: !args.includes('--no-js'),
    enableHTMLOptimization: !args.includes('--no-html'),
    compressionLevel: parseInt(args.find(arg => arg.startsWith('--level='))?.split('=')[1] || '6'),
    imageQuality: parseInt(args.find(arg => arg.startsWith('--quality='))?.split('=')[1] || '85'),
    verbose: args.includes('--verbose')
  }
  
  const optimizer = new BuildOptimizer(options)
  optimizer.optimize()
}

module.exports = BuildOptimizer
```

### 2. NPM Scripts for Different Build Types (`package.json`)

```json
{
  "scripts": {
    "build": "vite build",
    "build:optimized": "node scripts/build-optimized.js",
    "build:production": "node scripts/build-optimized.js --environment=production",
    "build:staging": "node scripts/build-optimized.js --environment=staging --verbose",
    "build:mobile": "node scripts/build-optimized.js --mobile --quality=80",
    "build:analyze": "npm run build && npx vite-bundle-analyzer dist",
    "build:stats": "npm run build && npx webpack-bundle-analyzer dist/assets/*.js",
    "build:dev": "vite build --mode development",
    "build:watch": "vite build --watch",
    "build:sourcemap": "vite build --sourcemap",
    "clean": "rimraf dist node_modules/.cache",
    "prebuild": "npm run clean",
    "postbuild": "node scripts/generate-service-worker.js"
  }
}
```

## Source Maps for Production

### 1. Advanced Source Map Configuration (`src/utils/sourceMaps.ts`)

```typescript
interface SourceMapConfig {
  enabled: boolean
  type: 'inline' | 'hidden' | 'eval' | 'cheap' | 'module'
  level: number
  publicPath?: string
  excludeExternal?: boolean
}

class SourceMapManager {
  private config: SourceMapConfig

  constructor(config: SourceMapConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      type: config.type ?? 'hidden',
      level: config.level ?? 1,
      publicPath: config.publicPath ?? '/maps/',
      excludeExternal: config.excludeExternal ?? true
    }
  }

  generateSourceMapConfig(environment: 'development' | 'production' | 'staging') {
    const { type, level, publicPath, excludeExternal } = this.config
    
    if (environment === 'development') {
      return {
        devtool: 'eval-source-map',
        sourceMap: {
          filename: '[file].map',
          publicPath,
          exclude: excludeExternal ? '/node_modules/' : undefined
        }
      }
    }
    
    if (environment === 'staging') {
      return {
        devtool: 'inline-source-map',
        sourceMap: {
          filename: '[file].map',
          publicPath,
          include: ['**/*.js', '**/*.ts', '**/*.tsx', '**/*.jsx']
        }
      }
    }
    
    // Production
    return {
      devtool: 'hidden-source-map',
      sourceMap: {
        filename: '[file].map',
        publicPath,
        exclude: excludeExternal ? '/node_modules/' : undefined
      }
    }
  }

  configureViteSourceMaps(isProduction: boolean) {
    return {
      sourcemap: {
        level: isProduction ? 3 : 4,
        all: !isProduction,
        inlineSources: !isProduction,
        hideFrameworks: isProduction,
        maxWorkers: 4
      },
      build: {
        sourcemap: !isProduction,
        rollupOptions: {
          sourcemap: !isProduction
        }
      }
    }
  }

  uploadSourceMapsToService() {
    // Implementation for uploading source maps to error tracking service
    // (e.g., Sentry, Bugsnag, Rollbar)
  }

  generateSourceMapIndex(files: string[]) {
    const index = files.map(file => ({
      name: file,
      map: `${file}.map`
    }))
    
    return {
      version: 3,
      sources: index,
      mappings: 'AAAA'
    }
  }
}

export default SourceMapManager
```

### 2. Build-time Source Map Generation (`scripts/generate-sourcemaps.js`)

```javascript
const fs = require('fs')
const path = require('path')
const { SourceMapConsumer, SourceMapGenerator } = require('source-map')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

class SourceMapGenerator {
  constructor() {
    this.sourceMapDir = path.resolve('dist/.sourcemaps')
    this.publicPath = '/maps/'
  }

  async generateSourceMaps() {
    console.log('🔍 Generating source maps...')
    
    // Create source map directory
    if (!fs.existsSync(this.sourceMapDir)) {
      fs.mkdirSync(this.sourceMapDir, { recursive: true })
    }

    // Process all JavaScript files
    const jsFiles = this.getFilesByExtension('dist', '.js').filter(file => !file.includes('vendor'))
    
    for (const file of jsFiles) {
      await this.processSourceMap(file)
    }

    // Create source map index
    await this.createSourceMapIndex()
    
    console.log('✅ Source maps generated successfully')
  }

  async processSourceMap(file) {
    try {
      // Generate source map for the file
      const mapPath = `${file}.map`
      const publicMapPath = path.join(this.publicPath, path.basename(mapPath))
      
      // Copy source map to public directory
      if (fs.existsSync(mapPath)) {
        const destPath = path.join(this.sourceMapDir, path.basename(mapPath))
        fs.copyFileSync(mapPath, destPath)
        
        // Update source map with public URL
        const mapContent = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
        mapContent.sourceRoot = publicMapPath
        fs.writeFileSync(destPath, JSON.stringify(mapContent, null, 2))
      }
    } catch (error) {
      console.error(`Source map generation failed for ${file}:`, error.message)
    }
  }

  async createSourceMapIndex() {
    const mapFiles = this.getFilesByExtension(this.sourceMapDir, '.map')
    const index = {
      version: 3,
      sources: mapFiles.map(file => path.basename(file)),
      mappings: 'AAAA'
    }
    
    fs.writeFileSync(
      path.join(this.sourceMapDir, 'index.json'),
      JSON.stringify(index, null, 2)
    )
  }

  getFilesByExtension(dir, extension) {
    const files = []
    const walk = (currentPath) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath)
        }
      }
    }
    
    if (fs.existsSync(dir)) {
      walk(dir)
    }
    
    return files
  }
}

// Run if called directly
if (require.main === module) {
  const generator = new SourceMapGenerator()
  generator.generateSourceMaps()
}

module.exports = SourceMapGenerator
```

## Build Size Analysis and Reporting

### 1. Build Size Analyzer (`src/utils/buildAnalyzer.ts`)

```typescript
interface BuildReport {
  timestamp: string
  environment: string
  files: FileInfo[]
  chunks: ChunkInfo[]
  dependencies: DependencyInfo[]
  optimizations: OptimizationInfo[]
  totalSize: number
  gzippedSize: number
  brotliSize: number
  performance: PerformanceMetrics
}

interface FileInfo {
  name: string
  size: number
  gzippedSize: number
  brotliSize: number
  type: 'javascript' | 'css' | 'image' | 'font' | 'media' | 'other'
  path: string
}

interface ChunkInfo {
  name: string
  size: number
  files: string[]
  imports: string[]
  exports: string[]
}

interface DependencyInfo {
  name: string
  size: number
  version: string
  used: boolean
  treeShakable: boolean
}

interface OptimizationInfo {
  name: string
  impact: 'high' | 'medium' | 'low'
  savings: number
  description: string
  action: string
}

interface PerformanceMetrics {
  loadTime: number
  parseTime: number
  executionTime: number
  renderTime: number
  lighthouseScore: number
}

class BuildAnalyzer {
  private distPath: string
  private reports: BuildReport[] = []
  private thresholds = {
    largeBundle: 250 * 1024, // 250KB
    hugeBundle: 500 * 1024,  // 500KB
    totalSize: 1 * 1024 * 1024, // 1MB
    gzipTotal: 250 * 1024 // 250KB
  }

  constructor(distPath: string = 'dist') {
    this.distPath = distPath
  }

  async analyzeBuild(): Promise<BuildReport> {
    console.log('🔍 Analyzing build...')
    
    const files = await this.scanFiles()
    const chunks = await this.analyzeChunks()
    const dependencies = await this.analyzeDependencies()
    const optimizations = await this.generateOptimizations(files, chunks, dependencies)
    const performance = await this.measurePerformance()
    
    const report: BuildReport = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production',
      files,
      chunks,
      dependencies,
      optimizations,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      gzippedSize: files.reduce((sum, file) => sum + file.gzippedSize, 0),
      brotliSize: files.reduce((sum, file) => sum + file.brotliSize, 0),
      performance
    }

    this.reports.push(report)
    this.generateReport(report)
    
    return report
  }

  private async scanFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = []
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          const file = await this.analyzeFile(fullPath)
          if (file) files.push(file)
        }
      }
    }
    
    if (fs.existsSync(this.distPath)) {
      walk(this.distPath)
    }
    
    return files
  }

  private async analyzeFile(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = fs.statSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      
      let type: FileInfo['type'] = 'other'
      if (ext.match(/\.(js|mjs)$/)) type = 'javascript'
      else if (ext.match(/\.(css|scss|sass)$/)) type = 'css'
      else if (ext.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/)) type = 'image'
      else if (ext.match(/\.(woff|woff2|eot|ttf|otf)$/)) type = 'font'
      else if (ext.match(/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/)) type = 'media'
      else return null

      const [gzippedSize, brotliSize] = await Promise.all([
        this.compressFile(filePath, 'gzip'),
        this.compressFile(filePath, 'brotli')
      ])

      return {
        name: path.basename(filePath),
        size: stats.size,
        gzippedSize,
        brotliSize,
        type,
        path: filePath
      }
    } catch (error) {
      return null
    }
  }

  private async compressFile(filePath: string, algorithm: 'gzip' | 'brotli'): Promise<number> {
    try {
      const content = fs.readFileSync(filePath)
      
      if (algorithm === 'gzip') {
        const { gzip } = require('zlib')
        return new Promise((resolve) => {
          gzip(content, (err, compressed) => {
            if (err) resolve(content.length)
            else resolve(compressed.length)
          })
        })
      } else {
        const { brotliCompress } = require('zlib')
        return new Promise((resolve) => {
          brotliCompress(content, (err, compressed) => {
            if (err) resolve(content.length)
            else resolve(compressed.length)
          })
        })
      }
    } catch {
      return fs.statSync(filePath).size
    }
  }

  private async analyzeChunks(): Promise<ChunkInfo[]> {
    // Analyze webpack bundle or vite chunk files
    const chunkFiles = this.getFilesByType('javascript').filter(file => 
      file.name.includes('vendor') || file.name.includes('chunk')
    )
    
    return chunkFiles.map(chunk => ({
      name: chunk.name,
      size: chunk.size,
      files: [chunk.path],
      imports: this.extractImports(chunk.path),
      exports: this.extractExports(chunk.path)
    }))
  }

  private async analyzeDependencies(): Promise<DependencyInfo[]> {
    const packageJson = this.getPackageJson()
    const dependencies: DependencyInfo[] = []
    
    for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
      const packagePath = this.findPackagePath(name)
      const size = packagePath ? this.getPackageSize(packagePath) : 0
      
      dependencies.push({
        name,
        version,
        size,
        used: this.isDependencyUsed(name),
        treeShakable: this.isTreeShakable(name)
      })
    }
    
    return dependencies
  }

  private async generateOptimizations(
    files: FileInfo[], 
    chunks: ChunkInfo[], 
    dependencies: DependencyInfo[]
  ): Promise<OptimizationInfo[]> {
    const optimizations: OptimizationInfo[] = []
    
    // Large bundle warnings
    const largeFiles = files.filter(file => file.size > this.thresholds.largeBundle)
    if (largeFiles.length > 0) {
      optimizations.push({
        name: 'Large Bundle Optimization',
        impact: 'high',
        savings: largeFiles.reduce((sum, file) => sum + file.size, 0),
        description: `Found ${largeFiles.length} large bundle(s)`,
        action: 'Split large bundles and implement code splitting'
      })
    }
    
    // Unused dependencies
    const unusedDeps = dependencies.filter(dep => !dep.used)
    if (unusedDeps.length > 0) {
      optimizations.push({
        name: 'Remove Unused Dependencies',
        impact: 'high',
        savings: unusedDeps.reduce((sum, dep) => sum + dep.size, 0),
        description: `Found ${unusedDeps.length} unused dependencies`,
        action: 'Remove unused dependencies from package.json'
      })
    }
    
    // Non-tree-shakable dependencies
    const nonTreeShakable = dependencies.filter(dep => !dep.treeShakable && dep.used)
    if (nonTreeShakable.length > 0) {
      optimizations.push({
        name: 'Tree Shakeable Dependencies',
        impact: 'medium',
        savings: nonTreeShakable.reduce((sum, dep) => sum + dep.size, 0),
        description: `Found ${nonTreeShakable.length} non-tree-shakable dependencies`,
        action: 'Consider alternative tree-shakable packages'
      })
    }
    
    // Image optimization
    const largeImages = files.filter(file => 
      file.type === 'image' && file.size > 50 * 1024
    )
    if (largeImages.length > 0) {
      optimizations.push({
        name: 'Image Optimization',
        impact: 'medium',
        savings: largeImages.reduce((sum, file) => sum + file.size * 0.3, 0),
        description: `Found ${largeImages.length} large image(s)`,
        action: 'Compress images or use modern formats (WebP, AVIF)'
      })
    }
    
    return optimizations
  }

  private async measurePerformance(): Promise<PerformanceMetrics> {
    // This would typically run Lighthouse or similar performance testing
    return {
      loadTime: 0, // ms
      parseTime: 0, // ms
      executionTime: 0, // ms
      renderTime: 0, // ms
      lighthouseScore: 0 // 0-100
    }
  }

  private generateReport(report: BuildReport) {
    console.log('\n📊 Build Analysis Report')
    console.log('=' .repeat(50))
    console.log(`Total Size: ${this.formatBytes(report.totalSize)}`)
    console.log(`Gzipped Size: ${this.formatBytes(report.gzippedSize)}`)
    console.log(`Brotli Size: ${this.formatBytes(report.brotliSize)}`)
    
    // File type breakdown
    const typeBreakdown = report.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + file.size
      return acc
    }, {} as Record<string, number>)
    
    console.log('\nFile Type Breakdown:')
    Object.entries(typeBreakdown).forEach(([type, size]) => {
      console.log(`  ${type}: ${this.formatBytes(size)}`)
    })
    
    // Top files
    const topFiles = report.files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
    
    console.log('\nLargest Files:')
    topFiles.forEach(file => {
      const compression = ((1 - file.brotliSize / file.size) * 100).toFixed(1)
      console.log(`  ${file.name}: ${this.formatBytes(file.size)} (${compression}% smaller with Brotli)`)
    })
    
    // Optimizations
    if (report.optimizations.length > 0) {
      console.log('\nOptimizations Suggested:')
      report.optimizations.forEach(opt => {
        console.log(`  ${opt.impact.toUpperCase()}: ${opt.name}`)
        console.log(`    ${opt.description}`)
        console.log(`    Potential savings: ${this.formatBytes(opt.savings)}`)
        console.log(`    Action: ${opt.action}\n`)
      })
    }
    
    // Save detailed report
    const reportPath = path.join(this.distPath, 'build-analysis.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📋 Detailed report saved to: ${reportPath}`)
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private getFilesByType(type: FileInfo['type']): FileInfo[] {
    return this.reports[this.reports.length - 1]?.files.filter(file => file.type === type) || []
  }

  private extractImports(filePath: string): string[] {
    // Extract ES6 imports from file content
    const content = fs.readFileSync(filePath, 'utf8')
    const importRegex = /import.*from\s+['"]([^'"]+)['"]/g
    const imports = []
    let match
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }
    return imports
  }

  private extractExports(filePath: string): string[] {
    // Extract ES6 exports from file content
    const content = fs.readFileSync(filePath, 'utf8')
    const exportRegex = /export\s+(const|let|var|function|class)\s+(\w+)/g
    const exports = []
    let match
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[2])
    }
    return exports
  }

  private getPackageJson(): any {
    const packagePath = path.resolve('package.json')
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  }

  private findPackagePath(packageName: string): string | null {
    const nodeModulesPath = path.resolve('node_modules', packageName)
    return fs.existsSync(nodeModulesPath) ? nodeModulesPath : null
  }

  private getPackageSize(packagePath: string): number {
    let totalSize = 0
    
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (entry.isFile()) {
          totalSize += fs.statSync(fullPath).size
        }
      }
    }
    
    walk(packagePath)
    return totalSize
  }

  private isDependencyUsed(name: string): boolean {
    // Check if dependency is imported anywhere in the codebase
    return true // Simplified implementation
  }

  private isTreeShakable(name: string): boolean {
    // Check if package is tree-shakable (ES6 module)
    const packagePath = this.findPackagePath(name)
    if (!packagePath) return false
    
    const packageJsonPath = path.join(packagePath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) return false
    
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return !!pkg.module || !!pkg['jsnext:main'] || !!pkg['jsnext']
  }
}

export default BuildAnalyzer
```

### 2. Interactive Build Report Viewer (`scripts/build-report-viewer.js`)

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const http = require('http')
const { createInterface } = require('readline')

class BuildReportViewer {
  constructor() {
    this.port = 3001
    this.server = null
  }

  start() {
    const reportPath = path.resolve('dist/build-analysis.json')
    
    if (!fs.existsSync(reportPath)) {
      console.error('Build report not found. Run build analysis first.')
      process.exit(1)
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    
    console.log('🚀 Starting Build Report Viewer...')
    console.log(`📊 Report: ${report.timestamp}`)
    console.log(`🌍 Environment: ${report.environment}`)
    console.log(`📦 Total Files: ${report.files.length}`)
    console.log(`💾 Total Size: ${this.formatBytes(report.totalSize)}`)
    console.log(`🗜️  Gzipped Size: ${this.formatBytes(report.gzippedSize)}`)
    console.log(`💥 Brotli Size: ${this.formatBytes(report.brotliSize)}`)
    
    this.displayMenu(report)
  }

  displayMenu(report) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    })

    console.log('\n📋 Build Report Viewer')
    console.log('='.repeat(30))
    console.log('1. View file breakdown')
    console.log('2. View largest files')
    console.log('3. View optimization suggestions')
    console.log('4. View dependency analysis')
    console.log('5. View chunk analysis')
    console.log('6. Export report (JSON)')
    console.log('7. Export report (HTML)')
    console.log('8. Start web server')
    console.log('9. Exit')

    rl.question('\nSelect option: ', (answer) => {
      this.handleMenuOption(answer, report, rl)
    })
  }

  handleMenuOption(option, report, rl) {
    switch (option) {
      case '1':
        this.viewFileBreakdown(report)
        break
      case '2':
        this.viewLargestFiles(report)
        break
      case '3':
        this.viewOptimizations(report)
        break
      case '4':
        this.viewDependencies(report)
        break
      case '5':
        this.viewChunks(report)
        break
      case '6':
        this.exportJSON(report)
        break
      case '7':
        this.exportHTML(report)
        break
      case '8':
        this.startWebServer(report)
        rl.close()
        return
      case '9':
        rl.close()
        return
      default:
        console.log('Invalid option')
    }
    
    if (option !== '8' && option !== '9') {
      this.displayMenu(report)
    }
  }

  viewFileBreakdown(report) {
    const breakdown = report.files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1
      return acc
    }, {})

    console.log('\n📊 File Breakdown:')
    Object.entries(breakdown).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} files`)
    })
  }

  viewLargestFiles(report) {
    const largest = report.files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)

    console.log('\n📦 Largest Files:')
    largest.forEach((file, index) => {
      const reduction = ((1 - file.brotliSize / file.size) * 100).toFixed(1)
      console.log(`${index + 1}. ${file.name}`)
      console.log(`   Size: ${this.formatBytes(file.size)}`)
      console.log(`   Brotli: ${this.formatBytes(file.brotliSize)} (${reduction}% smaller)`)
      console.log(`   Type: ${file.type}\n`)
    })
  }

  viewOptimizations(report) {
    console.log('\n🔧 Optimization Suggestions:')
    report.optimizations.forEach((opt, index) => {
      console.log(`${index + 1}. ${opt.name} (${opt.impact} impact)`)
      console.log(`   ${opt.description}`)
      console.log(`   Potential savings: ${this.formatBytes(opt.savings)}`)
      console.log(`   Action: ${opt.action}\n`)
    })
  }

  viewDependencies(report) {
    console.log('\n📚 Dependency Analysis:')
    
    const unused = report.dependencies.filter(dep => !dep.used)
    const nonShakable = report.dependencies.filter(dep => !dep.treeShakable && dep.used)
    
    if (unused.length > 0) {
      console.log('\n🗑️  Unused Dependencies:')
      unused.forEach(dep => {
        console.log(`  - ${dep.name} (${this.formatBytes(dep.size)})`)
      })
    }
    
    if (nonShakable.length > 0) {
      console.log('\n⚠️  Non-Tree-Shakable Dependencies:')
      nonShakable.forEach(dep => {
        console.log(`  - ${dep.name} (${this.formatBytes(dep.size)})`)
      })
    }
  }

  viewChunks(report) {
    console.log('\n🧩 Chunk Analysis:')
    report.chunks.forEach((chunk, index) => {
      console.log(`${index + 1}. ${chunk.name} (${this.formatBytes(chunk.size)})`)
      if (chunk.files.length > 1) {
        console.log(`   Files: ${chunk.files.join(', ')}`)
      }
    })
  }

  exportJSON(report) {
    const exportPath = path.resolve('build-report-export.json')
    fs.writeFileSync(exportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Report exported to: ${exportPath}`)
  }

  exportHTML(report) {
    const html = this.generateHTMLReport(report)
    const exportPath = path.resolve('build-report.html')
    fs.writeFileSync(exportPath, html)
    console.log(`🌐 HTML report exported to: ${exportPath}`)
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Build Report - ${report.timestamp}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .optimization { margin: 10px 0; padding: 10px; border-left: 4px solid #007cba; background: #f9f9f9; }
        .file-list { max-height: 300px; overflow-y: auto; border: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Build Report</h1>
        <p><strong>Generated:</strong> ${report.timestamp}</p>
        <p><strong>Environment:</strong> ${report.environment}</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <h3>Total Size</h3>
            <p>${this.formatBytes(report.totalSize)}</p>
        </div>
        <div class="stat-card">
            <h3>Gzipped Size</h3>
            <p>${this.formatBytes(report.gzippedSize)}</p>
        </div>
        <div class="stat-card">
            <h3>Brotli Size</h3>
            <p>${this.formatBytes(report.brotliSize)}</p>
        </div>
        <div class="stat-card">
            <h3>Total Files</h3>
            <p>${report.files.length}</p>
        </div>
    </div>
    
    ${report.optimizations.length > 0 ? `
    <h2>Optimizations Suggested</h2>
    ${report.optimizations.map(opt => `
        <div class="optimization">
            <h3>${opt.name} (${opt.impact} impact)</h3>
            <p>${opt.description}</p>
            <p><strong>Potential savings:</strong> ${this.formatBytes(opt.savings)}</p>
            <p><strong>Action:</strong> ${opt.action}</p>
        </div>
    `).join('')}
    ` : ''}
    
    <h2>Largest Files</h2>
    <div class="file-list">
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Size</th>
                    <th>Gzipped</th>
                    <th>Brotli</th>
                    <th>Type</th>
                </tr>
            </thead>
            <tbody>
                ${report.files
                  .sort((a, b) => b.size - a.size)
                  .slice(0, 20)
                  .map(file => `
                    <tr>
                        <td>${file.name}</td>
                        <td>${this.formatBytes(file.size)}</td>
                        <td>${this.formatBytes(file.gzippedSize)}</td>
                        <td>${this.formatBytes(file.brotliSize)}</td>
                        <td>${file.type}</td>
                    </tr>
                  `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `
  }

  startWebServer(report) {
    const server = http.createServer((req, res) => {
      if (req.url === '/api/report') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(report))
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(this.generateHTMLReport(report))
      }
    })
    
    server.listen(this.port, () => {
      console.log(`🌐 Web server started at http://localhost:${this.port}`)
      console.log('Press Ctrl+C to stop the server')
    })
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Run if called directly
if (require.main === module) {
  const viewer = new BuildReportViewer()
  viewer.start()
}

module.exports = BuildReportViewer
```

## Automated Build Validation

### 1. Build Validation System (`src/utils/buildValidator.ts`)

```typescript
interface ValidationRule {
  name: string
  description: string
  check: () => Promise<ValidationResult>
  severity: 'error' | 'warning' | 'info'
  category: 'security' | 'performance' | 'accessibility' | 'compatibility' | 'seo'
}

interface ValidationResult {
  passed: boolean
  message: string
  details?: any
  suggestions?: string[]
}

class BuildValidator {
  private rules: ValidationRule[] = []
  private results: ValidationResult[] = []

  constructor() {
    this.initializeRules()
  }

  private initializeRules() {
    // Security rules
    this.rules.push({
      name: 'no-secrets',
      description: 'Ensure no secrets are included in the build',
      severity: 'error',
      category: 'security',
      check: async () => this.checkNoSecrets()
    })

    this.rules.push({
      name: 'csp-headers',
      description: 'Verify CSP headers are properly configured',
      severity: 'error',
      category: 'security',
      check: async () => this.checkCSPHeaders()
    })

    // Performance rules
    this.rules.push({
      name: 'bundle-size',
      description: 'Check bundle size limits',
      severity: 'warning',
      category: 'performance',
      check: async () => this.checkBundleSize()
    })

    this.rules.push({
      name: 'image-optimization',
      description: 'Verify images are optimized',
      severity: 'warning',
      category: 'performance',
      check: async () => this.checkImageOptimization()
    })

    this.rules.push({
      name: 'code-splitting',
      description: 'Ensure proper code splitting is implemented',
      severity: 'info',
      category: 'performance',
      check: async () => this.checkCodeSplitting()
    })

    // Accessibility rules
    this.rules.push({
      name: 'alt-texts',
      description: 'Verify all images have alt text',
      severity: 'warning',
      category: 'accessibility',
      check: async () => this.checkAltTexts()
    })

    this.rules.push({
      name: 'aria-labels',
      description: 'Verify ARIA labels are present',
      severity: 'info',
      category: 'accessibility',
      check: async () => this.checkAriaLabels()
    })

    // Compatibility rules
    this.rules.push({
      name: 'browser-compatibility',
      description: 'Check browser compatibility',
      severity: 'warning',
      category: 'compatibility',
      check: async () => this.checkBrowserCompatibility()
    })

    // SEO rules
    this.rules.push({
      name: 'meta-tags',
      description: 'Verify meta tags are present',
      severity: 'info',
      category: 'seo',
      check: async () => this.checkMetaTags()
    })

    this.rules.push({
      name: 'structured-data',
      description: 'Check for structured data',
      severity: 'info',
      category: 'seo',
      check: async () => this.checkStructuredData()
    })
  }

  async validate(): Promise<ValidationResult[]> {
    console.log('🔍 Running build validation...')
    
    this.results = []
    const runCount = Math.ceil(this.rules.length / 4) // Run in parallel groups of 4
    
    for (let i = 0; i < runCount; i++) {
      const ruleGroup = this.rules.slice(i * 4, (i + 1) * 4)
      const groupResults = await Promise.all(
        ruleGroup.map(rule => this.runRule(rule))
      )
      this.results.push(...groupResults)
    }
    
    this.generateReport()
    return this.results
  }

  private async runRule(rule: ValidationRule): Promise<ValidationResult> {
    try {
      console.log(`  ✓ ${rule.name}: ${rule.description}`)
      const result = await rule.check()
      return {
        ...result,
        message: `[${rule.name}] ${result.message}`
      }
    } catch (error) {
      return {
        passed: false,
        message: `[${rule.name}] Validation error: ${error.message}`,
        details: { error: error.message }
      }
    }
  }

  private async checkNoSecrets(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const distPath = path.resolve('dist')
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /pk_live_[a-zA-Z0-9]{24,}/g, // Stripe live keys
      /pk_test_[a-zA-Z0-9]{24,}/g, // Stripe test keys
      /xoxp-[0-9]+-[0-9]+-[0-9]+-[a-z0-9]+/g, // Slack tokens
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub tokens
      /https:\/\/[\w.-]+:[\w]+@/g, // URLs with credentials
      /password["']?\s*[:=]\s*["'][^"']{8,}["']/g, // Password assignments
      /api_key["']?\s*[:=]\s*["'][^"']{16,}["']/g, // API key assignments
    ]
    
    const walk = (dir: string): string[] => {
      const files: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...walk(fullPath))
        } else if (entry.isFile() && entry.name.match(/\.(js|css|html|json)$/)) {
          files.push(fullPath)
        }
      }
      
      return files
    }
    
    if (!fs.existsSync(distPath)) {
      return {
        passed: false,
        message: 'Build directory not found'
      }
    }
    
    const files = walk(distPath)
    let secretsFound = 0
    const secrets: string[] = []
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8')
        for (const pattern of secretPatterns) {
          const matches = content.match(pattern)
          if (matches) {
            secretsFound += matches.length
            secrets.push(...matches.map(match => `${file}: ${match.substring(0, 20)}...`))
          }
        }
      } catch (error) {
        // Ignore file read errors
      }
    }
    
    return {
      passed: secretsFound === 0,
      message: secretsFound === 0 
        ? 'No secrets found in build' 
        : `Found ${secretsFound} potential secrets in build files`,
      details: { secretsFound, files: secrets.slice(0, 10) },
      suggestions: secretsFound > 0 
        ? ['Remove secrets from source code', 'Use environment variables', 'Review and rotate affected keys']
        : undefined
    }
  }

  private async checkCSPHeaders(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const indexPath = path.resolve('dist/index.html')
    
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const cspMeta = content.match(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i)
    
    if (!cspMeta) {
      return {
        passed: false,
        message: 'Content Security Policy meta tag not found',
        suggestions: [
          'Add CSP meta tag to index.html',
          'Configure CSP headers in your web server',
          'Use strict CSP policies for production'
        ]
      }
    }
    
    const cspContent = cspMeta[0]
    const hasUnsafeInline = cspContent.includes("'unsafe-inline'")
    const hasUnsafeEval = cspContent.includes("'unsafe-eval'")
    const hasUnsafeDomains = cspContent.includes('http:') || cspContent.includes('https:')
    
    const warnings = []
    if (hasUnsafeInline) warnings.push('Contains \'unsafe-inline\'')
    if (hasUnsafeEval) warnings.push('Contains \'unsafe-eval\'')
    if (hasUnsafeDomains) warnings.push('Contains HTTP/HTTPS sources')
    
    return {
      passed: warnings.length === 0,
      message: warnings.length === 0 
        ? 'CSP properly configured' 
        : `CSP issues found: ${warnings.join(', ')}`,
      details: { cspMeta: cspContent, warnings },
      suggestions: warnings.length > 0 
        ? ['Remove \'unsafe-inline\' where possible', 'Avoid \'unsafe-eval\'', 'Use HTTPS only']
        : undefined
    }
  }

  private async checkBundleSize(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const reportPath = path.resolve('dist/build-analysis.json')
    if (!fs.existsSync(reportPath)) {
      return {
        passed: false,
        message: 'Build analysis report not found'
      }
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    const maxBundleSize = 250 * 1024 // 250KB
    const largeFiles = report.files.filter((file: any) => 
      file.type === 'javascript' && file.size > maxBundleSize
    )
    
    return {
      passed: largeFiles.length === 0,
      message: largeFiles.length === 0 
        ? 'All bundles within size limits' 
        : `${largeFiles.length} bundle(s) exceed size limit`,
      details: { largeFiles: largeFiles.map((f: any) => ({ name: f.name, size: f.size })) },
      suggestions: largeFiles.length > 0 
        ? ['Implement code splitting', 'Remove unused dependencies', 'Consider lazy loading']
        : undefined
    }
  }

  private async checkImageOptimization(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const distPath = path.resolve('dist')
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']
    const maxImageSize = 100 * 1024 // 100KB
    
    const walk = (dir: string): string[] => {
      const files: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...walk(fullPath))
        } else if (entry.isFile() && imageExtensions.includes(path.extname(entry.name).toLowerCase())) {
          files.push(fullPath)
        }
      }
      
      return files
    }
    
    if (!fs.existsSync(distPath)) {
      return {
        passed: false,
        message: 'Build directory not found'
      }
    }
    
    const images = walk(distPath)
    const unoptimized = images.filter(imgPath => {
      const stats = fs.statSync(imgPath)
      return stats.size > maxImageSize
    })
    
    return {
      passed: unoptimized.length === 0,
      message: unoptimized.length === 0 
        ? 'All images are optimized' 
        : `${unoptimized.length} image(s) could be optimized`,
      details: { unoptimized: unoptimized.slice(0, 5) },
      suggestions: unoptimized.length > 0 
        ? ['Compress images', 'Convert to WebP format', 'Use responsive images']
        : undefined
    }
  }

  private async checkCodeSplitting(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const distPath = path.resolve('dist')
    
    if (!fs.existsSync(distPath)) {
      return {
        passed: false,
        message: 'Build directory not found'
      }
    }
    
    const files = fs.readdirSync(distPath)
    const jsFiles = files.filter(file => file.endsWith('.js'))
    
    // Check if there are multiple JS files (indicating code splitting)
    const hasCodeSplitting = jsFiles.length > 3 // More than just main chunks
    
    return {
      passed: hasCodeSplitting,
      message: hasCodeSplitting 
        ? 'Code splitting appears to be implemented' 
        : 'No code splitting detected',
      details: { jsFilesCount: jsFiles.length },
      suggestions: !hasCodeSplitting 
        ? ['Implement dynamic imports', 'Split vendor bundles', 'Use route-based code splitting']
        : undefined
    }
  }

  private async checkAltTexts(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const indexPath = path.resolve('dist/index.html')
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const imgMatches = content.match(/<img[^>]*>/g) || []
    
    const imagesWithoutAlt = imgMatches.filter(img => !img.match(/alt\s*=/))
    const imagesWithEmptyAlt = imgMatches.filter(img => img.match(/alt\s*=\s*["']\s*["']/))
    
    const issues = imagesWithoutAlt.length + imagesWithEmptyAlt.length
    
    return {
      passed: issues === 0,
      message: issues === 0 
        ? 'All images have alt text' 
        : `${issues} image(s) missing or have empty alt text`,
      details: { 
        totalImages: imgMatches.length,
        missingAlt: imagesWithoutAlt.length,
        emptyAlt: imagesWithEmptyAlt.length
      },
      suggestions: issues > 0 
        ? ['Add descriptive alt text to all images', 'Use empty alt="" for decorative images']
        : undefined
    }
  }

  private async checkAriaLabels(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const indexPath = path.resolve('dist/index.html')
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const elementsRequiringAria = content.match(/<(button|input|select|textarea)[^>]*>/g) || []
    const withAriaLabel = content.match(/<(button|input|select|textarea)[^>]*aria-label\s*=/g) || []
    
    const coverage = elementsRequiringAria.length > 0 
      ? (withAriaLabel.length / elementsRequiringAria.length) * 100 
      : 100
    
    return {
      passed: coverage >= 90,
      message: `ARIA label coverage: ${coverage.toFixed(1)}%`,
      details: { 
        totalElements: elementsRequiringAria.length,
        withAriaLabel: withAriaLabel.length,
        coverage
      },
      suggestions: coverage < 90 
        ? ['Add ARIA labels to interactive elements', 'Use semantic HTML elements', 'Test with screen readers']
        : undefined
    }
  }

  private async checkBrowserCompatibility(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const babelConfig = path.resolve('.babelrc')
    const viteConfig = path.resolve('vite.config.ts')
    const webpackConfig = path.resolve('webpack.config.js')
    
    let configFound = false
    let browserslist = ''
    
    if (fs.existsSync(babelConfig)) {
      configFound = true
      // Parse babel config for browserslist
    } else if (fs.existsSync(viteConfig)) {
      configFound = true
      const viteConfigContent = fs.readFileSync(viteConfig, 'utf8')
      const targetMatch = viteConfigContent.match(/target:\s*\[([^\]]+)\]/)
      if (targetMatch) {
        browserslist = `ES2015, Chrome 80, Firefox 78, Safari 14`
      }
    } else if (fs.existsSync(webpackConfig)) {
      configFound = true
      // Parse webpack config for browserslist
    }
    
    return {
      passed: configFound,
      message: configFound 
        ? `Browser compatibility configured: ${browserslist || 'Default browserslist'}` 
        : 'No browser compatibility configuration found',
      suggestions: !configFound 
        ? ['Configure browserslist in package.json', 'Set target browsers in build config', 'Use polyfills for older browsers']
        : undefined
    }
  }

  private async checkMetaTags(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const indexPath = path.resolve('dist/index.html')
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const metaTags = content.match(/<meta[^>]*>/g) || []
    
    const requiredMeta = ['title', 'description', 'viewport']
    const hasTitle = content.includes('<title>')
    const hasDescription = content.includes('name="description"')
    const hasViewport = content.includes('name="viewport"')
    
    const missing = requiredMeta.filter(meta => {
      if (meta === 'title') return !hasTitle
      if (meta === 'description') return !hasDescription
      if (meta === 'viewport') return !hasViewport
      return false
    })
    
    return {
      passed: missing.length === 0,
      message: missing.length === 0 
        ? 'All required meta tags present' 
        : `Missing meta tags: ${missing.join(', ')}`,
      details: { metaTags: metaTags.length, missing },
      suggestions: missing.length > 0 
        ? ['Add title tag', 'Add description meta tag', 'Add viewport meta tag']
        : undefined
    }
  }

  private async checkStructuredData(): Promise<ValidationResult> {
    const fs = require('fs')
    const path = require('path')
    
    const indexPath = path.resolve('dist/index.html')
    if (!fs.existsSync(indexPath)) {
      return {
        passed: false,
        message: 'index.html not found'
      }
    }
    
    const content = fs.readFileSync(indexPath, 'utf8')
    const hasJsonLd = content.includes('application/ld+json')
    const hasMicrodata = content.includes('itemscope') && content.includes('itemtype')
    
    return {
      passed: hasJsonLd || hasMicrodata,
      message: hasJsonLd || hasMicrodata 
        ? 'Structured data found' 
        : 'No structured data detected',
      details: { hasJsonLd, hasMicrodata },
      suggestions: !hasJsonLd && !hasMicrodata 
        ? ['Add JSON-LD structured data', 'Use microdata for rich snippets', 'Implement schema.org markup']
        : undefined
    }
  }

  private generateReport() {
    const errors = this.results.filter(r => !r.passed && r.severity === 'error').length
    const warnings = this.results.filter(r => !r.passed && r.severity === 'warning').length
    const info = this.results.filter(r => !r.passed && r.severity === 'info').length
    const passed = this.results.filter(r => r.passed).length
    
    console.log('\n📋 Build Validation Report')
    console.log('=' .repeat(40))
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Errors: ${errors}`)
    console.log(`⚠️  Warnings: ${warnings}`)
    console.log(`ℹ️  Info: ${info}`)
    console.log(`📊 Total: ${this.results.length}`)
    
    if (errors > 0) {
      console.log('\n🚨 Critical Issues:')
      this.results
        .filter(r => !r.passed && r.severity === 'error')
        .forEach(r => console.log(`  • ${r.message}`))
    }
    
    if (warnings > 0) {
      console.log('\n⚠️  Warnings:')
      this.results
        .filter(r => !r.passed && r.severity === 'warning')
        .forEach(r => console.log(`  • ${r.message}`))
    }
    
    // Save report
    const reportPath = path.resolve('dist/validation-report.json')
    const report = {
      timestamp: new Date().toISOString(),
      summary: { errors, warnings, info, passed, total: this.results.length },
      results: this.results,
      suggestions: this.getAllSuggestions()
    }
    
    const fs = require('fs')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Report saved to: ${reportPath}`)
    
    if (errors > 0) {
      process.exit(1) // Exit with error code if there are critical issues
    }
  }

  private getAllSuggestions(): string[] {
    const suggestions = new Set<string>()
    this.results.forEach(result => {
      if (result.suggestions) {
        result.suggestions.forEach(suggestion => suggestions.add(suggestion))
      }
    })
    return Array.from(suggestions)
  }
}

export default BuildValidator
```

## CI/CD Build Optimizations

### 1. Enhanced CI/CD Pipeline with Build Optimizations (`.github/workflows/optimized-build.yml`)

```yaml
name: Optimized Build Pipeline

on:
  push:
    branches: [main, develop, staging]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8'
  CACHE_VERSION: 'v1'

jobs:
  # Early validation phase
  pre-build-validation:
    name: Pre-Build Validation
    runs-on: ubuntu-latest
    outputs:
      should-build: ${{ steps.validate.outputs.should-build }}
      build-type: ${{ steps.validate.outputs.build-type }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Install dependencies
        run: npm install -g pnpm
      
      - name: Validate code quality
        run: |
          pnpm install --frozen-lockfile
          pnpm run lint
          pnpm run type-check
        continue-on-error: true
      
      - name: Check if build needed
        id: validate
        run: |
          # Check if package.json, lock file, or source files changed
          if git diff --name-only HEAD~1 HEAD | grep -E "(package\.json|pnpm-lock\.yaml|src/|components/|pages/)"; then
            echo "should-build=true" >> $GITHUB_OUTPUT
            echo "build-type=full" >> $GITHUB_OUTPUT
          else
            echo "should-build=false" >> $GITHUB_OUTPUT
            echo "build-type=incremental" >> $GITHUB_OUTPUT
          fi

  # Parallel build jobs with matrix
  build:
    name: Build ${{ matrix.type }} (${{ matrix.target }})
    needs: pre-build-validation
    runs-on: ${{ matrix.runner }}
    if: needs.pre-build-validation.outputs.should-build == 'true'
    strategy:
      fail-fast: false
      matrix:
        target: [web, mobile]
        type: [optimized, minimal, analysis]
        include:
          - target: web
            runner: ubuntu-latest
            build-command: 'pnpm run build:optimized'
            artifact-name: 'web-build'
          - target: mobile
            runner: ubuntu-latest
            build-command: 'npx expo export --platform web'
            artifact-name: 'mobile-build'
          - target: web
            runner: ubuntu-latest
            build-command: 'pnpm run build:minimal'
            artifact-name: 'web-minimal'
            type: minimal
          - target: web
            runner: ubuntu-latest
            build-command: 'pnpm run build:analyze'
            artifact-name: 'web-analysis'
            type: analysis
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            ~/.pnpm-store
            node_modules
          key: ${{ runner.os }}-pnpm-${{ env.CACHE_VERSION }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-${{ env.CACHE_VERSION }}-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Pre-build cache
        uses: actions/cache@v3
        with:
          path: dist
          key: ${{ runner.os }}-build-${{ env.CACHE_VERSION }}-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-build-${{ env.CACHE_VERSION }}-

      - name: Run build with optimizations
        run: ${{ matrix.build-command }}
        env:
          NODE_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          VITE_BUILD_TARGET: ${{ matrix.target }}
          ENABLE_BUILD_ANALYSIS: ${{ matrix.type == 'analysis' }}
      
      - name: Build validation
        run: |
          node scripts/validate-build.js
          node scripts/build-validator.js
        env:
          BUILD_TYPE: ${{ matrix.type }}
      
      - name: Performance testing (optimized builds only)
        if: matrix.type == 'optimized'
        run: |
          npm install -g serve
          serve dist -l 3000 &
          sleep 5
          npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-result.json --chrome-flags="--headless --no-sandbox"
        continue-on-error: true
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.artifact-name }}-${{ github.sha }}
          path: |
            dist/
            dist-build-report.json
            dist-*.html
            lighthouse-result.json
          retention-days: 30
      
      - name: Upload to cache
        uses: actions/cache@v3
        with:
          path: dist
          key: ${{ runner.os }}-build-${{ env.CACHE_VERSION }}-${{ github.sha }}
      
      - name: Generate build report
        run: |
          node scripts/generate-build-report.js --output=ci-report.json
        if: always()
      
      - name: Comment build results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('ci-report.json', 'utf8'));
            
            const comment = `## Build Results
            - **Build Time**: ${report.buildTime}ms
            - **Bundle Size**: ${report.bundleSize}
            - **Files Count**: ${report.filesCount}
            - **Validation**: ${report.validation.passed ? '✅ Passed' : '❌ Failed'}
            
            ${report.validation.issues.map(issue => `- ${issue}`).join('\n')}
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  # Security scanning
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    if: always() && (needs.build.result == 'success' || needs.build.result == 'failure')
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: web-build-${{ github.sha }}
          path: dist
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'dist'
          format: 'sarif'
          output: 'trivy-results.sarif'
        continue-on-error: true
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
        if: always()

  # Deployment with optimizations
  deploy:
    name: Deploy ${{ matrix.target }}
    needs: [build, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    strategy:
      matrix:
        target: [web, mobile]
        include:
          - target: web
            deploy-command: ./scripts/deploy-web.sh
          - target: mobile
            deploy-command: ./scripts/deploy-mobile.sh
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: ${{ matrix.target }}-build-${{ github.sha }}
          path: dist
      
      - name: Deploy with optimizations
        run: ${{ matrix.deploy-command }}
        env:
          DEPLOY_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          BUILD_SHA: ${{ github.sha }}
      
      - name: Invalidate CDN cache
        if: matrix.target == 'web'
        run: |
          # CloudFlare API call to purge cache
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"files": ["https://cdn.sylos.io/*"]}'
      
      - name: Health check
        run: |
          # Wait for deployment to be ready
          sleep 30
          # Run health checks
          for url in "https://app.sylos.io" "https://cdn.sylos.io"; do
            status=$(curl -o /dev/null -s -w "%{http_code}" "$url")
            if [ "$status" != "200" ]; then
              echo "Health check failed for $url"
              exit 1
            fi
          done

  # Post-build monitoring
  monitoring:
    name: Post-Build Monitoring
    runs-on: ubuntu-latest
    needs: deploy
    if: always()
    
    steps:
      - name: Send deployment notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Build pipeline ${{ job.status }} for commit ${{ github.sha }}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
      
      - name: Update deployment status
        uses: actions/github-script@v6
        with:
          script: |
            const deploymentStatus = {
              state: '${{ job.status }}' === 'success' ? 'success' : 'failure',
              environment: '${{ github.ref }}' === 'refs/heads/main' ? 'production' : 'staging',
              target_url: 'https://app.sylos.io',
              description: 'Build ${{ job.status }} for commit ${{ github.sha }}'
            };
            
            github.rest.repos.createDeploymentStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              deployment_id: context.payload.deployment?.id,
              ...deploymentStatus
            });
```

### 2. Build Cache Strategy (`scripts/setup-build-cache.sh`)

```bash
#!/bin/bash

# Enhanced build cache setup for CI/CD

set -e

CACHE_DIR="$HOME/.build-cache"
DIST_DIR="dist"
NODE_MODULES="node_modules"

echo "🔧 Setting up build cache..."

# Create cache directory
mkdir -p "$CACHE_DIR"

# Function to get cache key
get_cache_key() {
    local target="$1"
    local type="$2"
    local key="build-cache-$target-$type-${{ hashFiles('**/package.json **/pnpm-lock.yaml src/**') }}"
    echo "$key"
}

# Function to save cache
save_cache() {
    local target="$1"
    local type="$2"
    local cache_key=$(get_cache_key "$target" "$type")
    
    echo "💾 Saving cache: $cache_key"
    
    # Create cache archive
    local cache_archive="$CACHE_DIR/$cache_key.tar.gz"
    
    if [ "$type" = "full" ]; then
        # Cache everything
        tar -czf "$cache_archive" "$DIST_DIR" "$NODE_MODULES" .npm 2>/dev/null || true
    elif [ "$type" = "incremental" ]; then
        # Cache only dist
        tar -czf "$cache_archive" "$DIST_DIR" 2>/dev/null || true
    else
        # Minimal cache
        echo "No cache for type: $type"
        return 1
    fi
    
    echo "✅ Cache saved: $(du -h "$cache_archive" | cut -f1)"
}

# Function to load cache
load_cache() {
    local target="$1"
    local type="$2"
    local cache_key=$(get_cache_key "$target" "$type")
    
    echo "📥 Loading cache: $cache_key"
    
    # Check if cache exists
    local cache_archive="$CACHE_DIR/$cache_key.tar.gz"
    if [ -f "$cache_archive" ]; then
        echo "✅ Cache found: $(du -h "$cache_archive" | cut -f1)"
        
        # Extract cache
        tar -xzf "$cache_archive" -C /
        
        # Verify extraction
        if [ -d "$DIST_DIR" ]; then
            echo "✅ Cache loaded successfully"
            return 0
        else
            echo "❌ Cache extraction failed"
            rm -f "$cache_archive"
            return 1
        fi
    else
        echo "❌ Cache not found"
        return 1
    fi
}

# Function to cleanup old caches
cleanup_cache() {
    local max_age_days=7
    
    echo "🧹 Cleaning up old caches..."
    
    find "$CACHE_DIR" -name "*.tar.gz" -type f -mtime +$max_age_days -delete
    echo "✅ Cleanup completed"
}

# Main cache logic
case "$1" in
    "save")
        load_cache "$2" "$3" && echo "Cache hit, skipping save" || save_cache "$2" "$3"
        ;;
    "load")
        load_cache "$2" "$3"
        ;;
    "cleanup")
        cleanup_cache
        ;;
    *)
        echo "Usage: $0 {save|load|cleanup} <target> <type>"
        echo "  save|load: target = web|mobile, type = full|incremental|minimal"
        echo "  cleanup: no arguments needed"
        exit 1
        ;;
esac
```

## Docker Containerization

### 1. Multi-stage Dockerfile for Production (`Dockerfile`)

```dockerfile
# Multi-stage build for optimal production container

# Stage 1: Dependencies and build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with cache
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build arguments
ARG NODE_ENV=production
ARG VITE_APP_TITLE=SylOS
ARG VITE_API_URL=https://api.sylos.io
ARG VITE_WS_URL=wss://ws.sylos.io

# Set environment variables
ENV NODE_ENV=$NODE_ENV
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build the application with optimizations
RUN pnpm run build:optimized

# Stage 2: Production runtime
FROM nginx:1.25-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf

# Copy SSL certificates (if available)
# COPY docker/ssl/ /etc/nginx/ssl/

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Expose port
EXPOSE 80 443

# Add labels
LABEL maintainer="SylOS Team" \
      version="1.0.0" \
      description="SylOS Production Web Application"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Development Dockerfile (`Dockerfile.dev`)

```dockerfile
FROM node:18-alpine

# Install pnpm and other tools
RUN npm install -g pnpm concurrently

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies
RUN pnpm install

# Copy source code
COPY . .

# Expose development port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# Start development server with hot reload
CMD ["pnpm", "run", "dev"]
```

### 3. Docker Compose for Development (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # Main application
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - VITE_DEV_SERVER=true
    stdin_open: true
    tty: true
    depends_on:
      - api
      - redis

  # API service
  api:
    image: node:18-alpine
    working_dir: /app
    ports:
      - "3001:3001"
    volumes:
      - ./services/api:/app
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/sylos_dev
      - REDIS_URL=redis://redis:6379
    command: ["npm", "run", "dev"]
    depends_on:
      - postgres
      - redis

  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=sylos_dev
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql

  # Redis cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Nginx reverse proxy
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/conf.d:/etc/nginx/conf.d
      - ./docker/ssl:/etc/nginx/ssl
    depends_on:
      - web
      - api
    profiles:
      - production

volumes:
  postgres_data:
  redis_data:
```

### 4. Production Docker Compose (`docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  # Web application
  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NODE_ENV: production
        VITE_APP_TITLE: SylOS
        VITE_API_URL: https://api.sylos.io
        VITE_WS_URL: wss://ws.sylos.io
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - app

  # API Gateway
  api-gateway:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/prod/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/prod/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - web
    networks:
      - app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  # Load balancer
  load-balancer:
    image: haproxy:2.8-alpine
    ports:
      - "8080:8080"
    volumes:
      - ./docker/prod/haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg
    depends_on:
      - web
    networks:
      - app

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./docker/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    networks:
      - app

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./docker/monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    depends_on:
      - prometheus
    networks:
      - app

  # Log aggregation
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - app

  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    volumes:
      - ./docker/monitoring/logstash/pipeline:/usr/share/logstash/pipeline
      - ./logs:/logs
    depends_on:
      - elasticsearch
    networks:
      - app

  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    networks:
      - app

  # Backup service
  backup:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=sylos_prod
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./docker/backup/backup.sh:/backup.sh
    command: ["sh", "/backup.sh"]
    depends_on:
      - postgres
    networks:
      - app

volumes:
  prometheus_data:
  grafana_data:
  elasticsearch_data:

networks:
  app:
    driver: bridge
```

### 5. Nginx Configuration (`docker/nginx.conf`)

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;

    # Performance optimizations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json
        application/xml
        image/svg+xml;

    # Brotli compression (if module available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Upstream for load balancing
    upstream web_backend {
        server web:80;
        # Add more servers for load balancing
        # server web2:80;
    }

    # Main server configuration
    server {
        listen 80;
        server_name cdn.sylos.io;
        
        root /usr/share/nginx/html;
        index index.html;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' wss: https:;" always;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            add_header Vary Accept-Encoding;
            
            # CORS headers
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
        }

        # API proxy
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Handle SPA routes
        location / {
            try_files $uri $uri/ /index.html;
            
            # Cache HTML files for shorter time
            location ~* \.html$ {
                expires 1h;
                add_header Cache-Control "public, must-revalidate";
            }
        }

        # Block access to sensitive files
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        location ~ ~$ {
            deny all;
            access_log off;
            log_not_found off;
        }
    }

    # HTTPS server (uncomment when SSL certificates are available)
    # server {
    #     listen 443 ssl http2;
    #     server_name cdn.sylos.io;
    #     
    #     ssl_certificate /etc/nginx/ssl/cert.pem;
    #     ssl_certificate_key /etc/nginx/ssl/key.pem;
    #     
    #     ssl_session_cache shared:SSL:1m;
    #     ssl_session_timeout 5m;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    #     ssl_prefer_server_ciphers on;
    #     
    #     # HSTS
    #     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    #     
    #     # Rest of configuration same as HTTP server
    #     include /etc/nginx/conf.d/default.conf;
    # }

    # Redirect HTTP to HTTPS
    # server {
    #     listen 80;
    #     server_name cdn.sylos.io;
    #     return 301 https://$server_name$request_uri;
    # }
}
```

## Environment-Specific Builds

### 1. Environment Configuration System (`config/environments.ts`)

```typescript
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
```

### 2. Environment-Specific Build Scripts (`scripts/build-environment.js`)

```javascript
#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')
const { getEnvironment, getEnvironmentVariables, validateEnvironment } = require('../config/environments')

const execAsync = promisify(exec)

class EnvironmentBuildManager {
  constructor() {
    this.environments = ['development', 'staging', 'production']
  }

  async buildForEnvironment(envName, options = {}) {
    console.log(`🏗️  Building for environment: ${envName}`)
    
    // Get environment configuration
    const env = getEnvironment(envName)
    
    // Validate environment
    const validation = validateEnvironment(env)
    if (!validation.valid) {
      throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`)
    }
    
    // Set environment variables
    this.setEnvironmentVariables(env)
    
    // Build arguments
    const buildArgs = this.buildBuildArguments(env, options)
    
    try {
      // Run build
      const startTime = Date.now()
      await this.runBuild(buildArgs)
      const buildTime = Date.now() - startTime
      
      // Post-build optimizations
      await this.runPostBuildOptimizations(env, options)
      
      // Generate environment-specific files
      await this.generateEnvironmentFiles(env)
      
      // Validation
      await this.validateBuild(env)
      
      console.log(`✅ Build completed for ${envName} in ${(buildTime / 1000).toFixed(2}s`)
      
    } catch (error) {
      console.error(`❌ Build failed for ${envName}:`, error.message)
      throw error
    }
  }

  setEnvironmentVariables(env) {
    const variables = getEnvironmentVariables(env)
    
    Object.entries(variables).forEach(([key, value]) => {
      process.env[key] = value
    })
    
    console.log('Environment variables set:', Object.keys(variables).length)
  }

  buildBuildArguments(env, options) {
    const args = []
    
    // Environment
    args.push(`--mode=${env.name}`)
    
    // Optimization flags
    if (env.optimizations.minify) args.push('--minify')
    if (env.optimizations.treeShaking) args.push('--tree-shaking')
    if (env.optimizations.codeSplitting) args.push('--code-splitting')
    if (env.optimizations.imageOptimization) args.push('--image-optimization')
    if (env.optimizations.bundleAnalysis) args.push('--analyze')
    
    // Feature flags
    if (env.features.enableSourceMaps) args.push('--sourcemap')
    if (env.features.enableHotReload) args.push('--hot-reload')
    
    // Caching
    if (env.caching.serviceWorker) args.push('--service-worker')
    
    // Security
    if (env.security.cspEnabled) args.push('--csp')
    if (env.security.sriEnabled) args.push('--sri')
    
    // Custom options
    if (options.target) args.push(`--target=${options.target}`)
    if (options.output) args.push(`--outDir=${options.output}`)
    if (options.analyzer) args.push(`--analyzer=${options.analyzer}`)
    
    return args
  }

  async runBuild(args) {
    const command = `pnpm run build:optimized ${args.join(' ')}`
    console.log(`Running: ${command}`)
    
    await execAsync(command, {
      env: { ...process.env },
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    })
  }

  async runPostBuildOptimizations(env, options) {
    if (env.optimizations.imageOptimization) {
      await this.optimizeImages()
    }
    
    if (env.caching.serviceWorker) {
      await this.generateServiceWorker(env)
    }
    
    if (env.security.sriEnabled) {
      await this.generateSRIHashes()
    }
  }

  async generateEnvironmentFiles(env) {
    const distPath = path.resolve('dist')
    const envConfig = {
      name: env.name,
      urls: {
        api: env.apiUrl,
        ws: env.wsUrl,
        network: env.networkName,
        chainId: env.chainId,
        explorer: env.explorerUrl
      },
      features: env.features,
      build: {
        timestamp: new Date().toISOString(),
        optimizations: env.optimizations
      }
    }
    
    // Generate environment config
    fs.writeFileSync(
      path.join(distPath, 'env.config.json'),
      JSON.stringify(envConfig, null, 2)
    )
    
    // Generate service worker for production
    if (env.caching.strategy === 'aggressive' || env.caching.serviceWorker) {
      await this.generateServiceWorker(env)
    }
    
    // Generate environment-specific HTML
    if (env.security.cspEnabled) {
      await this.updateCSPHeaders(env)
    }
  }

  async optimizeImages() {
    console.log('🖼️  Optimizing images...')
    await execAsync('node scripts/optimize-images.js')
  }

  async generateServiceWorker(env) {
    console.log('🔧 Generating service worker...')
    const swContent = this.generateServiceWorkerContent(env)
    fs.writeFileSync(path.join('dist', 'sw.js'), swContent)
  }

  generateServiceWorkerContent(env) {
    const cacheStrategy = env.caching.strategy
    const cacheName = `sylos-${env.name}`
    
    return `
const CACHE_NAME = '${cacheName}';
const STATIC_CACHE = '${cacheName}-static';
const DYNAMIC_CACHE = '${cacheName}-dynamic';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
  // Add more static assets as needed
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle requests with ${cacheStrategy} strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle different strategies
  if ('${cacheStrategy}' === 'aggressive') {
    event.respondWith(handleAggressiveStrategy(request));
  } else if ('${cacheStrategy}' === 'moderate') {
    event.respondWith(handleModerateStrategy(request));
  } else {
    event.respondWith(handleConservativeStrategy(request));
  }
});

async function handleAggressiveStrategy(request) {
  // Cache first, then network
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {
        // Network failed, keep cached version
      });
    
    return cachedResponse;
  }
  
  // Try network, then fallback
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}

async function handleModerateStrategy(request) {
  // Network first, then cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function handleConservativeStrategy(request) {
  // Network only
  return fetch(request);
}
    `
  }

  async generateSRIHashes() {
    console.log('🔐 Generating SRI hashes...')
    await execAsync('node scripts/generate-sri.js')
  }

  async updateCSPHeaders(env) {
    console.log('🛡️  Updating CSP headers...')
    // Update CSP configuration based on environment
  }

  async validateBuild(env) {
    console.log('🔍 Validating build...')
    
    // Check for required files
    const requiredFiles = [
      'dist/index.html',
      'dist/env.config.json'
    ]
    
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Required file not found: ${file}`)
      }
    }
    
    // Run build validator
    await execAsync('node scripts/build-validator.js')
    
    console.log('✅ Build validation passed')
  }

  // Multi-environment build
  async buildAllEnvironments(options = {}) {
    console.log('🏗️  Building all environments...')
    
    const results = []
    
    for (const env of this.environments) {
      try {
        await this.buildForEnvironment(env, options)
        results.push({ environment: env, success: true })
      } catch (error) {
        results.push({ environment: env, success: false, error: error.message })
        if (options.failFast) {
          throw error
        }
      }
    }
    
    // Generate report
    const report = this.generateBuildReport(results)
    fs.writeFileSync('build-report.json', JSON.stringify(report, null, 2))
    
    console.log('\n📊 Multi-environment build completed')
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.environment}`)
      if (!result.success) {
        console.log(`   Error: ${result.error}`)
      }
    })
  }

  generateBuildReport(results) {
    return {
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    }
  }
}

// CLI interface
if (require.main === module) {
  const manager = new EnvironmentBuildManager()
  const args = process.argv.slice(2)
  
  if (args[0] === 'all') {
    manager.buildAllEnvironments({
      failFast: args.includes('--fail-fast'),
      target: args.find(arg => arg.startsWith('--target='))?.split('=')[1]
    })
  } else {
    const envName = args[0] || 'development'
    const options = {
      target: args.find(arg => arg.startsWith('--target='))?.split('=')[1],
      output: args.find(arg => arg.startsWith('--outDir='))?.split('=')[1],
      analyzer: args.find(arg => arg.startsWith('--analyzer='))?.split('=')[1]
    }
    
    manager.buildForEnvironment(envName, options)
  }
}

module.exports = EnvironmentBuildManager
```

This comprehensive build optimization system provides:

1. **Advanced Vite Configurations** - Multi-environment builds with optimizations
2. **Webpack Optimizations** - Advanced chunk splitting, minification, and bundling
3