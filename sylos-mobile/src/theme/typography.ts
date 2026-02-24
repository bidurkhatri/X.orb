// SylOS Mobile Typography System
import { TextStyle } from 'react-native';

export const Typography = {
  // Font families
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Menlo',
  },

  // Font sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    title: 28,
    display: 36,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.8,
  },

  // Letter spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

// Predefined text styles
export const TextStyles = {
  // Headings
  h1: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: '700' as const,
    lineHeight: Typography.fontSize.xxxl * Typography.lineHeight.tight,
  } as TextStyle,
  
  h2: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: '700' as const,
    lineHeight: Typography.fontSize.xxl * Typography.lineHeight.tight,
  } as TextStyle,
  
  h3: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '600' as const,
    lineHeight: Typography.fontSize.xl * Typography.lineHeight.tight,
  } as TextStyle,
  
  h4: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600' as const,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
  } as TextStyle,

  // Body text
  body: {
    fontSize: Typography.fontSize.base,
    fontWeight: '400' as const,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  } as TextStyle,
  
  bodyBase: {
    fontSize: Typography.fontSize.base,
    fontWeight: '400' as const,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  } as TextStyle,
  
  bodyMedium: {
    fontSize: Typography.fontSize.md,
    fontWeight: '500' as const,
    lineHeight: Typography.fontSize.md * Typography.lineHeight.normal,
  } as TextStyle,
  
  bodyLarge: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '400' as const,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
  } as TextStyle,

  // Small text
  caption: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '400' as const,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  } as TextStyle,
  
  captionMedium: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500' as const,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  } as TextStyle,

  // Code/monospace
  code: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.mono,
    fontWeight: '400' as const,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  } as TextStyle,
} as const;
