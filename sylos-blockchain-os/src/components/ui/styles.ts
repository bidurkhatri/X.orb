/**
 * SylOS Design System — Shared tokens & style helpers
 *
 * All apps should import from here for visual consistency.
 */

/* ─── Color tokens ─── */
export const colors = {
  // Backgrounds
  bg: {
    primary: '#0a0e1a',
    secondary: '#0f1328',
    surface: 'rgba(255,255,255,0.04)',
    surfaceHover: 'rgba(255,255,255,0.06)',
    surfaceActive: 'rgba(255,255,255,0.08)',
    overlay: 'rgba(0,0,0,0.5)',
    glass: 'rgba(12,16,36,0.72)',
    input: 'rgba(0,0,0,0.3)',
  },
  // Borders
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.06)',
    strong: 'rgba(255,255,255,0.08)',
    focus: 'rgba(99,102,241,0.4)',
    error: 'rgba(239,68,68,0.4)',
    success: 'rgba(34,197,94,0.4)',
  },
  // Text
  text: {
    primary: '#e2e8f0',
    secondary: 'rgba(255,255,255,0.6)',
    muted: 'rgba(255,255,255,0.35)',
    dim: 'rgba(255,255,255,0.2)',
    ghost: 'rgba(255,255,255,0.1)',
  },
  // Accent palette
  accent: {
    indigo: '#6366f1',
    indigoLight: '#818cf8',
    indigoGlow: 'rgba(99,102,241,0.15)',
    violet: '#8b5cf6',
    cyan: '#22d3ee',
    emerald: '#22c55e',
    amber: '#f59e0b',
    rose: '#ef4444',
    sky: '#0ea5e9',
    pink: '#ec4899',
  },
  // Status
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#6366f1',
  },
} as const

/* ─── Spacing scale (px) ─── */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

/* ─── Radius ─── */
export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  full: '100px',
} as const

/* ─── Typography ─── */
export const font = {
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  size: {
    xxs: '9px',
    xs: '10px',
    sm: '11px',
    md: '12px',
    base: '13px',
    lg: '14px',
    xl: '16px',
    xxl: '20px',
    display: '28px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
} as const

/* ─── Shadows ─── */
export const shadow = {
  sm: '0 2px 8px rgba(0,0,0,0.3)',
  md: '0 8px 24px rgba(0,0,0,0.4)',
  lg: '0 16px 50px rgba(0,0,0,0.5)',
  xl: '0 24px 80px rgba(0,0,0,0.6)',
  glow: (color: string) => `0 0 20px ${color}`,
  indigoGlow: '0 0 20px rgba(99,102,241,0.15)',
} as const

/* ─── Transitions ─── */
export const transition = {
  fast: 'all 0.1s ease',
  normal: 'all 0.2s ease',
  smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
} as const

/* ─── Shared style presets (replaces per-app `s`, `cs`, `S` objects) ─── */
export const ui = {
  page: {
    height: '100%',
    padding: '20px',
    overflow: 'auto',
    fontFamily: font.sans,
    color: colors.text.primary,
    background: `linear-gradient(180deg, ${colors.bg.primary} 0%, ${colors.bg.secondary} 100%)`,
  } as React.CSSProperties,

  card: {
    background: colors.bg.surface,
    border: `1px solid ${colors.border.default}`,
    borderRadius: radius.lg,
    padding: '20px',
  } as React.CSSProperties,

  cardHover: {
    background: colors.bg.surfaceHover,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: radius.lg,
    padding: '20px',
    transition: transition.normal,
    cursor: 'pointer',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: radius.md,
    border: `1px solid ${colors.border.strong}`,
    background: colors.bg.input,
    color: '#fff',
    fontSize: font.size.base,
    fontFamily: font.sans,
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: transition.fast,
  } as React.CSSProperties,

  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '6px',
  } as React.CSSProperties,

  sectionHeader: {
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    color: colors.text.muted,
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    padding: '4px 0 12px',
  } as React.CSSProperties,

  divider: {
    height: '1px',
    background: colors.border.subtle,
    margin: '16px 0',
  } as React.CSSProperties,

  scrollArea: {
    flex: 1,
    overflowY: 'auto' as const,
    scrollbarWidth: 'thin' as const,
    scrollbarColor: 'rgba(255,255,255,0.08) transparent',
  } as React.CSSProperties,
} as const

/* ─── Helper: generate gradient button style ─── */
export function btnStyle(
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'primary',
  size: 'sm' | 'md' | 'lg' = 'md',
): React.CSSProperties {
  const sizeMap = {
    sm: { padding: '6px 12px', fontSize: font.size.sm, borderRadius: radius.sm },
    md: { padding: '8px 16px', fontSize: font.size.md, borderRadius: radius.md },
    lg: { padding: '10px 20px', fontSize: font.size.base, borderRadius: radius.md },
  }
  const variantMap = {
    primary: {
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 12px rgba(79,70,229,0.3)',
    },
    secondary: {
      background: colors.bg.surfaceHover,
      color: colors.text.secondary,
      border: `1px solid ${colors.border.strong}`,
      boxShadow: 'none',
    },
    danger: {
      background: 'linear-gradient(135deg, #dc2626, #ef4444)',
      color: '#fff',
      border: 'none',
      boxShadow: '0 2px 12px rgba(220,38,38,0.3)',
    },
    ghost: {
      background: 'transparent',
      color: colors.text.muted,
      border: 'none',
      boxShadow: 'none',
    },
  }
  return {
    ...sizeMap[size],
    ...variantMap[variant],
    fontWeight: font.weight.semibold,
    fontFamily: font.sans,
    cursor: 'pointer',
    transition: transition.normal,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
  }
}

/* ─── Helper: badge style ─── */
export function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: font.size.xxs,
    padding: '2px 8px',
    borderRadius: radius.full,
    background: `${color}18`,
    color,
    fontWeight: font.weight.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    whiteSpace: 'nowrap' as const,
  }
}

/* ─── Helper: tab style ─── */
export function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: radius.md,
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.sans,
    fontSize: font.size.md,
    fontWeight: active ? font.weight.semibold : font.weight.medium,
    color: active ? '#fff' : colors.text.muted,
    background: active ? colors.accent.indigoGlow : 'transparent',
    transition: transition.fast,
  }
}

/* ─── Helper: grid layouts ─── */
export const grid = {
  cols2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } as React.CSSProperties,
  cols3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' } as React.CSSProperties,
  cols4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' } as React.CSSProperties,
} as const

/* ─── Helper: stat card ─── */
export function statCardStyle(): React.CSSProperties {
  return {
    ...ui.card,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  }
}

/* ─── Helper: scrollbar CSS string (inject via <style>) ─── */
export const scrollbarCSS = `
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
`
