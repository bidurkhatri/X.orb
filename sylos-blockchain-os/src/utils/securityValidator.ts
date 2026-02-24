/**
 * Security validation and runtime checks
 */

import { envManager, getSecurityHeaders } from './environment'

export interface SecurityCheck {
  name: string
  passed: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  recommendation?: string
}

export class SecurityValidator {
  private static checks: SecurityCheck[] = []

  static runSecurityChecks(): SecurityCheck[] {
    this.checks = [
      this.checkHttps(),
      this.checkSecurityHeaders(),
      this.checkCSP(),
      this.checkEnvironmentVars(),
      this.checkConsoleAccess(),
      this.checkLocalStorage(),
      this.checkWebRTC(),
      this.checkFeatures(),
      this.checkErrorExposure(),
      this.checkInputValidation()
    ]

    return this.checks
  }

  private static checkHttps(): SecurityCheck {
    const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
    return {
      name: 'HTTPS Connection',
      passed: isHttps || envManager.isDevelopment(),
      severity: envManager.isProduction() ? 'critical' : 'low',
      message: isHttps ? 'Using secure HTTPS connection' : 'Not using HTTPS',
      recommendation: envManager.isProduction() ? 'Enable HTTPS in production' : undefined
    }
  }

  private static checkSecurityHeaders(): SecurityCheck {
    const headers = getSecurityHeaders()
    const requiredHeaders = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection']
    const hasHeaders = requiredHeaders.every(header => Object.keys(headers).includes(header))
    
    return {
      name: 'Security Headers',
      passed: !envManager.isProduction() || hasHeaders,
      severity: hasHeaders ? 'low' : 'high',
      message: hasHeaders ? 'Security headers configured' : 'Missing security headers',
      recommendation: hasHeaders ? undefined : 'Configure security headers in your server'
    }
  }

  private static checkCSP(): SecurityCheck {
    const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')
    const hasCSP = metaTags.length > 0
    
    return {
      name: 'Content Security Policy',
      passed: !envManager.isProduction() || hasCSP,
      severity: hasCSP ? 'low' : 'high',
      message: hasCSP ? 'CSP header present' : 'No CSP header found',
      recommendation: hasCSP ? undefined : 'Configure Content Security Policy'
    }
  }

