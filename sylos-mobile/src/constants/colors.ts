// SylOS Mobile Color System
export const Colors = {
  // Primary Brand Colors
  primary: '#6366f1', // Indigo-500
  primaryDark: '#4f46e5', // Indigo-600
  primaryLight: '#818cf8', // Indigo-400
  secondary: '#8b5cf6', // Violet-500
  secondaryDark: '#7c3aed', // Violet-600
  accent: '#f59e0b', // Amber-500

  // Gray Scale
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Status Colors
  success: '#10b981', // Emerald-500
  warning: '#f59e0b', // Amber-500
  error: '#ef4444', // Red-500
  info: '#3b82f6', // Blue-500
  
  // Common Colors
  white: '#ffffff',
  black: '#000000',

  // Blockchain Colors
  eth: '#627eea',
  polygon: '#8247e5',
  bitcoin: '#f7931a',
  solana: '#00d18c',

  // Background Colors
  background: '#ffffff',
  surface: '#f9fafb',
  surfaceVariant: '#f3f4f6',
  
  // Text Colors
  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  textInverse: '#ffffff',

  // Border Colors
  border: '#e5e7eb',
  borderFocused: '#6366f1',
  borderError: '#ef4444',
} as const;

export type ColorKeys = keyof typeof Colors;
