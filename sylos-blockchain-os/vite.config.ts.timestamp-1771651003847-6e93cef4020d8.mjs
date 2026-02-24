// vite.config.ts
import { defineConfig } from "file:///C:/Users/Crater/Downloads/SYLOS%20system%20-%20NEW/sylos-blockchain-os/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Crater/Downloads/SYLOS%20system%20-%20NEW/sylos-blockchain-os/node_modules/@vitejs/plugin-react/dist/index.js";
import autoprefixer from "file:///C:/Users/Crater/Downloads/SYLOS%20system%20-%20NEW/sylos-blockchain-os/node_modules/autoprefixer/lib/autoprefixer.js";
import { createHtmlPlugin } from "file:///C:/Users/Crater/Downloads/SYLOS%20system%20-%20NEW/sylos-blockchain-os/node_modules/vite-plugin-html/dist/index.mjs";

// src/utils/environment.ts
var EnvironmentManager = class _EnvironmentManager {
  static instance;
  config;
  securityConfig;
  constructor() {
    this.config = this.loadConfig();
    this.securityConfig = this.loadSecurityConfig();
  }
  static getInstance() {
    if (!_EnvironmentManager.instance) {
      _EnvironmentManager.instance = new _EnvironmentManager();
    }
    return _EnvironmentManager.instance;
  }
  loadConfig() {
    const requiredVars = [
      "VITE_API_BASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
      "VITE_WALLETCONNECT_PROJECT_ID"
    ];
    if (import.meta.env.PROD) {
      for (const varName of requiredVars) {
        if (!import.meta.env[varName]) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      }
    }
    return {
      NODE_ENV: import.meta.env.VITE_NODE_ENV || "development",
      VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION || "1.0.0",
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
      VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
      VITE_ENABLE_ERROR_LOGGING: import.meta.env.VITE_ENABLE_ERROR_LOGGING === "true",
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
      VITE_CSP_ENABLED: import.meta.env.VITE_CSP_ENABLED === "true",
      VITE_SECURITY_HEADERS_ENABLED: import.meta.env.VITE_SECURITY_HEADERS_ENABLED === "true"
    };
  }
  loadSecurityConfig() {
    return {
      enableCSP: this.config.VITE_CSP_ENABLED,
      enableSecurityHeaders: this.config.VITE_SECURITY_HEADERS_ENABLED,
      allowedOrigins: [
        "http://localhost:5173",
        "https://localhost:5173",
        ...this.config.VITE_API_BASE_URL ? [this.config.VITE_API_BASE_URL] : []
      ],
      maxFileSize: 5 * 1024 * 1024,
      // 5MB
      rateLimitPerMinute: 100,
      sessionTimeout: 30 * 60 * 1e3,
      // 30 minutes
      enableHSTS: import.meta.env.PROD
    };
  }
  getConfig() {
    return { ...this.config };
  }
  getSecurityConfig() {
    return { ...this.securityConfig };
  }
  isDevelopment() {
    return this.config.NODE_ENV === "development";
  }
  isProduction() {
    return this.config.NODE_ENV === "production";
  }
  isTest() {
    return this.config.NODE_ENV === "test";
  }
  shouldEnableErrorLogging() {
    return this.config.VITE_ENABLE_ERROR_LOGGING || this.isDevelopment();
  }
  shouldEnableAnalytics() {
    return this.config.VITE_ENABLE_ANALYTICS && this.isProduction();
  }
  // Security validation
  validateConfig() {
    const errors = [];
    if (this.isProduction()) {
      if (this.config.VITE_API_BASE_URL?.startsWith("http://")) {
        errors.push("API URL should use HTTPS in production");
      }
      if (!this.config.VITE_SUPABASE_URL || !this.config.VITE_SUPABASE_ANON_KEY) {
        errors.push("Supabase configuration is required in production");
      }
      if (!this.securityConfig.enableCSP) {
        errors.push("CSP should be enabled in production");
      }
    }
    return errors;
  }
};
var envManager = EnvironmentManager.getInstance();
var getSecurityHeaders = () => {
  const config = envManager.getSecurityConfig();
  const headers = {};
  if (config.enableSecurityHeaders) {
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["X-XSS-Protection"] = "1; mode=block";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    if (config.enableHSTS) {
      headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
    }
    headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
  }
  return headers;
};

