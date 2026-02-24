# SylOS Error Handling Implementation Guide

## Quick Start

This implementation provides production-ready error handling and security for the SylOS Blockchain OS web application. The following guide covers the key components and their usage.

## Core Components

### 1. Error Boundaries

#### Basic Usage
```tsx
import { ErrorBoundary } from './components/ErrorBoundary'

// Component-level error boundary
<ErrorBoundary level="component" enableRetry={true}>
  <MyComponent />
</ErrorBoundary>

// Page-level error boundary
<ErrorBoundary level="page" onError={handlePageError}>
  <MyPageComponent />
</ErrorBoundary>

// Critical app-level boundary
<ErrorBoundary level="critical" enableRetry={true}>
  <App />
</ErrorBoundary>
```

#### Higher-Order Component
```tsx
import { withErrorBoundary } from './components/ErrorBoundary'

const SafeComponent = withErrorBoundary(MyComponent, {
  level: 'component',
  enableRetry: true
})
```

### 2. Error Logging

#### Manual Error Logging
```tsx
import { errorLogger, SylosError, WalletError } from './utils/errorHandler'

try {
  // Some operation
  await riskyOperation()
} catch (error) {
  const sylosError = new SylosError(
    'Failed to connect wallet',
    'high',
    { walletType: 'MetaMask', action: 'connect' }
  )
  
  errorLogger.log(sylosError, {
    componentStack: 'WalletComponent',
    timestamp: new Date(),
    userAgent: navigator.userAgent
  })
}
```

#### Error Types
```tsx
import { 
  SylosError,      // General application error
  ValidationError, // Input validation error
  NetworkError,    // Network/API error
  WalletError      // Wallet operation error
} from './utils/errorHandler'

// Validation error
throw new ValidationError('email', userEmail, 'Invalid email format')

// Network error
throw new NetworkError('/api/users', 'Request timeout', 408)

// Wallet error
throw new WalletError('MetaMask', 'connect', 'User rejected connection')
```

### 3. Input Validation

#### String Validation
```tsx
import { Validator, Sanitizer } from './utils/validation'

// Email validation
const emailResult = Validator.validateEmail(userEmail)
if (!emailResult.isValid) {
  showError(emailResult.errors[0])
  return
}

// Ethereum address validation
const addressResult = Validator.validateEthereumAddress(walletAddress)
if (!addressResult.isValid) {
  showError(addressResult.errors[0])
  return
}

// Custom validation rules
const passwordResult = Validator.validatePassword(password, {
  required: true,
  minLength: 8,
  custom: (value) => {
    if (!/(?=.*[a-z])/.test(value)) {
      return 'Password must contain at least one lowercase letter'
    }
    return true
  }
})
```

#### Sanitization
```tsx
import { Sanitizer } from './utils/validation'

// Sanitize user input
const safeInput = Sanitizer.sanitizeString(userInput)

// Sanitize HTML content
const safeHTML = Sanitizer.sanitizeHTML(userHTML)

// Sanitize filename
const safeFilename = Sanitizer.sanitizeFilename(userFilename)

// Sanitize URL
try {
  const safeURL = Sanitizer.sanitizeURL(userURL)
} catch (error) {
  // Handle invalid URL
}
```

### 4. Loading States

#### Basic Loading Components
```tsx
import { 
  LoadingSpinner, 
  LoadingPage, 
  LoadingInline,
  SkeletonLoader,
  StatusIndicator
} from './components/LoadingStates'

// Spinner
<LoadingSpinner size="lg" color="primary" />

// Full page loading
<LoadingPage 
  message="Initializing SylOS..."
  progress={65}
  showProgress={true}
/>

// Inline loading
<LoadingInline message="Loading data..." size="md" />

// Status indicator
<StatusIndicator 
  status="loading|success|error|warning"
  message="Operation status"
/>

// Skeleton loading
<div>
  <SkeletonLoader className="h-4 w-full mb-2" />
  <SkeletonLoader className="h-4 w-3/4" />
</div>
```

#### Toast Notifications
```tsx
import { useToast } from './components/LoadingStates'

function MyComponent() {
  const { success, error, warning, info } = useToast()

  const handleSuccess = () => {
    success('Operation Completed', 'Data saved successfully')
  }

  const handleError = () => {
    error('Operation Failed', 'Please try again later')
  }

  const handleWarning = () => {
    warning('Warning', 'This action cannot be undone')
  }

  const handleInfo = () => {
    info('Information', 'New features available')
  }

  return (
    <div>
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
      <button onClick={handleWarning}>Warning</button>
      <button onClick={handleInfo}>Info</button>
    </div>
  )
}
```

