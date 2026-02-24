/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sylos-primary': {
          DEFAULT: '#6366f1',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        'sylos-secondary': '#8b5cf6',
        'sylos-accent': '#06b6d4',
        'sylos-dark': '#0f172a',
        'sylos-light': '#f1f5f9',
        // High contrast colors for accessibility
        'contrast': {
          'bg': '#000000',
          'text': '#ffffff',
          'border': '#ffffff',
          'focus': '#ffff00',
        },
        // WCAG AA compliant text colors
        'accessible': {
          'text': '#ffffff',
          'muted': '#e2e8f0',
          'subtle': '#94a3b8',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      // Enhanced spacing for better touch targets
      spacing: {
        'touch': '44px',
        'touch-lg': '48px',
      },
      // Improved focus styles
      ringWidth: {
        'focus': '2px',
      },
      ringColor: {
        'focus': '#8B5CF6',
      },
      // Better contrast ratios
      colors: {
        // Background colors with high contrast
        'bg-primary': 'var(--bg-primary, #0f172a)',
        'bg-secondary': 'var(--bg-secondary, #1e293b)',
        // Text colors meeting WCAG AA standards
        'text-primary': 'var(--text-primary, #ffffff)',
        'text-secondary': 'var(--text-secondary, #e2e8f0)',
        'text-muted': 'var(--text-muted, #94a3b8)',
      }
    },
  },
  plugins: [
    // Add accessibility-focused plugins
    function({ addUtilities, theme }) {
      const newUtilities = {
        // Screen reader utilities
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        },
        '.sr-only-focusable': {
          '&:focus, &:active': {
            position: 'static',
            width: 'auto',
            height: 'auto',
            padding: 'inherit',
            margin: 'inherit',
            overflow: 'visible',
            clip: 'auto',
            whiteSpace: 'normal',
          },
        },
        // Focus styles
        '.focus-ring': {
          '&:focus': {
            outline: `2px solid ${theme('colors.sylos-primary.DEFAULT')}`,
            outlineOffset: '2px',
          },
        },
        // Touch target utilities
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        // High contrast utilities
        '.high-contrast': {
          border: '2px solid currentColor',
        },
        // Error states
        '.error-state': {
          borderColor: '#ef4444',
          outlineColor: '#ef4444',
        },
        // Loading states
        '.loading-state': {
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '20px',
            height: '20px',
            margin: '-10px 0 0 -10px',
            border: '2px solid #8B5CF6',
            borderRadius: '50%',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          },
        },
      }
      addUtilities(newUtilities)
    }
  ],
}
