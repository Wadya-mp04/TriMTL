/**
 * White-label config: everything a city changes to ship its own version of the app.
 * The bin rules come from shared/data/quebecRules.json; the store name and icon from app.json.
 */
import type { ImageSourcePropType } from 'react-native';

import type { ThemeKey } from './theme';

export const brand = {
  appName: 'TriMTL',
  city: 'Montréal',
  tagline: { en: 'Scan it. Sort it. Learn Montréal.', fr: 'Scanne. Trie. Apprends Montréal.' },
  /** A neighbourhood from src/game/themes.ts; themes both the game and the app. */
  defaultTheme: 'plateau' as ThemeKey,
  /**
   * The client city, shown on sign-in ("Made for Montréal · rules from montreal.ca"). `logo` stays null unless
   * the city is a partner and has allowed its logo; until then a neutral city icon is shown (no endorsement implied).
   */
  partner: {
    city: 'Montréal',
    rulesSource: 'montreal.ca',
    logo: null as ImageSourcePropType | null,
  },
};