// vite.config.ts
var vite_config_default = defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const isStaging = mode === "staging";
  const isAnalyze = mode === "analyze";
  const baseUrl = isProduction ? "https://cdn.sylos.io" : isStaging ? "https://staging-cdn.sylos.io" : "/";
  return {
    plugins: [
      react({
        // Enable JSX runtime optimization
        jsxRuntime: "automatic",
        // Enable React optimization
        babel: {
          plugins: isProduction ? [
            // Remove console.logs in production
            ["transform-remove-console", {
              exclude: ["error", "warn"]
            }],
            // Remove debugger statements
            ["transform-remove-debugger"],
            // Optimize React
            ["transform-react-remove-prop-types", {
              mode: "wrap"
            }]
          ] : []
        }
      }),
      // HTML plugin for CSP and performance optimization
      createHtmlPlugin({
        minify: isProduction,
        inject: {
          data: {
            title: "SylOS Blockchain OS",
            description: "Next-generation blockchain operating system",
            csp: isProduction ? generateCSP() : generateCSPStaging(),
            // Performance optimizations
            preloadCritical: isProduction,
            serviceWorker: isProduction,
            resourceHints: generateResourceHints()
          }
        }
      })
    ].filter(Boolean),
    // Base configuration
    base: baseUrl,
    // Build configuration with performance optimizations
    build: {
      // Source map generation (only for staging/production debugging)
      sourcemap: isStaging || isAnalyze,
      // Enhanced minification for production
      minify: isProduction ? "esbuild" : false,
      // Target modern browsers for better performance
      target: isProduction ? [
        "es2019",
        "chrome80",
        "firefox78",
        "safari14",
        "edge80"
      ] : "esnext",
      // CSS code splitting
      cssCodeSplit: true,
      // Enhanced rollup options for performance
      ...isProduction && {
        rollupOptions: {
          // Tree shaking optimization
          treeshake: {
            moduleSideEffects: false,
            propertyReadSideEffects: false,
            tryCatchDeoptimization: false
          },
          onwarn(warning, warn) {
            if (warning.code === "UNUSED_EXTERNAL_IMPORT") return;
            if (warning.code === "CIRCULAR_DEPENDENCY") return;
            warn(warning);
          },
          output: {
            // Advanced chunking strategy
            manualChunks: (id) => {
              if (id.includes("node_modules")) {
                if (/react|react-dom|react-router/.test(id)) {
                  return "react-vendor";
                }
                if (/ethers|@rainbow-me|wagmi|viem|web3/.test(id)) {
                  return "blockchain-vendor";
                }
                if (/lucide|@supabase|tailwind/.test(id)) {
                  return "ui-vendor";
                }
                if (/@tanstack|zustand|redux/.test(id)) {
                  return "state-vendor";
                }
                if (/date-fns|lodash|clsx|axios/.test(id)) {
                  return "utils-vendor";
                }
                if (/defi|uniswap|sushi/.test(id)) {
                  return "defi-vendor";
                }
                return "vendor";
              }
              if (id.includes("/src/components/apps/")) {
                const appName = id.split("/").pop()?.replace(".tsx", "") || "app";
                return `app-${appName}`;
              }
              if (id.includes("/src/components/")) {
                return "core-components";
              }
              if (id.includes("/src/utils/") || id.includes("/src/hooks/")) {
                return "app-utils";
              }
            },
            // Optimized asset naming
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name?.split(".");
              const ext = info?.[info.length - 1];
              if (/\.(png|jpe?g|gif|svg|ico|webp|avif)$/i.test(assetInfo.name || "")) {
                return `assets/images/[name]-[hash][extname]`;
              }
              if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || "")) {
                return `assets/fonts/[name]-[hash][extname]`;
              }
              if (/\.(mp4|webm|ogg)$/i.test(assetInfo.name || "")) {
                return `assets/media/[name]-[hash][extname]`;
              }
              return `assets/[name]-[hash][extname]`;
            },
            // Optimized chunk naming
            chunkFileNames: (chunkInfo) => {
              const facadeModuleId = chunkInfo.facadeModuleId;
              if (facadeModuleId) {
                const moduleName = facadeModuleId.split("/").pop()?.replace(".tsx", "") || "chunk";
                return `js/[name]-[hash].js`;
              }
              return "js/[name]-[hash].js";
            },
            entryFileNames: "js/[name]-[hash].js"
          }
        }
      },
      // Performance budgets
      chunkSizeWarningLimit: 1e3,
      // 1MB
      assetsInlineLimit: 4096,
      // 4KB
      // Compressed size reporting
      reportCompressedSize: isProduction,
      // Clean output directory
      emptyOutDir: true,
      // Module pre-bundling
      sourcemap: isStaging || isAnalyze
    },
    // Development server optimizations
    server: {
      port: 5173,
      host: true,
      cors: true,
      // Security headers
      headers: !isProduction ? getSecurityHeaders() : {},
      // HMR optimizations
      hmr: {
        overlay: !isProduction
      },
      // Optimized dependencies
      fs: {
        allow: ["..", ".."]
      }
    },
    // Preview server
    preview: {
      port: 4173,
      host: true,
      cors: true,
      headers: getSecurityHeaders()
    },
    // Enhanced dependencies optimization
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "ethers",
        "@rainbow-me/rainbowkit",
        "wagmi",
        "viem",
        "lucide-react",
        "@supabase/supabase-js",
        "@tanstack/react-query",
        "date-fns",
        "clsx",
        "tailwind-merge"
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
      __BUILD_TIME__: JSON.stringify((/* @__PURE__ */ new Date()).toISOString()),
      __ENV__: JSON.stringify(mode),
      __PERFORMANCE_MODE__: JSON.stringify(isProduction)
    },
    // Enhanced CSS configuration
    css: {
      // CSS modules
      modules: {
        localsConvention: "camelCase"
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
          autoprefixer()
        ]
      }
    },
    // Worker configuration
    worker: {
      format: "es"
    },
    // JSON configuration
    json: {
      namedExports: true,
      stringify: false
    }
  };
});
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
  `.replace(/\s{2,}/g, " ").trim();
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
  `.replace(/\s{2,}/g, " ").trim();
}
function generateResourceHints() {
  return {
    preconnect: [
      "https://polygon-rpc.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      "https://api.sylos.io"
    ],
    preload: [
      "/static/js/main.js",
      "/static/css/main.css",
      "/manifest.json"
    ],
    dnsPrefetch: [
      "https://polygon-rpc.com",
      "https://api.sylos.io"
    ]
  };
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL3V0aWxzL2Vudmlyb25tZW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3JhdGVyXFxcXERvd25sb2Fkc1xcXFxTWUxPUyBzeXN0ZW0gLSBORVdcXFxcc3lsb3MtYmxvY2tjaGFpbi1vc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3JhdGVyXFxcXERvd25sb2Fkc1xcXFxTWUxPUyBzeXN0ZW0gLSBORVdcXFxcc3lsb3MtYmxvY2tjaGFpbi1vc1xcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvQ3JhdGVyL0Rvd25sb2Fkcy9TWUxPUyUyMHN5c3RlbSUyMC0lMjBORVcvc3lsb3MtYmxvY2tjaGFpbi1vcy92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcbmltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSAnYXV0b3ByZWZpeGVyJ1xuaW1wb3J0IHsgY3JlYXRlSHRtbFBsdWdpbiB9IGZyb20gJ3ZpdGUtcGx1Z2luLWh0bWwnXG5pbXBvcnQgeyBnZXRTZWN1cml0eUhlYWRlcnMgfSBmcm9tICcuL3NyYy91dGlscy9lbnZpcm9ubWVudCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcbiAgY29uc3QgaXNQcm9kdWN0aW9uID0gbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nXG4gIGNvbnN0IGlzU3RhZ2luZyA9IG1vZGUgPT09ICdzdGFnaW5nJ1xuICBjb25zdCBpc0FuYWx5emUgPSBtb2RlID09PSAnYW5hbHl6ZSdcblxuICBjb25zdCBiYXNlVXJsID0gaXNQcm9kdWN0aW9uXG4gICAgPyAnaHR0cHM6Ly9jZG4uc3lsb3MuaW8nXG4gICAgOiBpc1N0YWdpbmdcbiAgICAgID8gJ2h0dHBzOi8vc3RhZ2luZy1jZG4uc3lsb3MuaW8nXG4gICAgICA6ICcvJ1xuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3Qoe1xuICAgICAgICAvLyBFbmFibGUgSlNYIHJ1bnRpbWUgb3B0aW1pemF0aW9uXG4gICAgICAgIGpzeFJ1bnRpbWU6ICdhdXRvbWF0aWMnLFxuICAgICAgICAvLyBFbmFibGUgUmVhY3Qgb3B0aW1pemF0aW9uXG4gICAgICAgIGJhYmVsOiB7XG4gICAgICAgICAgcGx1Z2luczogaXNQcm9kdWN0aW9uID8gW1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGNvbnNvbGUubG9ncyBpbiBwcm9kdWN0aW9uXG4gICAgICAgICAgICBbJ3RyYW5zZm9ybS1yZW1vdmUtY29uc29sZScsIHtcbiAgICAgICAgICAgICAgZXhjbHVkZTogWydlcnJvcicsICd3YXJuJ11cbiAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgLy8gUmVtb3ZlIGRlYnVnZ2VyIHN0YXRlbWVudHNcbiAgICAgICAgICAgIFsndHJhbnNmb3JtLXJlbW92ZS1kZWJ1Z2dlciddLFxuICAgICAgICAgICAgLy8gT3B0aW1pemUgUmVhY3RcbiAgICAgICAgICAgIFsndHJhbnNmb3JtLXJlYWN0LXJlbW92ZS1wcm9wLXR5cGVzJywge1xuICAgICAgICAgICAgICBtb2RlOiAnd3JhcCdcbiAgICAgICAgICAgIH1dXG4gICAgICAgICAgXSA6IFtdXG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgLy8gSFRNTCBwbHVnaW4gZm9yIENTUCBhbmQgcGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uXG4gICAgICBjcmVhdGVIdG1sUGx1Z2luKHtcbiAgICAgICAgbWluaWZ5OiBpc1Byb2R1Y3Rpb24sXG4gICAgICAgIGluamVjdDoge1xuICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIHRpdGxlOiAnU3lsT1MgQmxvY2tjaGFpbiBPUycsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ05leHQtZ2VuZXJhdGlvbiBibG9ja2NoYWluIG9wZXJhdGluZyBzeXN0ZW0nLFxuICAgICAgICAgICAgY3NwOiBpc1Byb2R1Y3Rpb24gPyBnZW5lcmF0ZUNTUCgpIDogZ2VuZXJhdGVDU1BTdGFnaW5nKCksXG4gICAgICAgICAgICAvLyBQZXJmb3JtYW5jZSBvcHRpbWl6YXRpb25zXG4gICAgICAgICAgICBwcmVsb2FkQ3JpdGljYWw6IGlzUHJvZHVjdGlvbixcbiAgICAgICAgICAgIHNlcnZpY2VXb3JrZXI6IGlzUHJvZHVjdGlvbixcbiAgICAgICAgICAgIHJlc291cmNlSGludHM6IGdlbmVyYXRlUmVzb3VyY2VIaW50cygpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KSxcbiAgICBdLmZpbHRlcihCb29sZWFuKSxcblxuICAgIC8vIEJhc2UgY29uZmlndXJhdGlvblxuICAgIGJhc2U6IGJhc2VVcmwsXG5cbiAgICAvLyBCdWlsZCBjb25maWd1cmF0aW9uIHdpdGggcGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uc1xuICAgIGJ1aWxkOiB7XG4gICAgICAvLyBTb3VyY2UgbWFwIGdlbmVyYXRpb24gKG9ubHkgZm9yIHN0YWdpbmcvcHJvZHVjdGlvbiBkZWJ1Z2dpbmcpXG4gICAgICBzb3VyY2VtYXA6IGlzU3RhZ2luZyB8fCBpc0FuYWx5emUsXG5cbiAgICAgIC8vIEVuaGFuY2VkIG1pbmlmaWNhdGlvbiBmb3IgcHJvZHVjdGlvblxuICAgICAgbWluaWZ5OiBpc1Byb2R1Y3Rpb24gPyAnZXNidWlsZCcgOiBmYWxzZSxcblxuICAgICAgLy8gVGFyZ2V0IG1vZGVybiBicm93c2VycyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICB0YXJnZXQ6IGlzUHJvZHVjdGlvbiA/IFtcbiAgICAgICAgJ2VzMjAxOScsXG4gICAgICAgICdjaHJvbWU4MCcsXG4gICAgICAgICdmaXJlZm94NzgnLFxuICAgICAgICAnc2FmYXJpMTQnLFxuICAgICAgICAnZWRnZTgwJ1xuICAgICAgXSA6ICdlc25leHQnLFxuXG4gICAgICAvLyBDU1MgY29kZSBzcGxpdHRpbmdcbiAgICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcblxuICAgICAgLy8gRW5oYW5jZWQgcm9sbHVwIG9wdGlvbnMgZm9yIHBlcmZvcm1hbmNlXG4gICAgICAuLi4oaXNQcm9kdWN0aW9uICYmIHtcbiAgICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICAgIC8vIFRyZWUgc2hha2luZyBvcHRpbWl6YXRpb25cbiAgICAgICAgICB0cmVlc2hha2U6IHtcbiAgICAgICAgICAgIG1vZHVsZVNpZGVFZmZlY3RzOiBmYWxzZSxcbiAgICAgICAgICAgIHByb3BlcnR5UmVhZFNpZGVFZmZlY3RzOiBmYWxzZSxcbiAgICAgICAgICAgIHRyeUNhdGNoRGVvcHRpbWl6YXRpb246IGZhbHNlXG4gICAgICAgICAgfSxcbiAgICAgICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICAgICAgLy8gSWdub3JlIHNwZWNpZmljIHdhcm5pbmdzIGluIHByb2R1Y3Rpb25cbiAgICAgICAgICAgIGlmICh3YXJuaW5nLmNvZGUgPT09ICdVTlVTRURfRVhURVJOQUxfSU1QT1JUJykgcmV0dXJuXG4gICAgICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSAnQ0lSQ1VMQVJfREVQRU5ERU5DWScpIHJldHVyblxuICAgICAgICAgICAgd2Fybih3YXJuaW5nKVxuICAgICAgICAgIH0sXG4gICAgICAgICAgb3V0cHV0OiB7XG4gICAgICAgICAgICAvLyBBZHZhbmNlZCBjaHVua2luZyBzdHJhdGVneVxuICAgICAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcbiAgICAgICAgICAgICAgLy8gTm9kZV9tb2R1bGVzIG9wdGltaXphdGlvblxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcycpKSB7XG4gICAgICAgICAgICAgICAgLy8gUmVhY3QgZWNvc3lzdGVtXG4gICAgICAgICAgICAgICAgaWYgKC9yZWFjdHxyZWFjdC1kb218cmVhY3Qtcm91dGVyLy50ZXN0KGlkKSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICdyZWFjdC12ZW5kb3InXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEJsb2NrY2hhaW4gbGlicmFyaWVzICBcbiAgICAgICAgICAgICAgICBpZiAoL2V0aGVyc3xAcmFpbmJvdy1tZXx3YWdtaXx2aWVtfHdlYjMvLnRlc3QoaWQpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ2Jsb2NrY2hhaW4tdmVuZG9yJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBVSSBsaWJyYXJpZXNcbiAgICAgICAgICAgICAgICBpZiAoL2x1Y2lkZXxAc3VwYWJhc2V8dGFpbHdpbmQvLnRlc3QoaWQpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ3VpLXZlbmRvcidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3RhdGUgbWFuYWdlbWVudFxuICAgICAgICAgICAgICAgIGlmICgvQHRhbnN0YWNrfHp1c3RhbmR8cmVkdXgvLnRlc3QoaWQpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ3N0YXRlLXZlbmRvcidcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gVXRpbGl0eSBsaWJyYXJpZXNcbiAgICAgICAgICAgICAgICBpZiAoL2RhdGUtZm5zfGxvZGFzaHxjbHN4fGF4aW9zLy50ZXN0KGlkKSkge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuICd1dGlscy12ZW5kb3InXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIERlRmkgbGlicmFyaWVzXG4gICAgICAgICAgICAgICAgaWYgKC9kZWZpfHVuaXN3YXB8c3VzaGkvLnRlc3QoaWQpKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gJ2RlZmktdmVuZG9yJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBHcm91cCBhbGwgb3RoZXIgbm9kZV9tb2R1bGVzXG4gICAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3InXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBBcHAgY29kZSBzcGxpdHRpbmcgYnkgZmVhdHVyZVxuICAgICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zcmMvY29tcG9uZW50cy9hcHBzLycpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXBwTmFtZSA9IGlkLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy50c3gnLCAnJykgfHwgJ2FwcCdcbiAgICAgICAgICAgICAgICByZXR1cm4gYGFwcC0ke2FwcE5hbWV9YFxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gQ29yZSBPUyBjb21wb25lbnRzXG4gICAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3NyYy9jb21wb25lbnRzLycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdjb3JlLWNvbXBvbmVudHMnXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBVdGlscyBhbmQgaG9va3NcbiAgICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvc3JjL3V0aWxzLycpIHx8IGlkLmluY2x1ZGVzKCcvc3JjL2hvb2tzLycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICdhcHAtdXRpbHMnXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8vIE9wdGltaXplZCBhc3NldCBuYW1pbmdcbiAgICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhc3NldEluZm8ubmFtZT8uc3BsaXQoJy4nKVxuICAgICAgICAgICAgICBjb25zdCBleHQgPSBpbmZvPy5baW5mby5sZW5ndGggLSAxXVxuXG4gICAgICAgICAgICAgIGlmICgvXFwuKHBuZ3xqcGU/Z3xnaWZ8c3ZnfGljb3x3ZWJwfGF2aWYpJC9pLnRlc3QoYXNzZXRJbmZvLm5hbWUgfHwgJycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGBhc3NldHMvaW1hZ2VzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV1gXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKC9cXC4od29mZjI/fGVvdHx0dGZ8b3RmKSQvaS50ZXN0KGFzc2V0SW5mby5uYW1lIHx8ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL2ZvbnRzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV1gXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKC9cXC4obXA0fHdlYm18b2dnKSQvaS50ZXN0KGFzc2V0SW5mby5uYW1lIHx8ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL21lZGlhL1tuYW1lXS1baGFzaF1bZXh0bmFtZV1gXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGBhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXWBcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIC8vIE9wdGltaXplZCBjaHVuayBuYW1pbmdcbiAgICAgICAgICAgIGNodW5rRmlsZU5hbWVzOiAoY2h1bmtJbmZvKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGZhY2FkZU1vZHVsZUlkID0gY2h1bmtJbmZvLmZhY2FkZU1vZHVsZUlkXG4gICAgICAgICAgICAgIGlmIChmYWNhZGVNb2R1bGVJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vZHVsZU5hbWUgPSBmYWNhZGVNb2R1bGVJZC5zcGxpdCgnLycpLnBvcCgpPy5yZXBsYWNlKCcudHN4JywgJycpIHx8ICdjaHVuaydcbiAgICAgICAgICAgICAgICByZXR1cm4gYGpzL1tuYW1lXS1baGFzaF0uanNgXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuICdqcy9bbmFtZV0tW2hhc2hdLmpzJ1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdqcy9bbmFtZV0tW2hhc2hdLmpzJ1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSksXG5cbiAgICAgIC8vIFBlcmZvcm1hbmNlIGJ1ZGdldHNcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCwgLy8gMU1CXG4gICAgICBhc3NldHNJbmxpbmVMaW1pdDogNDA5NiwgLy8gNEtCXG5cbiAgICAgIC8vIENvbXByZXNzZWQgc2l6ZSByZXBvcnRpbmdcbiAgICAgIHJlcG9ydENvbXByZXNzZWRTaXplOiBpc1Byb2R1Y3Rpb24sXG5cbiAgICAgIC8vIENsZWFuIG91dHB1dCBkaXJlY3RvcnlcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuXG4gICAgICAvLyBNb2R1bGUgcHJlLWJ1bmRsaW5nXG4gICAgICBzb3VyY2VtYXA6IGlzU3RhZ2luZyB8fCBpc0FuYWx5emVcbiAgICB9LFxuXG4gICAgLy8gRGV2ZWxvcG1lbnQgc2VydmVyIG9wdGltaXphdGlvbnNcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIHBvcnQ6IDUxNzMsXG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgY29yczogdHJ1ZSxcbiAgICAgIC8vIFNlY3VyaXR5IGhlYWRlcnNcbiAgICAgIGhlYWRlcnM6ICFpc1Byb2R1Y3Rpb24gPyBnZXRTZWN1cml0eUhlYWRlcnMoKSA6IHt9LFxuICAgICAgLy8gSE1SIG9wdGltaXphdGlvbnNcbiAgICAgIGhtcjoge1xuICAgICAgICBvdmVybGF5OiAhaXNQcm9kdWN0aW9uXG4gICAgICB9LFxuICAgICAgLy8gT3B0aW1pemVkIGRlcGVuZGVuY2llc1xuICAgICAgZnM6IHtcbiAgICAgICAgYWxsb3c6IFsnLi4nLCAnLi4nXVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBQcmV2aWV3IHNlcnZlclxuICAgIHByZXZpZXc6IHtcbiAgICAgIHBvcnQ6IDQxNzMsXG4gICAgICBob3N0OiB0cnVlLFxuICAgICAgY29yczogdHJ1ZSxcbiAgICAgIGhlYWRlcnM6IGdldFNlY3VyaXR5SGVhZGVycygpXG4gICAgfSxcblxuICAgIC8vIEVuaGFuY2VkIGRlcGVuZGVuY2llcyBvcHRpbWl6YXRpb25cbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGluY2x1ZGU6IFtcbiAgICAgICAgJ3JlYWN0JyxcbiAgICAgICAgJ3JlYWN0LWRvbScsXG4gICAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcbiAgICAgICAgJ2V0aGVycycsXG4gICAgICAgICdAcmFpbmJvdy1tZS9yYWluYm93a2l0JyxcbiAgICAgICAgJ3dhZ21pJyxcbiAgICAgICAgJ3ZpZW0nLFxuICAgICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICAgJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsXG4gICAgICAgICdAdGFuc3RhY2svcmVhY3QtcXVlcnknLFxuICAgICAgICAnZGF0ZS1mbnMnLFxuICAgICAgICAnY2xzeCcsXG4gICAgICAgICd0YWlsd2luZC1tZXJnZSdcbiAgICAgIF0sXG4gICAgICAvLyBQcmUtYnVuZGxlIGZvciBkZXZlbG9wbWVudFxuICAgICAgZm9yY2U6ICFpc1Byb2R1Y3Rpb24sXG4gICAgICAvLyBFeGNsdWRlIGxhcmdlIGRlcGVuZGVuY2llcyBmcm9tIHByZS1idW5kbGluZ1xuICAgICAgZXhjbHVkZTogW1xuICAgICAgICAvLyBFeGNsdWRlIGlmIHRvbyBsYXJnZVxuICAgICAgXVxuICAgIH0sXG5cbiAgICAvLyBFbnZpcm9ubWVudCB2YXJpYWJsZXNcbiAgICBkZWZpbmU6IHtcbiAgICAgIF9fQVBQX1ZFUlNJT05fXzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYubnBtX3BhY2thZ2VfdmVyc2lvbiksXG4gICAgICBfX0JVSUxEX1RJTUVfXzogSlNPTi5zdHJpbmdpZnkobmV3IERhdGUoKS50b0lTT1N0cmluZygpKSxcbiAgICAgIF9fRU5WX186IEpTT04uc3RyaW5naWZ5KG1vZGUpLFxuICAgICAgX19QRVJGT1JNQU5DRV9NT0RFX186IEpTT04uc3RyaW5naWZ5KGlzUHJvZHVjdGlvbilcbiAgICB9LFxuXG4gICAgLy8gRW5oYW5jZWQgQ1NTIGNvbmZpZ3VyYXRpb25cbiAgICBjc3M6IHtcbiAgICAgIC8vIENTUyBtb2R1bGVzXG4gICAgICBtb2R1bGVzOiB7XG4gICAgICAgIGxvY2Fsc0NvbnZlbnRpb246ICdjYW1lbENhc2UnXG4gICAgICB9LFxuICAgICAgLy8gUHJlcHJvY2Vzc29yIG9wdGlvbnNcbiAgICAgIHByZXByb2Nlc3Nvck9wdGlvbnM6IHtcbiAgICAgICAgc2Nzczoge1xuICAgICAgICAgIGFkZGl0aW9uYWxEYXRhOiBgJGVudjogJHttb2RlfTtgXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICAvLyBEZXYgdG9vbHNcbiAgICAgIGRldlNvdXJjZW1hcDogIWlzUHJvZHVjdGlvbixcbiAgICAgIC8vIFBvc3RDU1MgcGx1Z2luc1xuICAgICAgcG9zdGNzczoge1xuICAgICAgICBwbHVnaW5zOiBbXG4gICAgICAgICAgYXV0b3ByZWZpeGVyKCksXG4gICAgICAgIF1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gV29ya2VyIGNvbmZpZ3VyYXRpb25cbiAgICB3b3JrZXI6IHtcbiAgICAgIGZvcm1hdDogJ2VzJyxcbiAgICB9LFxuXG4gICAgLy8gSlNPTiBjb25maWd1cmF0aW9uXG4gICAganNvbjoge1xuICAgICAgbmFtZWRFeHBvcnRzOiB0cnVlLFxuICAgICAgc3RyaW5naWZ5OiBmYWxzZVxuICAgIH1cbiAgfVxufSlcblxuLy8gR2VuZXJhdGUgc3RyaWN0IENTUCBmb3IgcHJvZHVjdGlvblxuZnVuY3Rpb24gZ2VuZXJhdGVDU1AoKSB7XG4gIHJldHVybiBgXG4gICAgZGVmYXVsdC1zcmMgJ3NlbGYnO1xuICAgIHNjcmlwdC1zcmMgJ3NlbGYnICd3YXNtLXVuc2FmZS1ldmFsJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwczovL2Nkbi5zeWxvcy5pbztcbiAgICBzdHlsZS1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyBodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tO1xuICAgIGZvbnQtc3JjICdzZWxmJyBodHRwczovL2ZvbnRzLmdzdGF0aWMuY29tO1xuICAgIGltZy1zcmMgJ3NlbGYnIGRhdGE6IGJsb2I6IGh0dHBzOjtcbiAgICBjb25uZWN0LXNyYyAnc2VsZicgaHR0cHM6Ly9wb2x5Z29uLXJwYy5jb20gaHR0cHM6Ly9hcGkuc3lsb3MuaW8gd3NzOi8vd3Muc3lsb3MuaW87XG4gICAgZnJhbWUtc3JjICdub25lJztcbiAgICBvYmplY3Qtc3JjICdub25lJztcbiAgICBiYXNlLXVyaSAnc2VsZic7XG4gICAgZm9ybS1hY3Rpb24gJ3NlbGYnO1xuICAgIGZyYW1lLWFuY2VzdG9ycyAnbm9uZSc7XG4gICAgdXBncmFkZS1pbnNlY3VyZS1yZXF1ZXN0cztcbiAgYC5yZXBsYWNlKC9cXHN7Mix9L2csICcgJykudHJpbSgpXG59XG5cbi8vIEdlbmVyYXRlIHJlbGF4ZWQgQ1NQIGZvciBzdGFnaW5nXG5mdW5jdGlvbiBnZW5lcmF0ZUNTUFN0YWdpbmcoKSB7XG4gIHJldHVybiBgXG4gICAgZGVmYXVsdC1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyAndW5zYWZlLWV2YWwnO1xuICAgIHNjcmlwdC1zcmMgJ3NlbGYnICd3YXNtLXVuc2FmZS1ldmFsJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwczovL3N0YWdpbmctY2RuLnN5bG9zLmlvO1xuICAgIHN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIGh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb207XG4gICAgZm9udC1zcmMgJ3NlbGYnIGh0dHBzOi8vZm9udHMuZ3N0YXRpYy5jb207XG4gICAgaW1nLXNyYyAnc2VsZicgZGF0YTogYmxvYjogaHR0cHM6O1xuICAgIGNvbm5lY3Qtc3JjICdzZWxmJyBodHRwczovL3JwYy1hbW95LnBvbHlnb24udGVjaG5vbG9neSBodHRwczovL3N0YWdpbmctYXBpLnN5bG9zLmlvIHdzOi8vbG9jYWxob3N0Oio7XG4gICAgZnJhbWUtc3JjICdzZWxmJztcbiAgICBvYmplY3Qtc3JjICdub25lJztcbiAgICBiYXNlLXVyaSAnc2VsZic7XG4gICAgZm9ybS1hY3Rpb24gJ3NlbGYnO1xuICBgLnJlcGxhY2UoL1xcc3syLH0vZywgJyAnKS50cmltKClcbn1cblxuLy8gR2VuZXJhdGUgcmVzb3VyY2UgaGludHMgZm9yIHBlcmZvcm1hbmNlXG5mdW5jdGlvbiBnZW5lcmF0ZVJlc291cmNlSGludHMoKSB7XG4gIHJldHVybiB7XG4gICAgcHJlY29ubmVjdDogW1xuICAgICAgJ2h0dHBzOi8vcG9seWdvbi1ycGMuY29tJyxcbiAgICAgICdodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tJyxcbiAgICAgICdodHRwczovL2ZvbnRzLmdzdGF0aWMuY29tJyxcbiAgICAgICdodHRwczovL2FwaS5zeWxvcy5pbydcbiAgICBdLFxuICAgIHByZWxvYWQ6IFtcbiAgICAgICcvc3RhdGljL2pzL21haW4uanMnLFxuICAgICAgJy9zdGF0aWMvY3NzL21haW4uY3NzJyxcbiAgICAgICcvbWFuaWZlc3QuanNvbidcbiAgICBdLFxuICAgIGRuc1ByZWZldGNoOiBbXG4gICAgICAnaHR0cHM6Ly9wb2x5Z29uLXJwYy5jb20nLFxuICAgICAgJ2h0dHBzOi8vYXBpLnN5bG9zLmlvJ1xuICAgIF1cbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcQ3JhdGVyXFxcXERvd25sb2Fkc1xcXFxTWUxPUyBzeXN0ZW0gLSBORVdcXFxcc3lsb3MtYmxvY2tjaGFpbi1vc1xcXFxzcmNcXFxcdXRpbHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXENyYXRlclxcXFxEb3dubG9hZHNcXFxcU1lMT1Mgc3lzdGVtIC0gTkVXXFxcXHN5bG9zLWJsb2NrY2hhaW4tb3NcXFxcc3JjXFxcXHV0aWxzXFxcXGVudmlyb25tZW50LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9DcmF0ZXIvRG93bmxvYWRzL1NZTE9TJTIwc3lzdGVtJTIwLSUyME5FVy9zeWxvcy1ibG9ja2NoYWluLW9zL3NyYy91dGlscy9lbnZpcm9ubWVudC50c1wiOy8qKlxuICogRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBhbmQgc2VjdXJpdHkgc2V0dGluZ3NcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50Q29uZmlnIHtcbiAgTk9ERV9FTlY6ICdkZXZlbG9wbWVudCcgfCAncHJvZHVjdGlvbicgfCAndGVzdCdcbiAgVklURV9BUFBfVkVSU0lPTjogc3RyaW5nXG4gIFZJVEVfQVBJX0JBU0VfVVJMOiBzdHJpbmdcbiAgVklURV9TVVBBQkFTRV9VUkw6IHN0cmluZ1xuICBWSVRFX1NVUEFCQVNFX0FOT05fS0VZOiBzdHJpbmdcbiAgVklURV9XQUxMRVRDT05ORUNUX1BST0pFQ1RfSUQ6IHN0cmluZ1xuICBWSVRFX1NFTlRSWV9EU04/OiBzdHJpbmdcbiAgVklURV9FTkFCTEVfRVJST1JfTE9HR0lORzogYm9vbGVhblxuICBWSVRFX0VOQUJMRV9BTkFMWVRJQ1M6IGJvb2xlYW5cbiAgVklURV9DU1BfRU5BQkxFRDogYm9vbGVhblxuICBWSVRFX1NFQ1VSSVRZX0hFQURFUlNfRU5BQkxFRDogYm9vbGVhblxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyaXR5Q29uZmlnIHtcbiAgZW5hYmxlQ1NQOiBib29sZWFuXG4gIGVuYWJsZVNlY3VyaXR5SGVhZGVyczogYm9vbGVhblxuICBhbGxvd2VkT3JpZ2luczogc3RyaW5nW11cbiAgbWF4RmlsZVNpemU6IG51bWJlclxuICByYXRlTGltaXRQZXJNaW51dGU6IG51bWJlclxuICBzZXNzaW9uVGltZW91dDogbnVtYmVyXG4gIGVuYWJsZUhTVFM6IGJvb2xlYW5cbn1cblxuY2xhc3MgRW52aXJvbm1lbnRNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IEVudmlyb25tZW50TWFuYWdlclxuICBwcml2YXRlIGNvbmZpZzogRW52aXJvbm1lbnRDb25maWdcbiAgcHJpdmF0ZSBzZWN1cml0eUNvbmZpZzogU2VjdXJpdHlDb25maWdcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuY29uZmlnID0gdGhpcy5sb2FkQ29uZmlnKClcbiAgICB0aGlzLnNlY3VyaXR5Q29uZmlnID0gdGhpcy5sb2FkU2VjdXJpdHlDb25maWcoKVxuICB9XG5cbiAgc3RhdGljIGdldEluc3RhbmNlKCk6IEVudmlyb25tZW50TWFuYWdlciB7XG4gICAgaWYgKCFFbnZpcm9ubWVudE1hbmFnZXIuaW5zdGFuY2UpIHtcbiAgICAgIEVudmlyb25tZW50TWFuYWdlci5pbnN0YW5jZSA9IG5ldyBFbnZpcm9ubWVudE1hbmFnZXIoKVxuICAgIH1cbiAgICByZXR1cm4gRW52aXJvbm1lbnRNYW5hZ2VyLmluc3RhbmNlXG4gIH1cblxuICBwcml2YXRlIGxvYWRDb25maWcoKTogRW52aXJvbm1lbnRDb25maWcge1xuICAgIGNvbnN0IHJlcXVpcmVkVmFycyA9IFtcbiAgICAgICdWSVRFX0FQSV9CQVNFX1VSTCcsXG4gICAgICAnVklURV9TVVBBQkFTRV9VUkwnLCBcbiAgICAgICdWSVRFX1NVUEFCQVNFX0FOT05fS0VZJyxcbiAgICAgICdWSVRFX1dBTExFVENPTk5FQ1RfUFJPSkVDVF9JRCdcbiAgICBdXG5cbiAgICAvLyBDaGVjayBmb3IgcmVxdWlyZWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGluIHByb2R1Y3Rpb25cbiAgICBpZiAoaW1wb3J0Lm1ldGEuZW52LlBST0QpIHtcbiAgICAgIGZvciAoY29uc3QgdmFyTmFtZSBvZiByZXF1aXJlZFZhcnMpIHtcbiAgICAgICAgaWYgKCFpbXBvcnQubWV0YS5lbnZbdmFyTmFtZV0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE1pc3NpbmcgcmVxdWlyZWQgZW52aXJvbm1lbnQgdmFyaWFibGU6ICR7dmFyTmFtZX1gKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIE5PREVfRU5WOiAoaW1wb3J0Lm1ldGEuZW52LlZJVEVfTk9ERV9FTlYgYXMgRW52aXJvbm1lbnRDb25maWdbJ05PREVfRU5WJ10pIHx8ICdkZXZlbG9wbWVudCcsXG4gICAgICBWSVRFX0FQUF9WRVJTSU9OOiBpbXBvcnQubWV0YS5lbnYuVklURV9BUFBfVkVSU0lPTiB8fCAnMS4wLjAnLFxuICAgICAgVklURV9BUElfQkFTRV9VUkw6IGltcG9ydC5tZXRhLmVudi5WSVRFX0FQSV9CQVNFX1VSTCB8fCAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgIFZJVEVfU1VQQUJBU0VfVVJMOiBpbXBvcnQubWV0YS5lbnYuVklURV9TVVBBQkFTRV9VUkwgfHwgJycsXG4gICAgICBWSVRFX1NVUEFCQVNFX0FOT05fS0VZOiBpbXBvcnQubWV0YS5lbnYuVklURV9TVVBBQkFTRV9BTk9OX0tFWSB8fCAnJyxcbiAgICAgIFZJVEVfV0FMTEVUQ09OTkVDVF9QUk9KRUNUX0lEOiBpbXBvcnQubWV0YS5lbnYuVklURV9XQUxMRVRDT05ORUNUX1BST0pFQ1RfSUQgfHwgJycsXG4gICAgICBWSVRFX1NFTlRSWV9EU046IGltcG9ydC5tZXRhLmVudi5WSVRFX1NFTlRSWV9EU04sXG4gICAgICBWSVRFX0VOQUJMRV9FUlJPUl9MT0dHSU5HOiBpbXBvcnQubWV0YS5lbnYuVklURV9FTkFCTEVfRVJST1JfTE9HR0lORyA9PT0gJ3RydWUnLFxuICAgICAgVklURV9FTkFCTEVfQU5BTFlUSUNTOiBpbXBvcnQubWV0YS5lbnYuVklURV9FTkFCTEVfQU5BTFlUSUNTID09PSAndHJ1ZScsXG4gICAgICBWSVRFX0NTUF9FTkFCTEVEOiBpbXBvcnQubWV0YS5lbnYuVklURV9DU1BfRU5BQkxFRCA9PT0gJ3RydWUnLFxuICAgICAgVklURV9TRUNVUklUWV9IRUFERVJTX0VOQUJMRUQ6IGltcG9ydC5tZXRhLmVudi5WSVRFX1NFQ1VSSVRZX0hFQURFUlNfRU5BQkxFRCA9PT0gJ3RydWUnXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBsb2FkU2VjdXJpdHlDb25maWcoKTogU2VjdXJpdHlDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBlbmFibGVDU1A6IHRoaXMuY29uZmlnLlZJVEVfQ1NQX0VOQUJMRUQsXG4gICAgICBlbmFibGVTZWN1cml0eUhlYWRlcnM6IHRoaXMuY29uZmlnLlZJVEVfU0VDVVJJVFlfSEVBREVSU19FTkFCTEVELFxuICAgICAgYWxsb3dlZE9yaWdpbnM6IFtcbiAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3MycsXG4gICAgICAgICdodHRwczovL2xvY2FsaG9zdDo1MTczJyxcbiAgICAgICAgLi4uKHRoaXMuY29uZmlnLlZJVEVfQVBJX0JBU0VfVVJMID8gW3RoaXMuY29uZmlnLlZJVEVfQVBJX0JBU0VfVVJMXSA6IFtdKVxuICAgICAgXSxcbiAgICAgIG1heEZpbGVTaXplOiA1ICogMTAyNCAqIDEwMjQsIC8vIDVNQlxuICAgICAgcmF0ZUxpbWl0UGVyTWludXRlOiAxMDAsXG4gICAgICBzZXNzaW9uVGltZW91dDogMzAgKiA2MCAqIDEwMDAsIC8vIDMwIG1pbnV0ZXNcbiAgICAgIGVuYWJsZUhTVFM6IGltcG9ydC5tZXRhLmVudi5QUk9EXG4gICAgfVxuICB9XG5cbiAgZ2V0Q29uZmlnKCk6IEVudmlyb25tZW50Q29uZmlnIHtcbiAgICByZXR1cm4geyAuLi50aGlzLmNvbmZpZyB9XG4gIH1cblxuICBnZXRTZWN1cml0eUNvbmZpZygpOiBTZWN1cml0eUNvbmZpZyB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5zZWN1cml0eUNvbmZpZyB9XG4gIH1cblxuICBpc0RldmVsb3BtZW50KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmNvbmZpZy5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50J1xuICB9XG5cbiAgaXNQcm9kdWN0aW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmNvbmZpZy5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nXG4gIH1cblxuICBpc1Rlc3QoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuY29uZmlnLk5PREVfRU5WID09PSAndGVzdCdcbiAgfVxuXG4gIHNob3VsZEVuYWJsZUVycm9yTG9nZ2luZygpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5jb25maWcuVklURV9FTkFCTEVfRVJST1JfTE9HR0lORyB8fCB0aGlzLmlzRGV2ZWxvcG1lbnQoKVxuICB9XG5cbiAgc2hvdWxkRW5hYmxlQW5hbHl0aWNzKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmNvbmZpZy5WSVRFX0VOQUJMRV9BTkFMWVRJQ1MgJiYgdGhpcy5pc1Byb2R1Y3Rpb24oKVxuICB9XG5cbiAgLy8gU2VjdXJpdHkgdmFsaWRhdGlvblxuICB2YWxpZGF0ZUNvbmZpZygpOiBzdHJpbmdbXSB7XG4gICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdXG5cbiAgICAvLyBDaGVjayBmb3IgaW5zZWN1cmUgY29uZmlndXJhdGlvbnMgaW4gcHJvZHVjdGlvblxuICAgIGlmICh0aGlzLmlzUHJvZHVjdGlvbigpKSB7XG4gICAgICBpZiAodGhpcy5jb25maWcuVklURV9BUElfQkFTRV9VUkw/LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSkge1xuICAgICAgICBlcnJvcnMucHVzaCgnQVBJIFVSTCBzaG91bGQgdXNlIEhUVFBTIGluIHByb2R1Y3Rpb24nKVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAoIXRoaXMuY29uZmlnLlZJVEVfU1VQQUJBU0VfVVJMIHx8ICF0aGlzLmNvbmZpZy5WSVRFX1NVUEFCQVNFX0FOT05fS0VZKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdTdXBhYmFzZSBjb25maWd1cmF0aW9uIGlzIHJlcXVpcmVkIGluIHByb2R1Y3Rpb24nKVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuc2VjdXJpdHlDb25maWcuZW5hYmxlQ1NQKSB7XG4gICAgICAgIGVycm9ycy5wdXNoKCdDU1Agc2hvdWxkIGJlIGVuYWJsZWQgaW4gcHJvZHVjdGlvbicpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGVycm9yc1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBlbnZNYW5hZ2VyID0gRW52aXJvbm1lbnRNYW5hZ2VyLmdldEluc3RhbmNlKClcblxuLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvbnNcbmV4cG9ydCBjb25zdCBnZXRDU1BEaXJlY3RpdmVzID0gKCk6IHN0cmluZyA9PiB7XG4gIGNvbnN0IGNvbmZpZyA9IGVudk1hbmFnZXIuZ2V0U2VjdXJpdHlDb25maWcoKVxuICBcbiAgaWYgKCFjb25maWcuZW5hYmxlQ1NQKSByZXR1cm4gJydcblxuICBjb25zdCBkaXJlY3RpdmVzID0gW1xuICAgIFwiZGVmYXVsdC1zcmMgJ3NlbGYnXCIsXG4gICAgXCJzY3JpcHQtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwczovL2Nkbi5qc2RlbGl2ci5uZXQgaHR0cHM6Ly91bnBrZy5jb21cIixcbiAgICBcInN0eWxlLXNyYyAnc2VsZicgJ3Vuc2FmZS1pbmxpbmUnIGh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb21cIixcbiAgICBcImZvbnQtc3JjICdzZWxmJyBodHRwczovL2ZvbnRzLmdzdGF0aWMuY29tXCIsXG4gICAgXCJpbWctc3JjICdzZWxmJyBkYXRhOiBodHRwczogYmxvYjpcIixcbiAgICBcImNvbm5lY3Qtc3JjICdzZWxmJyB3c3M6IGh0dHBzOlwiLFxuICAgIFwiZnJhbWUtc3JjICdub25lJ1wiLFxuICAgIFwib2JqZWN0LXNyYyAnbm9uZSdcIixcbiAgICBcImJhc2UtdXJpICdzZWxmJ1wiLFxuICAgIFwiZm9ybS1hY3Rpb24gJ3NlbGYnXCJcbiAgXVxuXG4gIC8vIEFkZCBzcGVjaWZpYyBhbGxvd2FuY2VzIGZvciBkZXZlbG9wbWVudFxuICBpZiAoZW52TWFuYWdlci5pc0RldmVsb3BtZW50KCkpIHtcbiAgICBkaXJlY3RpdmVzLnB1c2goXCJzY3JpcHQtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwOi8vbG9jYWxob3N0OipcIilcbiAgICBkaXJlY3RpdmVzLnB1c2goXCJjb25uZWN0LXNyYyAnc2VsZicgd3M6IGh0dHA6IGh0dHBzOlwiKVxuICB9XG5cbiAgcmV0dXJuIGRpcmVjdGl2ZXMuam9pbignOyAnKVxufVxuXG5leHBvcnQgY29uc3QgZ2V0U2VjdXJpdHlIZWFkZXJzID0gKCk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPT4ge1xuICBjb25zdCBjb25maWcgPSBlbnZNYW5hZ2VyLmdldFNlY3VyaXR5Q29uZmlnKClcbiAgY29uc3QgaGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9XG5cbiAgaWYgKGNvbmZpZy5lbmFibGVTZWN1cml0eUhlYWRlcnMpIHtcbiAgICBoZWFkZXJzWydYLUNvbnRlbnQtVHlwZS1PcHRpb25zJ10gPSAnbm9zbmlmZidcbiAgICBoZWFkZXJzWydYLUZyYW1lLU9wdGlvbnMnXSA9ICdERU5ZJ1xuICAgIGhlYWRlcnNbJ1gtWFNTLVByb3RlY3Rpb24nXSA9ICcxOyBtb2RlPWJsb2NrJ1xuICAgIGhlYWRlcnNbJ1JlZmVycmVyLVBvbGljeSddID0gJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nXG4gICAgXG4gICAgaWYgKGNvbmZpZy5lbmFibGVIU1RTKSB7XG4gICAgICBoZWFkZXJzWydTdHJpY3QtVHJhbnNwb3J0LVNlY3VyaXR5J10gPSAnbWF4LWFnZT0zMTUzNjAwMDsgaW5jbHVkZVN1YkRvbWFpbnM7IHByZWxvYWQnXG4gICAgfVxuXG4gICAgaGVhZGVyc1snUGVybWlzc2lvbnMtUG9saWN5J10gPSAnZ2VvbG9jYXRpb249KCksIG1pY3JvcGhvbmU9KCksIGNhbWVyYT0oKSdcbiAgfVxuXG4gIHJldHVybiBoZWFkZXJzXG59XG5cbi8vIFZhbGlkYXRlIGVudmlyb25tZW50IHNldHVwXG5leHBvcnQgY29uc3QgdmFsaWRhdGVFbnZpcm9ubWVudCA9ICgpOiB2b2lkID0+IHtcbiAgY29uc3QgZXJyb3JzID0gZW52TWFuYWdlci52YWxpZGF0ZUNvbmZpZygpXG4gIFxuICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zb2xlLmVycm9yKCdFbnZpcm9ubWVudCB2YWxpZGF0aW9uIGVycm9yczonLCBlcnJvcnMpXG4gICAgaWYgKGVudk1hbmFnZXIuaXNQcm9kdWN0aW9uKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRW52aXJvbm1lbnQgY29uZmlndXJhdGlvbiBlcnJvcnM6ICR7ZXJyb3JzLmpvaW4oJywgJyl9YClcbiAgICB9XG4gIH1cbn1cblxuLy8gVHlwZS1zYWZlIGVudmlyb25tZW50IHZhcmlhYmxlIGdldHRlclxuZXhwb3J0IGNvbnN0IGdldEVudlZhciA9IDxUIGV4dGVuZHMgc3RyaW5nPihcbiAga2V5OiBzdHJpbmcsIFxuICBkZWZhdWx0VmFsdWU6IFQsIFxuICB2YWxpZGF0b3I/OiAodmFsdWU6IHN0cmluZykgPT4gdmFsdWUgaXMgVFxuKTogVCA9PiB7XG4gIGNvbnN0IHZhbHVlID0gaW1wb3J0Lm1ldGEuZW52W2tleV0gfHwgZGVmYXVsdFZhbHVlXG4gIFxuICBpZiAodmFsaWRhdG9yICYmICF2YWxpZGF0b3IodmFsdWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHZhbHVlIGZvciBlbnZpcm9ubWVudCB2YXJpYWJsZSAke2tleX06ICR7dmFs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
