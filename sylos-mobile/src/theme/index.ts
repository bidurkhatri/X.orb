// SylOS Mobile Theme System
import { Colors } from '../constants/colors';
import { Spacing } from './spacing';
import { Typography, TextStyles } from './typography';
import { BorderRadius } from './borderRadius';
import { Shadows } from './shadows';

export const theme = {
  colors: Colors,
  spacing: Spacing,
  typography: Typography,
  borderRadius: BorderRadius,
  shadows: Shadows,
  textStyles: TextStyles,
} as const;

export type Theme = typeof theme;

// Theme utilities
export const createDarkTheme = (): Theme => ({
  ...theme,
  colors: {
    ...Colors,
    background: Colors.gray900,
    surface: Colors.gray800,
    surfaceVariant: Colors.gray700,
    text: Colors.gray50,
    textSecondary: Colors.gray400,
    textTertiary: Colors.gray500,
    textInverse: Colors.gray900,
    border: Colors.gray700,
  },
});

export const createLightTheme = (): Theme => theme;

export type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};
