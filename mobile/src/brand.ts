/**
 * White-label config: everything a city changes to ship its own version of the app.
 * The bin rules come from shared/data/quebecRules.json; the store name and icon from app.json.
 */
import type { ThemeKey } from './theme';

export const brand = {
  appName: 'TriMTL',
  city: 'Montréal',
  tagline: 'Scan it. Sort it. Learn Montréal.',
  /** A neighbourhood from src/game/themes.ts; themes both the game and the app. */
  defaultTheme: 'plateau' as ThemeKey,
};
