/**
 * Build Optimization Configuration
 * Comprehensive build optimization settings for SylOS applications
 */

export interface BuildOptimizationConfig {
  // Code optimization
  code: {
    minification: {
      enabled: boolean;
      esbuild: boolean;
      terser: boolean;
      removeConsole: boolean;
      removeDebugger: boolean;
      mangle: boolean;
      compress: {
        dead_code: boolean;
        drop_debugger: boolean;
        drop_console: boolean;
        pure_funcs: string[];
        pure_getters: boolean;
        keep_fnames: boolean;
      };
    };
    treeShaking: {
      enabled: boolean;
      moduleSideEffects: boolean;
      propertyReadSideEffects: boolean;
      tryCatchDeoptimization: boolean;
    };
    scopeHoisting: boolean;
    concatenateModules: boolean;
  };

  // Bundle optimization
  bundle: {
    chunking: {
      strategy: 'manual' | 'auto' | 'aggressive';
      minSize: number;
      maxSize: number;
      minRemainingSize: number;
      maxInitialRequests: number;
      maxAsyncRequests: number;
      maxInitialSize: number;
      maxAsyncSize: number;
      automaticNameDelimiter: string;
    };
    splitting: {
      vendor: {
        react: boolean;
        vue: boolean;
        angular: boolean;
        blockchain: boolean;
        ui: boolean;
        utils: boolean;
      };
      runtimeChunk: 'single' | 'multiple' | 'none';
      cacheGroups: {
        common: {
          name: string;
          minChunks: number;
          chunks: 'initial' | 'all' | 'async';
          enforce: boolean;
          priority: number;
        };
      };
    };
    target: string[];
    output: {
      filename: string;
      chunkFilename: string;
      assetModuleFilename: string;
      publicPath: string;
      path: string;
    };
  };

  // Performance optimization
  performance: {
    hints: boolean | 'error' | 'warning';
    maxEntrypointSize: number;
    maxAssetSize: number;
    assetFilter: (assetFilename: string) => boolean;
  };

  // Optimization plugins
  plugins: {
    webpackBundleAnalyzer: boolean;
    bundleSizeAnalyzer: boolean;
    hardSource: boolean;
    parallelUglify: boolean;
    gzip: boolean;
    brotli: boolean;
    analyze: boolean;
  };

  // Build settings
  build: {
    sourcemap: boolean | 'eval-cheap-module-source-map';
    devtool: string;
    mode: 'development' | 'production' | 'none';
    optimizationLevel: 'basic' | 'standard' | 'aggressive';
    parallel: boolean;
    cache: boolean;
    incremental: boolean;
  };

  // Environment specific
  environments: {
    development: {
      mode: string;
      optimization: BuildOptimizationConfig['optimization'];
      sourceMap: string;
      performance: {
        hints: 'warning';
        maxEntrypointSize: number;
        maxAssetSize: number;
      };
    };
    staging: {
      mode: string;
      optimization: BuildOptimizationConfig['optimization'];
      sourceMap: string;
      performance: {
        hints: 'warning';
        maxEntrypointSize: number;
        maxAssetSize: number;
      };
    };
    production: {
      mode: string;
      optimization: BuildOptimizationConfig['optimization'];
      sourceMap: boolean;
      performance: {
        hints: 'error';
        maxEntrypointSize: number;
        maxAssetSize: number;
      };
    };
  };

  // Metrics and reporting
  metrics: {
    bundleSize: {
      enabled: boolean;
      limit: number;
      chunks: {
        initial: number;
        async: number;
      };
      assets: {
        images: number;
        fonts: number;
        other: number;
      };
    };
    performance: {
      enabled: boolean;
      firstContentfulPaint: number;
      firstMeaningfulPaint: number;
      timeToInteractive: number;
      totalBlockingTime: number;
    };
    reporting: {
      enabled: boolean;
      formats: ('json' | 'html' | 'csv')[];
      outputDir: string;
    };
  };
}