  private static checkEnvironmentVars(): SecurityCheck {
    const config = envManager.getConfig()
    const requiredVars = ['VITE_API_BASE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
    const missingVars = requiredVars.filter(varName => !config[varName as keyof typeof config])
    
    return {
      name: 'Environment Variables',
      passed: missingVars.length === 0 || envManager.isDevelopment(),
      severity: missingVars.length > 0 ? 'medium' : 'low',
      message: missingVars.length === 0 ? 'All required environment variables set' : `Missing: ${missingVars.join(', ')}`,
      recommendation: missingVars.length > 0 ? 'Configure missing environment variables' : undefined
    }
  }

  private static checkConsoleAccess(): SecurityCheck {
    // Check if console is accessible (disabled in production)
    const hasConsole = typeof console !== 'undefined' && 
                      typeof console.log === 'function' &&
                      typeof console.error === 'function'
    
    return {
      name: 'Console Access',
      passed: hasConsole || envManager.isDevelopment(),
      severity: envManager.isProduction() && hasConsole ? 'medium' : 'low',
      message: hasConsole ? 'Console access available' : 'Console access restricted',
      recommendation: envManager.isProduction() && hasConsole ? 'Disable console access in production' : undefined
    }
  }

  private static checkLocalStorage(): SecurityCheck {
    try {
      const testKey = 'security_test'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return {
        name: 'Local Storage',
        passed: true,
        severity: 'low',
        message: 'Local storage accessible'
      }
    } catch (error) {
      return {
        name: 'Local Storage',
        passed: false,
        severity: 'medium',
        message: 'Local storage not accessible',
        recommendation: 'Check if local storage is blocked by browser settings'
      }
    }
  }

  private static checkWebRTC(): SecurityCheck {
    const hasWebRTC = 'RTCPeerConnection' in window || 'webkitRTCPeerConnection' in window
    return {
      name: 'WebRTC Support',
      passed: hasWebRTC,
      severity: 'low',
      message: hasWebRTC ? 'WebRTC supported' : 'WebRTC not supported',
      recommendation: hasWebRTC ? undefined : 'WebRTC may be required for some features'
    }
  }

  private static checkFeatures(): SecurityCheck {
    const features = {
      'Service Worker': 'serviceWorker' in navigator,
      'Web Crypto': 'crypto' in window,
      'Fetch API': 'fetch' in window,
      'Promise': 'Promise' in window
    }

    const supportedFeatures = Object.entries(features).filter(([_, supported]) => supported).length
    const totalFeatures = Object.keys(features).length

    return {
      name: 'Feature Support',
      passed: supportedFeatures === totalFeatures,
      severity: supportedFeatures === totalFeatures ? 'low' : 'medium',
      message: `${supportedFeatures}/${totalFeatures} features supported`,
      recommendation: supportedFeatures === totalFeatures ? undefined : 'Some features may not work properly'
    }
  }

  private static checkErrorExposure(): SecurityCheck {
    // Check if error messages might expose sensitive information
    const errorMessages = document.querySelectorAll('[class*="error"], [class*="Error"]')
    const hasDetailedErrors = Array.from(errorMessages).some(element => {
      const text = element.textContent || ''
      return text.includes('stack') || text.includes('trace') || text.includes('error:')
    })

    return {
      name: 'Error Message Exposure',
      passed: !hasDetailedErrors || envManager.isDevelopment(),
      severity: hasDetailedErrors && envManager.isProduction() ? 'medium' : 'low',
      message: hasDetailedErrors ? 'Detailed error messages found' : 'Error messages sanitized',
      recommendation: hasDetailedErrors && envManager.isProduction() ? 'Sanitize error messages in production' : undefined
    }
  }

  private static checkInputValidation(): SecurityCheck {
    // Check if form inputs have validation attributes
    const inputs = document.querySelectorAll('input, textarea, select')
    const validatedInputs = Array.from(inputs).filter(input => {
      return input.hasAttribute('required') || 
             input.hasAttribute('pattern') ||
             input.hasAttribute('min') ||
             input.hasAttribute('max')
    })

    const validationRatio = inputs.length > 0 ? validatedInputs.length / inputs.length : 1

    return {
      name: 'Input Validation',
      passed: validationRatio > 0.5,
      severity: validationRatio > 0.5 ? 'low' : 'medium',
      message: `${Math.round(validationRatio * 100)}% of inputs have validation`,
      recommendation: validationRatio <= 0.5 ? 'Add validation attributes to form inputs' : undefined
    }
  }

  static getSecurityReport(): { passed: number; failed: number; checks: SecurityCheck[] } {
    const checks = this.runSecurityChecks()
    const passed = checks.filter(check => check.passed).length
    const failed = checks.filter(check => !check.passed).length

    return { passed, failed, checks }
  }

  static logSecurityReport(): void {
    const report = this.getSecurityReport()
    
    console.group('🔒 Security Report')
    console.log(`✅ Passed: ${report.passed}`)
    console.log(`❌ Failed: ${report.failed}`)
    console.log(`📊 Success Rate: ${Math.round((report.passed / (report.passed + report.failed)) * 100)}%`)
    
    report.checks.forEach(check => {
      const icon = check.passed ? '✅' : '❌'
      const color = check.passed ? 'green' : 'red'
      console.log(`%c${icon} ${check.name}: ${check.message}`, `color: ${color}`)
      
      if (check.recommendation && !check.passed) {
        console.log(`💡 ${check.recommendation}`)
      }
    })
    
    console.groupEnd()
  }
}

// Run security checks on load in development
if (envManager.isDevelopment()) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => SecurityValidator.logSecurityReport(), 1000)
    })
  } else {
    setTimeout(() => SecurityValidator.logSecurityReport(), 1000)
  }
}