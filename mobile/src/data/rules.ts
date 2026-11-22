/**
 * The app's copy of the server's rules engine and data (mobile/shared/, made by `npm run sync-shared`
 * in server/). The backend rules are the source of truth: never decide a bin in app code, ask `rules`.
 */
import raw from '../../shared/data/quebecRules.json';
import { createRulesEngine } from '../../shared/services/rulesEngine';
import type { BinKey } from '../theme';

export const rules = createRulesEngine(raw);

export const BOROUGHS = rules.BOROUGHS
  .map(({ slug, name }) => ({ slug, name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export const boroughName = (slug: string | null) => BOROUGHS.find((b) => b.slug === slug)?.name ?? 'Montréal';

/** Montréal rules people get wrong most often; one is shown per day. */
const SURPRISING = ['chip_bag', 'drink_can', 'coffee_cup', 'pizza_box_greasy', 'battery', 'plastic_bags', 'foam_food'];

/** One surprising rule per day, answered for the player's area (borough, brown bin) and language. */
export function tipOfTheDay(date = new Date(), area?: { borough: string | null; hasBrownBin: boolean }, lang: 'fr' | 'en' = 'en') {
  const day = Math.floor(date.getTime() / 86_400_000);
  const id = SURPRISING[day % SURPRISING.length];
  const it = rules.toScanItem({ id, name: '', rule: rules.getRule(id), confidence: 'high', lang, ctx: area });
  return { name: rules.getRule(id)!.name[lang], bin: it.correctBin as BinKey, where: it.dropoffName, text: it.explanation ?? '', url: it.sourceUrl ?? '' };
}
