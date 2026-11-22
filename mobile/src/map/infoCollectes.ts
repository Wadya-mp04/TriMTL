/**
 * Turns the Ville de Montréal "Secteurs Info-collectes" free text into collection days and holiday changes.
 * The city publishes the day only inside a sentence ("Jour de collecte : mardi"), so this reads the French
 * text, which is the most consistent. Anything it cannot read stays null and the official text is shown.
 * Pure and dependency-free: used by scripts/build-collections.ts and tested with `npm test`.
 */
import type { Exception, Stream } from './schedule.ts';

export type Sector = {
  id: string;
  stream: Stream;
  /** 0 = Sunday … 6 = Saturday; empty when the text names no day (e.g. a shared container). */
  days: number[];
  /** True when some or all weeks are every other week; the city does not publish which weeks. */
  biweekly: boolean;
  /** The city's own wording (English when available), cleaned of HTML. */
  note: string;
  exceptions: Exception[];
};

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function clean(s: string | null | undefined) {
  return (s ?? '')
    .replace(/&eacute;?/g, 'é').replace(/&egrave;?/g, 'è').replace(/&agrave;?/g, 'à').replace(/&nbsp;?/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/([a-z.])([A-Z])/g, '$1 $2') // "MardiHeures" -> "Mardi Heures"
    .replace(/\s+/g, ' ')
    .trim();
}

/** The collection weekday(s): the first named day, plus any joined to it by "et" ("lundis et les jeudis"). */
export function parseDays(text: string): number[] {
  const t = clean(text).toLowerCase();
  // A shared semi-buried container takes waste any day; a weekday in that text is for bulky items.
  if (/conteneur semi-enfoui/.test(t) && !/jour de collecte/.test(t)) return [];
  const day = `(${DAYS.join('|')})s?`;
  const first = t.match(new RegExp(`\\b${day}\\b`));
  if (!first) return [];
  const out = [DAYS.indexOf(first[1])];
  const rest = t.slice((first.index ?? 0) + first[0].length);
  const more = rest.match(new RegExp(`^\\s*(?:,|et)\\s*(?:les?\\s+)?${day}\\b`));
  if (more) out.push(DAYS.indexOf(more[1]));
  return out;
}

export const isBiweekly = (text: string) => /sur deux|deux semaines|2 semaines/i.test(clean(text));

/** Every full date in a sentence, including shared-month lists like "le 23 et le 30 décembre 2026". */
export function datesIn(sentence: string): string[] {
  const re = new RegExp(`((?:\\d{1,2}(?:er)?\\s*(?:,|et)?\\s*(?:le\\s+)?)+)(${MONTHS.join('|')})\\s+(\\d{4})`, 'gi');
  const out: string[] = [];
  for (const m of sentence.matchAll(re)) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    for (const d of m[1].match(/\d{1,2}/g) ?? []) {
      out.push(`${m[3]}-${String(month).padStart(2, '0')}-${d.padStart(2, '0')}`);
    }
  }
  return out;
}

/**
 * Holiday changes: dates in the "pas de collecte" sentence are cancelled; dates in the next sentence that
 * reschedules them ("reportées", "devancées", "auront lieu") are the new days, paired in order.
 */
export function parseExceptions(text: string, stream: Stream): Exception[] {
  const sentences = clean(text).split(/\.\s+|\.(?=[A-ZÀ-Ý])/);
  const i = sentences.findIndex((s) => /pas de collecte/i.test(s));
  if (i < 0) return [];
  const cancelled = datesIn(sentences[i]);
  const j = sentences.findIndex((s, k) => k >= i && /report|devanc|aur(?:a|ont) lieu/i.test(s));
  // The rescheduling clause may share the sentence; take only the dates after its keyword.
  const after = j < 0 ? '' : j === i ? sentences[i].slice(sentences[i].search(/report|devanc|aur(?:a|ont) lieu/i)) : sentences[j];
  const moved = datesIn(after);
  const cancelledOnly = j === i ? datesIn(sentences[i].slice(0, sentences[i].search(/report|devanc|aur(?:a|ont) lieu/i))) : cancelled;
  return cancelledOnly.map((date, k) => ({
    date,
    stream,
    moveTo: moved[k] ?? null,
    note: moved[k] ? 'Holiday: moved' : 'Holiday: no pickup',
  }));
}

type Props = { ID: string; MESSAGE_FR?: string | null; MESSAGE_EN?: string | null; EXCEPTION_FR?: string | null; EXCEPTION_EN?: string | null };

export function parseSector(p: Props, stream: Stream): Sector {
  const fr = `${p.MESSAGE_FR ?? ''} `;
  return {
    id: p.ID,
    stream,
    days: parseDays(fr),
    biweekly: isBiweekly(fr) || isBiweekly(p.EXCEPTION_FR ?? ''),
    note: clean(p.MESSAGE_EN || p.MESSAGE_FR),
    exceptions: parseExceptions(p.EXCEPTION_FR ?? '', stream),
  };
}