export const defaultBuildOptimizationConfig: BuildOptimizationConfig = {
  code: {
    minification: {
      enabled: true,
      esbuild: true,
      terser: false,
      removeConsole: true,
      removeDebugger: true,
      mangle: true,
      compress: {
        dead_code: true,
        drop_debugger: true,
        drop_console: true,
        pure_funcs: ['console.log', 'console.info'],
        pure_getters: true,
        keep_fnames: false,
      },
    },
    treeShaking: {
      enabled: true,
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      tryCatchDeoptimization: false,
    },
    scopeHoisting: true,
    concatenateModules: true,
  },

  bundle: {
    chunking: {
      strategy: 'auto',
      minSize: 20000,
      maxSize: 250000,
      minRemainingSize: 20000,
      maxInitialRequests: 30,
      maxAsyncRequests: 30,
      maxInitialSize: 250000,
      maxAsyncSize: 250000,
      automaticNameDelimiter: '~',
    },
    splitting: {
      vendor: {
        react: true,
        vue: true,
        angular: true,
        blockchain: true,
        ui: true,
        utils: true,
      },
      runtimeChunk: 'single',
      cacheGroups: {
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true,
          priority: 0,
        },
      },
    },
    target: ['es2015', 'chrome60', 'firefox60', 'safari12'],
    output: {
      filename: 'js/[name].[contenthash].js',
      chunkFilename: 'js/[name].[contenthash].js',
      assetModuleFilename: 'assets/[name].[contenthash][ext]',
      publicPath: '/',
      path: 'dist',
    },
  },

  performance: {
    hints: 'error',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
    assetFilter: (assetFilename) => {
      return !/\.(map)$/i.test(assetFilename);
    },
  },

  plugins: {
    webpackBundleAnalyzer: true,
    bundleSizeAnalyzer: true,
    hardSource: true,
    parallelUglify: true,
    gzip: true,
    brotli: true,
    analyze: false,
  },

  build: {
    sourcemap: false,
    devtool: 'source-map',
    mode: 'production',
    optimizationLevel: 'standard',
    parallel: true,
    cache: true,
    incremental: true,
  },

  environments: {
    development: {
      mode: 'development',
      sourceMap: 'eval-cheap-module-source-map',
      performance: {
        hints: 'warning',
        maxEntrypointSize: 1000000,
        maxAssetSize: 1000000,
      },
    },
    staging: {
      mode: 'production',
      sourceMap: 'source-map',
      performance: {
        hints: 'warning',
        maxEntrypointSize: 750000,
        maxAssetSize: 750000,
      },
    },
    production: {
      mode: 'production',
      sourceMap: false,
      performance: {
        hints: 'error',
        maxEntrypointSize: 500000,
        maxAssetSize: 500000,
      },
    },
  },

  metrics: {
    bundleSize: {
      enabled: true,
      limit: 1024 * 1024, // 1MB
      chunks: {
        initial: 250 * 1024, // 250KB
        async: 100 * 1024, // 100KB
      },
      assets: {
        images: 500 * 1024, // 500KB
        fonts: 200 * 1024, // 200KB
        other: 100 * 1024, // 100KB
      },
    },
    performance: {
      enabled: true,
      firstContentfulPaint: 1500, // 1.5s
      firstMeaningfulPaint: 2000, // 2s
      timeToInteractive: 3000, // 3s
      totalBlockingTime: 300, // 300ms
    },
    reporting: {
      enabled: true,
      formats: ['json', 'html'],
      outputDir: 'reports/build',
    },
  },
};

export class BuildOptimizer {
  private config: BuildOptimizationConfig;

  constructor(config: Partial<BuildOptimizationConfig> = {}) {
    this.config = { ...defaultBuildOptimizationConfig, ...config };
  }

  /**
   * Get optimization configuration for specific environment
   */
  getEnvironmentConfig(env: keyof BuildOptimizationConfig['environments']): any {
    return this.config.environments[env];
  }

  /**
   * Get Webpack optimization configuration
   */
  getWebpackOptimizations(): any {
    const optimizations = {
      splitChunks: this.getSplitChunksConfig(),
      runtimeChunk: this.getRuntimeChunkConfig(),
      minimizer: this.getMinimizerConfig(),
      moduleIds: this.getModuleIdsConfig(),
      chunkIds: this.getChunkIdsConfig(),
    };

    if (this.config.code.treeShaking) {
      optimizations = {
        ...optimizations,
        sideEffects: this.config.code.treeShaking.moduleSideEffects,
        providedExports: true,
        usedExports: true,
      };
    }

    return optimizations;
  }

  /**
   * Get split chunks configuration
   */
  private getSplitChunksConfig(): any {
    const { chunking, splitting } = this.config.bundle;
    
    const cacheGroups = {
      default: {
        minChunks: 2,
        priority: -20,
        reuseExistingChunk: true,
      },
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: -10,
        chunks: 'all',
      },
    };

