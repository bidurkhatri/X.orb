// SylOS Mobile Spacing System
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export type SpacingKeys = keyof typeof Spacing;

// Component specific spacing
export const ComponentSpacing = {
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  card: {
    padding: 16,
    margin: 8,
  },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  screen: {
    padding: 16,
  },
  list: {
    itemPadding: 16,
    separatorPadding: 8,
  },
} as const;
