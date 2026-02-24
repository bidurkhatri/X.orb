/**
 * Input validation and sanitization utilities
 */

import React from 'react'
import { ValidationError } from './errorHandler'

export interface ValidationRule<T> {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  custom?: (value: T) => boolean | string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export class Validator {
  static validateString(
    value: string,
    rules: ValidationRule<string> = {},
    fieldName: string = 'value'
  ): ValidationResult {
    const errors: string[] = []

    // Required check
    if (rules.required && (!value || value.trim().length === 0)) {
      errors.push(`${fieldName} is required`)
      return { isValid: false, errors }
    }

    if (!value) return { isValid: true, errors: [] }

    // Length checks
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`${fieldName} must be at least ${rules.minLength} characters long`)
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`${fieldName} must be no more than ${rules.maxLength} characters long`)
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`)
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value)
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${fieldName} is invalid`)
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateNumber(
    value: number,
    rules: ValidationRule<number> = {},
    fieldName: string = 'value'
  ): ValidationResult {
    const errors: string[] = []

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${fieldName} is required`)
      return { isValid: false, errors }
    }

    if (value === undefined || value === null) return { isValid: true, errors: [] }

    // Range checks
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`${fieldName} must be at least ${rules.min}`)
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push(`${fieldName} must be no more than ${rules.max}`)
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value)
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${fieldName} is invalid`)
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  static validateEmail(email: string): ValidationResult {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return this.validateString(email, {
      required: true,
      pattern: emailPattern
    }, 'Email')
  }

  static validateEthereumAddress(address: string): ValidationResult {
    const ethPattern = /^0x[a-fA-F0-9]{40}$/
    return this.validateString(address, {
      required: true,
      pattern: ethPattern
    }, 'Ethereum address')
  }

  static validatePassword(password: string): ValidationResult {
    const passwordRules = {
      required: true,
      minLength: 8,
      custom: (value: string) => {
        if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter'
        if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter'
        if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number'
        if (!/(?=.*[!@#$%^&*])/.test(value)) return 'Password must contain at least one special character'
        return true
      }
    }
    return this.validateString(password, passwordRules, 'Password')
  }

  static validateAmount(amount: string | number): ValidationResult {
    const numValue = typeof amount === 'string' ? parseFloat(amount) : amount

    if (isNaN(numValue)) {
      return { isValid: false, errors: ['Amount must be a valid number'] }
    }

    if (numValue < 0) {
      return { isValid: false, errors: ['Amount cannot be negative'] }
    }

    if (numValue > 1000000) {
      return { isValid: false, errors: ['Amount is too large'] }
    }

    return { isValid: true, errors: [] }
  }
}

// Sanitization utilities
export class Sanitizer {
  static sanitizeString(value: string): string {
    if (typeof value !== 'string') return ''

    return value
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .trim()
  }

  static sanitizeHTML(value: string): string {
    if (typeof value !== 'string') return ''

    // Basic HTML sanitization - in production, use a library like DOMPurify
    return value
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  static sanitizeEthereumAddress(address: string): string {
    return this.sanitizeString(address).toLowerCase()
  }

  static sanitizeFilename(filename: string): string {
    return this.sanitizeString(filename)
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special characters with underscore
      .substring(0, 255) // Limit length
  }

  static sanitizeURL(url: string): string {
    const sanitized = this.sanitizeString(url)

    // Basic URL validation
    if (!/^https?:\/\//i.test(sanitized)) {
      throw new ValidationError('url', url, 'URL must start with http:// or https://')
    }

    return sanitized
  }
}

// Form validation hook
export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: Partial<Record<keyof T, ValidationRule<any>>>
) {
  const [values, setValues] = React.useState<T>(initialValues)
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string[]>>>({})
  const [touched, setTouched] = React.useState<Partial<Record<keyof T, boolean>>>({})

  const validateField = (name: keyof T, value: any): string[] => {
    const rules = validationRules[name]
    if (!rules) return []

    const result = Validator.validateString(value as string, rules, name as string)
    return result.errors
  }

  const setValue = (name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))

    // Validate on change if field has been touched
    if (touched[name]) {
      const fieldErrors = validateField(name, value)
      setErrors(prev => ({ ...prev, [name]: fieldErrors }))
    }
  }

  const markTouched = (name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }))

    // Validate on blur
    const fieldErrors = validateField(name, values[name])
    setErrors(prev => ({ ...prev, [name]: fieldErrors }))
  }

  const validateAll = (): boolean => {
    const newErrors: Partial<Record<keyof T, string[]>> = {}
    let isValid = true

    Object.keys(validationRules).forEach(name => {
      const fieldName = name as keyof T
      const fieldErrors = validateField(fieldName, values[fieldName])
      if (fieldErrors.length > 0) {
        newErrors[fieldName] = fieldErrors
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }

  const reset = () => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }

  return {
    values,
    errors,
    touched,
    setValue,
    setTouched: markTouched,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0
  }
}