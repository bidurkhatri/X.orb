import { Buffer } from 'buffer'
  ; (globalThis as any).Buffer = Buffer

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setupGlobalErrorHandlers } from './utils/errorHandler'
import { validateEnvironment, getCSPDirectives, getSecurityHeaders } from './utils/environment'
import './index.css'

// Validate environment configuration
validateEnvironment()

// Setup global error handlers
setupGlobalErrorHandlers()

// Apply security configurations
const applySecurityConfigs = () => {
  // Apply CSP headers
  const csp = getCSPDirectives()
  if (csp) {
    const meta = document.createElement('meta')
    meta.httpEquiv = 'Content-Security-Policy'
    meta.content = csp
    document.head.appendChild(meta)
  }

  // Apply security headers (these would be applied by the server in production)
  const headers = getSecurityHeaders()
  if (Object.keys(headers).length > 0) {
    console.log('Security headers configured:', headers)
  }

  // Set secure cookie attributes (if applicable)
  if (import.meta.env.PROD) {
    document.cookie = 'secure=true; SameSite=Strict; HttpOnly'
  }
}

applySecurityConfigs()

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ErrorBoundary level="critical" enableRetry={true}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
