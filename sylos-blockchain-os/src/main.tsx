import { Buffer } from 'buffer'
  ; (globalThis as any).Buffer = Buffer

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setupGlobalErrorHandlers } from './utils/errorHandler'
import { validateEnvironment, getCSPDirectives, getSecurityHeaders } from './utils/environment'
import './index.css'

// Validate environment configuration (warns only, never throws)
validateEnvironment()

// Setup global error handlers
setupGlobalErrorHandlers()

// Apply security configurations
const applySecurityConfigs = () => {
  try {
    const csp = getCSPDirectives()
    if (csp) {
      const meta = document.createElement('meta')
      meta.httpEquiv = 'Content-Security-Policy'
      meta.content = csp
      document.head.appendChild(meta)
    }

    const headers = getSecurityHeaders()
    if (Object.keys(headers).length > 0) {
      console.log('Security headers configured:', headers)
    }
  } catch (error) {
    console.warn('[SylOS] Failed to apply security configs:', error)
  }
}

applySecurityConfigs()

// Boot the application with a fallback if React fails to render
try {
  const root = ReactDOM.createRoot(document.getElementById('root')!)

  root.render(
    <React.StrictMode>
      <ErrorBoundary level="critical" enableRetry={true}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
} catch (error) {
  console.error('[SylOS] Fatal bootstrap error:', error)
  const rootEl = document.getElementById('root')
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#060918;color:#f0f2ff;font-family:system-ui,sans-serif">
        <div style="text-align:center;max-width:480px;padding:2rem">
          <h1 style="font-size:1.5rem;margin-bottom:1rem;color:#6366f1">SylOS failed to start</h1>
          <p style="color:#a5b0d0;margin-bottom:1.5rem">${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button onclick="location.reload()" style="padding:0.75rem 1.5rem;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem">
            Reload
          </button>
        </div>
      </div>
    `
  }
}
