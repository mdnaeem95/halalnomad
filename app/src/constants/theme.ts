// HalalNomad Design System
// Minimal, clean, and sleek — inspired by a calm green palette

// ============================================
// COLOR PALETTES
// ============================================

const lightColors = {
  primary: '#1B5E20',
  primaryLight: '#388E3C',
  primaryDark: '#0D3B13',

  accent: '#F9A825',
  accentLight: '#FDD835',

  white: '#FFFFFF',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E0E0E0',
  divider: '#F0F0F0',

  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  textTertiary: '#757575',
  textOnPrimary: '#FFFFFF',

  halalReported: '#9E9E9E',
  halalCommunity: '#43A047',
  halalPhoto: '#43A047',
  halalTrusted: '#1B5E20',

  success: '#43A047',
  warning: '#F9A825',
  error: '#D32F2F',
  info: '#1976D2',
} as const;

const darkColors = {
  primary: '#4CAF50',
  primaryLight: '#66BB6A',
  primaryDark: '#2E7D32',

  accent: '#FFD54F',
  accentLight: '#FFE082',

  white: '#FFFFFF',
  background: '#121212',
  surface: '#1E1E1E',
  border: '#333333',
  divider: '#2A2A2A',

  textPrimary: '#ECECEC',
  textSecondary: '#AAAAAA',
  textTertiary: '#888888',
  textOnPrimary: '#FFFFFF',

  halalReported: '#757575',
  halalCommunity: '#66BB6A',
  halalPhoto: '#66BB6A',
  halalTrusted: '#4CAF50',

  success: '#66BB6A',
  warning: '#FFD54F',
  error: '#EF5350',
  info: '#42A5F5',
} as const;

export type AppColors = {
  [K in keyof typeof lightColors]: string;
};
export type ColorScheme = 'light' | 'dark' | 'system';

export function getColors(scheme: 'light' | 'dark'): AppColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

// Default export for backward compatibility — light theme
export const colors = lightColors;

// ============================================
// SPACING, TYPOGRAPHY, BORDERS, SHADOWS
// ============================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export function getHalalLevelColors(scheme: 'light' | 'dark'): Record<number, string> {
  const c = getColors(scheme);
  return {
    1: c.halalReported,
    2: c.halalCommunity,
    3: c.halalPhoto,
    4: c.halalTrusted,
  };
}

// Default for backward compat
export const HALAL_LEVEL_COLORS: Record<number, string> = {
  1: lightColors.halalReported,
  2: lightColors.halalCommunity,
  3: lightColors.halalPhoto,
  4: lightColors.halalTrusted,
};
