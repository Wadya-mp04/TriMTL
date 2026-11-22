/**
 * The daily challenge: the same items for everyone on the same Montréal day, so the leaderboard is fair.
 */
import { CHALLENGE_POOL, SortItem } from '../data/items';

export const DAILY_SIZE = 7;

/** Today's date in Montréal (YYYY-MM-DD): the challenge changes at Montréal midnight for everyone. */
export function montrealDay(d = new Date()): string {
  try {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Montreal' });
  } catch {
    return d.toISOString().slice(0, 10); // shortcut: UTC day if the engine lacks time zones; fine for a demo
  }
}

/** Small seeded random generator (mulberry32 over a string hash): same day, same sequence on every phone. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's challenge items: a seeded pick from the Montréal pool, identical for every player that day. */
export function dailyItems(day = montrealDay()): SortItem[] {
  const rand = seeded(day);
  const pool = CHALLENGE_POOL.filter((i) => i.bin !== null);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DAILY_SIZE);
}
