/**
 * Frosted Mint design tokens, taken from the Google Stitch exports in ui-references/.
 * Tailwind scale used by the designs: 1 unit = 4 px, text-xs 12, text-sm 14, text-base 16,
 * text-lg 18, text-xl 20, text-2xl 24, text-3xl 30, text-4xl 36.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import type { ThemeKey } from './game/themes';

export const colors = {
  mintCanvas: '#E5F3EA',
  forest: '#176B4D',
  forestDeep: '#123629',
  ink: '#12291F',
  inkMuted: '#415E52',
  white: '#FFFFFF',
};

/** One theme system: the game's Montréal neighbourhoods also theme the rest of the app. */
export type { ThemeKey };

/**
 * Light app palette per neighbourhood (src/game/themes.ts). The game's own colours are tuned for its
 * street scene (Nuit MTL is dark), so the app gets a matching accent and a soft canvas gradient (drawn once by components/World).
 */
export const APP_PALETTES: Record<ThemeKey, { forest: string; forestDeep: string; mintCanvas: string; canvas: string[] }> = {
  plateau: { forest: '#176B4D', forestDeep: '#123629', mintCanvas: '#EAF6EE', canvas: ['#FFFFFF', '#EAF6EE', '#D7EDE0'] },
  'saint-laurent': { forest: '#0F5E63', forestDeep: '#0B3A3D', mintCanvas: '#E3F0F1', canvas: ['#FFFFFF', '#E6F2F3', '#D0E4E7'] },
  'mont-royal': { forest: '#8E2C6B', forestDeep: '#4A1538', mintCanvas: '#F6EAF0', canvas: ['#FFFFFF', '#F7EDF2', '#ECD8E3'] },
  'mile-end': { forest: '#4E6B2E', forestDeep: '#283A16', mintCanvas: '#EFEFE3', canvas: ['#FFFFFF', '#F1F1E6', '#E1E0CD'] },
  nuit: { forest: '#3B4BA8', forestDeep: '#1B1F4A', mintCanvas: '#E8EAF6', canvas: ['#FFFFFF', '#EBEDF8', '#D6DAEF'] },
  'vieux-quebec': { forest: '#9A4A2C', forestDeep: '#4F2414', mintCanvas: '#F4ECE6', canvas: ['#FFFFFF', '#F6EFE9', '#E8DACF'] },
};

/**
 * Switch theme by updating the shared tokens in place. Screens read `colors` while rendering and all
 * re-render on theme change (they use the app state), so styles must not copy accents into StyleSheet.create.
 */
export function applyTheme(key: ThemeKey) {
  const t = APP_PALETTES[key];
  Object.assign(colors, { forest: t.forest, forestDeep: t.forestDeep, mintCanvas: t.mintCanvas });
}

export type BinKey = 'recycling' | 'compost' | 'garbage' | 'special';

/** Bin colours. `fg` matches Scan/Play; `deep` and `border` match the Sorted breakdown screen. */
export const bins: Record<
  BinKey,
  { label: string; icon: string; fg: string; deep: string; bg: string; border: string }
> = {
  recycling: { label: 'Recycling', icon: 'recycling', fg: '#2563EB', deep: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  compost: { label: 'Compost', icon: 'compost', fg: '#B45309', deep: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  garbage: { label: 'Garbage', icon: 'delete', fg: '#4B5563', deep: '#374151', bg: '#F3F4F6', border: '#D1D5DB' },
  special: { label: 'Special', icon: 'location-on', fg: '#7C3AED', deep: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
};

export const BIN_ORDER: BinKey[] = ['recycling', 'compost', 'garbage', 'special'];

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
};

/** Tailwind font sizes with their default line heights. */
export const text = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  '2xl': { fontSize: 24, lineHeight: 32 },
  '3xl': { fontSize: 30, lineHeight: 36 },
  '4xl': { fontSize: 36, lineHeight: 40 },
} satisfies Record<string, TextStyle>;

/** `.apple-glass` from the designs: translucent white, white hairline, soft forest shadow. */
export const glass: ViewStyle = {
  backgroundColor: 'rgba(255, 255, 255, 0.72)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.88)',
  boxShadow: '0px 10px 30px -10px rgba(20, 92, 64, 0.12), inset 0px 1px 0px rgba(255, 255, 255, 0.9)',
};

/** Tailwind shadow-sm / shadow-md / shadow-lg / shadow-xl. */
export const shadow = {
  sm: { boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)' },
  md: { boxShadow: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)' },
  lg: { boxShadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)' },
  xl: { boxShadow: '0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)' },
} satisfies Record<string, ViewStyle>;

export const radius = { xl: 12, '2xl': 16, '3xl': 24, full: 999 };