#### Async Operation Hook
```tsx
import { useAsyncOperation } from './components/LoadingStates'

function MyAsyncComponent() {
  const { loading, error, execute, reset, data } = useAsyncOperation<string>()

  const fetchData = async () => {
    try {
      const result = await execute(async () => {
        const response = await fetch('/api/data')
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        return await response.json()
      })
      console.log('Data:', result)
    } catch (err) {
      console.error('Operation failed:', err)
    }
  }

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>
      {error && <div className="text-red-500">{error.message}</div>}
      {data && <div>Data: {data}</div>}
    </div>
  )
}
```

### 5. Form Validation Hook

```tsx
import { useFormValidation } from './utils/validation'

function ContactForm() {
  const { 
    values, 
    errors, 
    setValue, 
    setTouched, 
    validateAll, 
    reset, 
    isValid 
  } = useFormValidation(
    { name: '', email: '', message: '' },
    {
      name: { required: true, minLength: 2 },
      email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      message: { required: true, minLength: 10 }
    }
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (validateAll()) {
      // Submit form
      console.log('Form data:', values)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          onBlur={() => setTouched('name')}
          placeholder="Name"
        />
        {errors.name && <span className="error">{errors.name[0]}</span>}
      </div>
      
      <div>
        <input
          type="email"
          value={values.email}
          onChange={(e) => setValue('email', e.target.value)}
          onBlur={() => setTouched('email')}
          placeholder="Email"
        />
        {errors.email && <span className="error">{errors.email[0]}</span>}
      </div>
      
      <div>
        <textarea
          value={values.message}
          onChange={(e) => setValue('message', e.target.value)}
          onBlur={() => setTouched('message')}
          placeholder="Message"
        />
        {errors.message && <span className="error">{errors.message[0]}</span>}
      </div>
      
      <button type="submit" disabled={!isValid}>
        Submit
      </button>
    </form>
  )
}
```

### 6. Environment Management

```tsx
import { envManager, getEnvVar, validateEnvironment } from './utils/environment'

// Validate environment on startup
validateEnvironment()

// Get environment configuration
const config = envManager.getConfig()
console.log('Environment:', config.NODE_ENV)
console.log('Error logging:', config.VITE_ENABLE_ERROR_LOGGING)

// Type-safe environment variables
const apiUrl = getEnvVar(
  'VITE_API_BASE_URL', 
  'http://localhost:3000',
  (value): value is string => value.startsWith('http')
)

// Security checks
const securityConfig = envManager.getSecurityConfig()
console.log('CSP enabled:', securityConfig.enableCSP)
```

### 7. Security Validation

```tsx
import { SecurityValidator } from './utils/securityValidator'

// Run security checks
const report = SecurityValidator.getSecurityReport()
console.log('Security report:', report)

// Log detailed report (development only)
SecurityValidator.logSecurityReport()
```

## Complete Example: Wallet Component

```tsx
import React, { useState, useCallback } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingInline, StatusIndicator, useToast, useAsyncOperation } from './components/LoadingStates'
import { Validator, Sanitizer } from './utils/validation'
import { WalletError, errorLogger } from './utils/errorHandler'

function WalletComponent() {
  const [address, setAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  const { loading, error: operationError, execute } = useAsyncOperation()
  const { success, error: showError } = useToast()

  const validateInputs = useCallback(() => {
    const errors = {}
    
    // Validate address
    const addressValidation = Validator.validateEthereumAddress(
      Sanitizer.sanitizeEthereumAddress(address)
    )
    if (!addressValidation.isValid) {
      errors.address = addressValidation.errors
    }
    
    // Validate amount
    const amountValidation = Validator.validateAmount(amount)
    if (!amountValidation.isValid) {
      errors.amount = amountValidation.errors
    }
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [address, amount])

  const sendTransaction = useCallback(async () => {
    if (!validateInputs()) {
      showError('Invalid Input', 'Please check your transaction details')
      return
    }

    try {
      await execute(async () => {
        // Simulate transaction
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Random failures for demo
        if (Math.random() < 0.1) {
          throw new WalletError('Transaction', 'send', 'Insufficient gas')
        }
        
        success('Transaction Sent', `Sent ${amount} MATIC successfully`)
        setAddress('')
        setAmount('')
        return { success: true }
      })
    } catch (err) {
      const walletError = err instanceof WalletError ? err : 
        new WalletError('Transaction', 'send', 'Transaction failed')
      
      errorLogger.log(walletError)
      showError('Transaction Failed', walletError.message)
    }
  }, [address, amount, validateInputs, execute, success, showError])

  return (
    <ErrorBoundary level="component">
      <div className="wallet-container">
        <h2>Send Transaction</h2>
        
        {operationError && (
          <StatusIndicator 
            status="error" 
            message="Transaction failed" 
          />
        )}
        
        <div className="form-group">
          <label>Recipient Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className={validationErrors.address ? 'error' : ''}
          />
          {validationErrors.address && (
            <span className="error-message">
              {validationErrors.address[0]}
            </span>
          )}
        </div>
        
        <div className="form-group">
          <label>Amount (MATIC)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.0001"
            className={validationErrors.amount ? 'error' : ''}
          />
          {validationErrors.amount && (
            <span className="error-message">
              {validationErrors.amount[0]}
            </span>
          )}
        </div>
        
        <button 
          onClick={sendTransaction}
          disabled={loading || !address || !amount}
        >
          {loading ? (
            <LoadingInline message="Sending..." />
          ) : (
            `Send ${amount || '0'} MATIC`
          )}
        </button>
      </div>
    </ErrorBoundary>
  )
}

export default WalletComponent
```

