/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        xorb: {
          bg: '#0A0A0A',
          surface: '#141414',
          border: '#1E1E1E',
          blue: '#0066FF',
          'blue-hover': '#0052CC',
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#7C3AED',
          text: '#E5E5E5',
          muted: '#737373',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        glass: '20px',
      }
    }
  },
  plugins: []
}
