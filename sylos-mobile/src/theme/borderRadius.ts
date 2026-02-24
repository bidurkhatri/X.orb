// SylOS Mobile Border Radius System
export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
  pill: 20,
  round: 8,
} as const;

export type BorderRadiusKeys = keyof typeof BorderRadius;

// Component specific border radius
export const ComponentRadius = {
  button: {
    small: BorderRadius.sm,
    medium: BorderRadius.md,
    large: BorderRadius.lg,
  },
  card: {
    small: BorderRadius.sm,
    medium: BorderRadius.md,
    large: BorderRadius.lg,
  },
  input: {
    small: BorderRadius.sm,
    medium: BorderRadius.md,
    large: BorderRadius.lg,
  },
  avatar: {
    small: BorderRadius.sm,
    medium: BorderRadius.md,
    large: BorderRadius.lg,
  },
  modal: {
    top: BorderRadius.xl,
    full: BorderRadius.xl,
  },
} as const;