## Configuration

### Environment Variables

Create `.env` file based on `.env.example`:

```bash
# Required for production
VITE_API_BASE_URL=https://api.sylos.io
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_WALLETCONNECT_PROJECT_ID=your_project_id

# Security settings
VITE_ENABLE_ERROR_LOGGING=true
VITE_CSP_ENABLED=true
VITE_SECURITY_HEADERS_ENABLED=true

# Analytics (optional)
VITE_SENTRY_DSN=your_sentry_dsn
VITE_ENABLE_ANALYTICS=true
```

### TypeScript Configuration

Ensure strict mode is enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## Testing Error Handling

### Unit Tests
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorBoundary } from './components/ErrorBoundary'

function ErrorComponent() {
  throw new Error('Test error')
}

test('ErrorBoundary catches errors', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
  
  render(
    <ErrorBoundary level="component">
      <ErrorComponent />
    </ErrorBoundary>
  )
  
  await waitFor(() => {
    expect(screen.getByText(/component error/i)).toBeInTheDocument()
  })
  
  consoleSpy.mockRestore()
})
```

### Integration Tests
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import WalletApp from './components/apps/WalletApp'
import { ValidationError } from './utils/errorHandler'

test('WalletApp handles validation errors', () => {
  render(<WalletApp />)
  
  const addressInput = screen.getByPlaceholderText(/0x/)
  const amountInput = screen.getByPlaceholderText(/0\.00/)
  
  fireEvent.change(addressInput, { target: { value: 'invalid' } })
  fireEvent.change(amountInput, { target: { value: '-1' } })
  
  const sendButton = screen.getByText(/send/i)
  fireEvent.click(sendButton)
  
  expect(screen.getByText(/validation failed/i)).toBeInTheDocument()
})
```

## Best Practices

1. **Always wrap components in Error Boundaries**
2. **Validate all user inputs before processing**
3. **Provide clear error messages to users**
4. **Log errors with appropriate context**
5. **Use loading states for all async operations**
6. **Sanitize user input to prevent XSS**
7. **Enable strict TypeScript configuration**
8. **Use proper HTTP status codes for API errors**
9. **Implement proper error boundaries at each level**
10. **Test error handling paths thoroughly**

## Troubleshooting

### Common Issues

1. **Error Boundary not catching errors**
   - Ensure components are wrapped properly
   - Check for async errors that need explicit throwing

2. **Validation not working**
   - Verify validation rules are correctly defined
   - Check for proper event handling

3. **Toast notifications not showing**
   - Ensure ToastContainer is rendered in the app root
   - Check for z-index conflicts

4. **Environment variables not loading**
   - Verify file naming and location
   - Check VITE_ prefix on variables
   - Restart development server after changes

### Debug Mode

Enable detailed error logging in development:

```typescript
// In main.tsx or component
if (import.meta.env.DEV) {
  console.log('Error logger enabled')
  console.log('Security checks running...')
  SecurityValidator.logSecurityReport()
}
```

## Performance Considerations

- Error boundaries have minimal performance impact
- Validation is optimized for common cases
- Loading states prevent UI blocking
- Security checks run once on load
- Error logging is debounced to prevent spam

This implementation provides a robust foundation for error handling and security in a production React application.