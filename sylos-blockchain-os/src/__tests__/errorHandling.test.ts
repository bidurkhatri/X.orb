/**
 * Basic tests for error handling implementation
 * Run with: npm test
 */

import { Validator, Sanitizer } from '../utils/validation'
import { SylosError, errorLogger } from '../utils/errorHandler'
import { envManager } from '../utils/environment'

describe('Error Handling Implementation', () => {
  describe('Validation', () => {
    test('should validate Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b8D4E9F4B1b4B7b6C9'
      const invalidAddress = '0x123'
      
      const validResult = Validator.validateEthereumAddress(validAddress)
      const invalidResult = Validator.validateEthereumAddress(invalidAddress)
      
      expect(validResult.isValid).toBe(true)
      expect(invalidResult.isValid).toBe(false)
    })

    test('should validate email addresses', () => {
      const validEmail = 'user@example.com'
      const invalidEmail = 'invalid-email'
      
      const validResult = Validator.validateEmail(validEmail)
      const invalidResult = Validator.validateEmail(invalidEmail)
      
      expect(validResult.isValid).toBe(true)
      expect(invalidResult.isValid).toBe(false)
    })

    test('should validate amounts', () => {
      const validAmount = '10.5'
      const invalidAmount = '-5'
      const tooLargeAmount = '2000000'
      
      const validResult = Validator.validateAmount(validAmount)
      const invalidResult1 = Validator.validateAmount(invalidAmount)
      const invalidResult2 = Validator.validateAmount(tooLargeAmount)
      
      expect(validResult.isValid).toBe(true)
      expect(invalidResult1.isValid).toBe(false)
      expect(invalidResult2.isValid).toBe(false)
    })
  })

  describe('Sanitization', () => {
    test('should sanitize strings', () => {
      const input = '<script>alert("xss")</script>Hello World'
      const sanitized = Sanitizer.sanitizeString(input)
      
      expect(sanitized).toBe('scriptalert(xss)/scriptHello World')
    })

    test('should sanitize HTML', () => {
      const input = '<div onclick="alert()">Test</div>'
      const sanitized = Sanitizer.sanitizeHTML(input)
      
      expect(sanitized).toContain('&lt;')
      expect(sanitized).toContain('&gt;')
    })

    test('should sanitize Ethereum addresses', () => {
      const input = '0x742D35Cc6634C0532925a3b8D4E9F4B1b4B7b6C9'
      const sanitized = Sanitizer.sanitizeEthereumAddress(input)
      
      expect(sanitized).toBe('0x742d35cc6634c0532925a3b8d4e9f4b1b4b7b6c9')
    })
  })

  describe('Error Classes', () => {
    test('should create SylosError with correct properties', () => {
      const error = new SylosError('Test error', 'high', { test: true })
      
      expect(error.message).toBe('Test error')
      expect(error.severity).toBe('high')
      expect(error.context).toEqual({ test: true })
      expect(error.id).toBeDefined()
      expect(error.timestamp).toBeInstanceOf(Date)
    })

    test('should create ValidationError with field info', () => {
      const error = new ValidationError('email', 'invalid', 'Invalid email')
      
      expect(error.field).toBe('email')
      expect(error.value).toBe('invalid')
      expect(error.message).toContain('email')
    })

    test('should create WalletError with wallet details', () => {
      const error = new WalletError('MetaMask', 'connect', 'User rejected')
      
      expect(error.walletType).toBe('MetaMask')
      expect(error.action).toBe('connect')
      expect(error.message).toContain('MetaMask')
    })
  })

  describe('Environment Management', () => {
    test('should load environment configuration', () => {
      const config = envManager.getConfig()
      
      expect(config).toHaveProperty('NODE_ENV')
      expect(config).toHaveProperty('VITE_APP_VERSION')
      expect(config).toHaveProperty('VITE_API_BASE_URL')
    })

    test('should detect environment correctly', () => {
      expect(envManager.isDevelopment()).toBeDefined()
      expect(envManager.isProduction()).toBeDefined()
      expect(envManager.isTest()).toBeDefined()
    })

    test('should validate environment', () => {
      const errors = envManager.validateConfig()
      
      // In development, validation should not throw critical errors
      expect(Array.isArray(errors)).toBe(true)
    })
  })

  describe('Error Logging', () => {
    test('should log errors with context', () => {
      const initialErrorCount = errorLogger.getErrors().length
      const testError = new Error('Test error for logging')
      
      const loggedError = errorLogger.log(testError, { componentStack: 'TestComponent' })
      
      expect(loggedError.id).toBeDefined()
      expect(loggedError.severity).toBeDefined()
      expect(errorLogger.getErrors().length).toBeGreaterThan(initialErrorCount)
    })

    test('should clear errors', () => {
      errorLogger.clearErrors()
      
      expect(errorLogger.getErrors().length).toBe(0)
    })
  })

  describe('Form Validation Hook', () => {
    test('should validate form data', () => {
      const validationRules = {
        name: { required: true, minLength: 2 },
        email: { required: true }
      }
      
      // This would need React testing library to fully test
      // For now, just test the validation logic
      const nameResult = Validator.validateString('John', validationRules.name)
      const emailResult = Validator.validateString('', validationRules.email)
      
      expect(nameResult.isValid).toBe(true)
      expect(emailResult.isValid).toBe(false)
    })
  })

  describe('Security Validator', () => {
    test('should run security checks', () => {
      const { SecurityValidator } = require('../utils/securityValidator')
      const report = SecurityValidator.getSecurityReport()
      
      expect(report).toHaveProperty('passed')
      expect(report).toHaveProperty('failed')
      expect(report).toHaveProperty('checks')
      expect(Array.isArray(report.checks)).toBe(true)
    })
  })
})

// Test utilities
export const testUtils = {
  createMockError: () => new Error('Test error'),
  createMockValidationError: () => new ValidationError('test', 'value', 'Test validation error'),
  createMockNetworkError: () => new NetworkError('/api/test', 'Request failed', 500),
  createMockWalletError: () => new WalletError('MetaMask', 'connect', 'Connection failed')
}

// Mock DOM elements for testing
global.document = {
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  createElement: jest.fn(),
  head: { appendChild: jest.fn() }
}

global.navigator = {
  userAgent: 'Mozilla/5.0 (Test)',
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
}

global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn()
}