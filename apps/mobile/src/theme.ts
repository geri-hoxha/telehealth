import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  primary: '#0D9488',
  primaryDark: '#0F766E',
  primaryDeep: '#134E4A',
  primarySoft: '#CCFBF1',
  primaryTint: '#F0FDFA',
  background: '#F4F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F4',
  text: '#0B1B2B',
  textSecondary: '#475569',
  textMuted: '#8494A7',
  border: '#E3E9EC',
  divider: '#EDF1F3',
  danger: '#E11D48',
  dangerSoft: '#FFE4E6',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(11, 27, 43, 0.45)',
  callBackground: '#0B1220',
  hangUp: '#EF4444',
  answer: '#22C55E',
} as const;

/** Gradients for content cards; the API names one per story, benefit or article. */
export const accents = {
  teal: ['#2DD4BF', '#0F766E'],
  coral: ['#FB7185', '#E11D48'],
  indigo: ['#818CF8', '#4F46E5'],
  amber: ['#FBBF24', '#D97706'],
  sky: ['#38BDF8', '#0369A1'],
  violet: ['#C084FC', '#7C3AED'],
} as const satisfies Record<string, readonly [string, string]>;

export type AccentName = keyof typeof accents;

export function accent(name: string): readonly [string, string] {
  return accents[name as AccentName] ?? accents.teal;
}

export const gradients = {
  brand: ['#14B8A6', '#0D9488', '#115E59'],
  card: ['#2DD4BF', '#0D9488', '#134E4A'],
  call: ['#0F2A3A', '#0B1220'],
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.3 },
  headline: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subhead: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  small: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: '#0B1B2B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
    default: { elevation: 2 },
  }),
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: '#0B1B2B', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 24 },
    default: { elevation: 8 },
  }),
} as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 } as const;
