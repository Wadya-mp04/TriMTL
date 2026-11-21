/**
 * Reads the bundled rules (mobile/shared/, a copy of the server's quebecRules.json: `npm run sync-shared`).
 */
import rules from '../../shared/data/quebecRules.json';
import type { BinKey } from '../theme';

export const BOROUGHS = Object.entries(rules.boroughs)
  .map(([slug, b]) => ({ slug, name: b.name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

export const boroughName = (slug: string | null) => BOROUGHS.find((b) => b.slug === slug)?.name ?? 'Montréal';

/** Montréal rules people get wrong most often; one is shown per day. */
const SURPRISING = ['chip_bag', 'drink_can', 'coffee_cup', 'pizza_box_greasy', 'battery', 'plastic_bags', 'foam_food'];

export function tipOfTheDay(date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const id = SURPRISING[day % SURPRISING.length];
  const r = rules.items.find((i) => i.id === id)!;
  const dropoff = r.dropoff ? rules.dropoffs[r.dropoff as keyof typeof rules.dropoffs].name.en : null;
  return { name: r.name.en, bin: r.bin as BinKey, where: dropoff, text: r.explanation.en, url: r.sourceUrl };
}