    // Add vendor-specific splits
    if (splitting.vendor.react) {
      cacheGroups.react = {
        test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
        name: 'react-vendor',
        priority: 5,
        chunks: 'all',
      };
    }

    if (splitting.vendor.blockchain) {
      cacheGroups.blockchain = {
        test: /[\\/]node_modules[\\/](ethers|web3|@rainbow-me|wagmi|viem)[\\/]/,
        name: 'blockchain-vendor',
        priority: 5,
        chunks: 'all',
      };
    }

    if (splitting.vendor.ui) {
      cacheGroups.ui = {
        test: /[\\/]node_modules[\\/](@mui|lucide|antd)[\\/]/,
        name: 'ui-vendor',
        priority: 3,
        chunks: 'all',
      };
    }

    return {
      chunks: 'all',
      minSize: chunking.minSize,
      maxSize: chunking.maxSize,
      minChunks: 1,
      maxAsyncRequests: chunking.maxAsyncRequests,
      maxInitialRequests: chunking.maxInitialRequests,
      automaticNameDelimiter: chunking.automaticNameDelimiter,
      cacheGroups,
    };
  }

  /**
   * Get runtime chunk configuration
   */
  private getRuntimeChunkConfig(): any {
    switch (this.config.bundle.splitting.runtimeChunk) {
      case 'single':
        return 'single';
      case 'multiple':
        return 'multiple';
      case 'none':
      default:
        return false;
    }
  }

  /**
   * Get minimizer configuration
   */
  private getMinimizerConfig(): any[] {
    const minimizers = [];

    if (this.config.code.minification.esbuild) {
      const { esbuild } = require('esbuild-loader');
      minimizers.push(
        new esbuild.MinifyPlugin({
          target: this.config.bundle.target,
          minify: true,
          ...this.config.code.minification.compress,
        })
      );
    }

    if (this.config.code.minification.terser) {
      const TerserPlugin = require('terser-webpack-plugin');
      minimizers.push(
        new TerserPlugin({
          terserOptions: {
            compress: this.config.code.minification.compress,
            mangle: this.config.code.minification.mangle,
            keep_fnames: this.config.code.minification.compress.keep_fnames,
          },
          extractComments: false,
        })
      );
    }

    return minimizers;
  }

  /**
   * Get module IDs configuration
   */
  private getModuleIdsConfig(): 'natural' | 'named' | 'hashed' {
    return 'named';
  }

  /**
   * Get chunk IDs configuration
   */
  private getChunkIdsConfig(): 'natural' | 'named' | 'size' | 'total-size' {
    return 'named';
  }

  /**
   * Get performance budget
   */
  getPerformanceBudget(): any {
    return this.config.performance;
  }

  /**
   * Get build metrics configuration
   */
  getMetricsConfig(): any {
    return this.config.metrics;
  }

  /**
   * Validate build configuration
   */
  validateConfig(): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate bundle size limits
    if (this.config.metrics.bundleSize.limit < 100 * 1024) {
      warnings.push('Bundle size limit is very small (< 100KB)');
    }

    if (this.config.metrics.bundleSize.limit > 10 * 1024 * 1024) {
      warnings.push('Bundle size limit is very large (> 10MB)');
    }

    // Validate chunk sizes
    if (this.config.bundle.chunking.minSize > this.config.bundle.chunking.maxSize) {
      errors.push('minSize cannot be greater than maxSize');
    }

    // Validate performance budgets
    if (this.config.performance.maxAssetSize < this.config.performance.maxEntrypointSize) {
      errors.push('maxAssetSize cannot be less than maxEntrypointSize');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Generate build report
   */
  generateBuildReport(): any {
    return {
      configuration: this.config,
      validations: this.validateConfig(),
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (!this.config.code.minification.enabled) {
      recommendations.push('Enable minification for production builds');
    }

    if (!this.config.code.treeShaking.enabled) {
      recommendations.push('Enable tree shaking to remove unused code');
    }

    if (!this.config.bundle.splitting.vendor.react) {
      recommendations.push('Consider vendor-specific splitting for better caching');
    }

    if (this.config.performance.maxAssetSize > 1024 * 1024) {
      recommendations.push('Consider reducing maxAssetSize for better performance');
    }

    if (recommendations.length === 0) {
      recommendations.push('Build configuration looks optimal');
    }

    return recommendations;
  }
}

export default BuildOptimizer;