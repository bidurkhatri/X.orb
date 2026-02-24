// Accessibility utilities and hooks for WCAG 2.1 AA compliance

import { useEffect, useRef, useCallback } from 'react'

// Focus management
export const useFocusTrap = (isActive: boolean = false) => {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement?.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement?.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    
    // Focus the first element when trap becomes active
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  }, [isActive])

  return containerRef
}

// Screen reader announcements
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.setAttribute('class', 'sr-only')
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

// Skip to main content functionality
export const useSkipToContent = () => {
  const skipToMain = useCallback(() => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth' })
      announceToScreenReader('Skipped to main content')
    }
  }, [])

  return skipToMain
}

// Manage focus states
export const useFocusManagement = () => {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [])

  const setFocusToFirstFocusable = useCallback((container: HTMLElement) => {
    const focusable = container.querySelector(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    ) as HTMLElement
    focusable?.focus()
  }, [])

  return {
    saveFocus,
    restoreFocus,
    setFocusToFirstFocusable
  }
}

// Keyboard navigation utilities
export const useKeyboardNavigation = (onEnter?: () => void, onEscape?: () => void) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        onEnter?.()
        break
      case 'Escape':
        e.preventDefault()
        onEscape?.()
        break
    }
  }, [onEnter, onEscape])

  return { handleKeyDown }
}

// Color contrast utilities
export const checkColorContrast = (foreground: string, background: string): boolean => {
  // Simple contrast check - in production, use a proper contrast checker
  const getLuminance = (color: string): number => {
    const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]
    const [r, g, b] = rgb.map(val => {
      val = val / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const l1 = getLuminance(foreground)
  const l2 = getLuminance(background)
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)

  return ratio >= 4.5 // WCAG AA standard
}

// ARIA utilities
export const getAriaLabel = (element: string, context?: string): string => {
  const labels = {
    wallet: 'Wallet application - manage blockchain assets and transactions',
    'pop-tracker': 'Proof of Productivity tracker - monitor productivity metrics',
    files: 'File manager - organize and manage files',
    tokens: 'Token dashboard - view cryptocurrency and DeFi positions',
    settings: 'System settings - configure application preferences',
    terminal: 'Terminal - access command line interface'
  }
  
  return labels[element as keyof typeof labels] || context || element
}

// Responsive touch targets
export const useResponsiveTouchTarget = () => {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .touch-target {
        min-height: 44px !important;
        min-width: 44px !important;
        position: relative;
      }
      
      @media (pointer: coarse) {
        .touch-target {
          min-height: 48px !important;
          min-width: 48px !important;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])
}

// High contrast mode detection
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches)
    }
    
    setIsHighContrast(mediaQuery.matches)
    mediaQuery.addListener(handleChange)
    
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isHighContrast
}

// Form validation with accessibility
export const useFormAccessibility = (errors: Record<string, string>) => {
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .error-message {
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .error-message::before {
        content: "⚠";
        font-weight: bold;
      }
      
      .form-field[aria-invalid="true"] {
        border-color: #ef4444;
        outline: 2px solid #ef4444;
        outline-offset: 2px;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [errors])
}

// Accessibility preferences detection
export const useAccessibilityPreferences = () => {
  const [preferences, setPreferences] = useState({
    reducedMotion: false,
    highContrast: false,
    largeText: false
  })

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const highContrast = window.matchMedia('(prefers-contrast: high)')
    const largeText = window.matchMedia('(prefers-color-scheme: light)')

    const updatePreferences = () => {
      setPreferences({
        reducedMotion: reducedMotion.matches,
        highContrast: highContrast.matches,
        largeText: largeText.matches
      })
    }

    updatePreferences()
    reducedMotion.addListener(updatePreferences)
    highContrast.addListener(updatePreferences)
    largeText.addListener(updatePreferences)

    return () => {
      reducedMotion.removeListener(updatePreferences)
      highContrast.removeListener(updatePreferences)
      largeText.removeListener(updatePreferences)
    }
  }, [])

  return preferences
}

import { useState } from 'react'