/**
 * Next-collection maths for the Map tab. Pure and dependency-free so it can be tested with `node --test`.
 * Dates are local calendar days as "YYYY-MM-DD"; arithmetic is done on whole days so DST never shifts a pickup.
 */

export type Stream = 'garbage' | 'recycling' | 'food' | 'yard' | 'bulky';

/** "Every `every` weeks on `weekday`, counting from a known collection day `anchor`." */
export type CollectionRule = { weekday: number; every: 1 | 2; anchor: string };

/** A holiday change: the pickup on `date` moves to `moveTo`, or is cancelled when `moveTo` is null. */
export type Exception = { date: string; stream: Stream | 'both'; moveTo: string | null; note: string };

export type Pickup = { date: string; streams: Stream[]; note?: string };

const DAY = 86_400_000;
const toDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
};
const toKey = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Today's local date as a key (the device's own day, never UTC). */
export const localKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (key: string, n: number) => toKey(toDay(key) + n);
export const daysBetween = (from: string, to: string) => toDay(to) - toDay(from);
/** 0 = Sunday … 6 = Saturday, like Date#getDay. */
export const weekdayOf = (key: string) => new Date(toDay(key) * DAY).getUTCDay();

/** Every pickup of one stream in [from, from + days), after holiday exceptions. */
export function occurrences(rule: CollectionRule, stream: Stream, from: string, days: number, exceptions: Exception[] = []) {
  const start = toDay(from);
  const anchor = toDay(rule.anchor);
  const out: { date: string; note?: string }[] = [];
  // Look a week back too, so a pickup moved forward into the window is still found.
  for (let n = start - 7; n < start + days; n++) {
    const weeks = (n - anchor) / 7;
    if (new Date(n * DAY).getUTCDay() !== rule.weekday || ((weeks % rule.every) + rule.every) % rule.every !== 0) continue;
    const key = toKey(n);
    const ex = exceptions.find((e) => e.date === key && (e.stream === stream || e.stream === 'both'));
    const date = ex ? ex.moveTo : key;
    if (date && toDay(date) >= start && toDay(date) < start + days) out.push({ date, note: ex?.note });
  }
  return out;
}

/** The next pickup of a stream on or after `today`, or null if none in the next eight weeks. */
export function nextPickup(rule: CollectionRule, stream: Stream, today: string, exceptions: Exception[] = []) {
  return occurrences(rule, stream, today, 56, exceptions).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** One weekday rule per stream (a sector can collect on two days); all merged by day, soonest first. */
export function upcoming(rules: { stream: Stream; rule: CollectionRule; exceptions?: Exception[] }[], today: string, days: number): Pickup[] {
  const byDate = new Map<string, Pickup>();
  for (const { stream, rule, exceptions } of rules) {
    for (const o of occurrences(rule, stream, today, days, exceptions)) {
      const p = byDate.get(o.date) ?? { date: o.date, streams: [] };
      if (!p.streams.includes(stream)) p.streams.push(stream);
      if (o.note) p.note = o.note;
      byDate.set(o.date, p);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** A weekly rule for a weekday, anchored on a known date with that weekday (any works for weekly). */
export const weekly = (weekday: number): CollectionRule => ({ weekday, every: 1, anchor: addDays('2026-11-01', weekday) });

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortWeekday = (key: string) => WD[weekdayOf(key)];

/** "Today", "Tomorrow, Tue", "Friday", "Tue, Dec 2". */
export function humanDay(key: string, today: string) {
  const n = daysBetween(today, key);
  const wd = WD[weekdayOf(key)];
  if (n === 0) return 'Today';
  if (n === 1) return `Tomorrow, ${wd}`;
  if (n > 1 && n < 7) return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayOf(key)];
  return `${wd}, ${MO[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;
}

/** "today", "tomorrow", "in 3 days". */
export function countdown(key: string, today: string) {
  const n = daysBetween(today, key);
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
}

/** "17:00" -> "5 pm", "08:30" -> "8:30 am". */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 || h === 24 ? 'am' : 'pm'}`;
}

/** Opening status from Sunday-first "HH:MM-HH:MM" hours: { open, label: "Closes at 5 pm" | "Opens Tue 9 am" }. */
export function openStatus(hours: (string | null)[], now: Date) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const span = (s: string) => s.split('-').map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3)));
  const today = hours[now.getDay()];
  if (today) {
    const [o, c] = span(today);
    if (o === 0 && c === 1440) return { open: true, label: 'Open 24 hours' };
    if (mins >= o && mins < c) return { open: true, label: `Closes at ${clock(today.split('-')[1])}` };
    if (mins < o) return { open: false, label: `Opens at ${clock(today.split('-')[0])}` };
  }
  for (let i = 1; i <= 7; i++) {
    const h = hours[(now.getDay() + i) % 7];
    if (h) return { open: false, label: `Opens ${i === 1 ? 'tomorrow' : WD[(now.getDay() + i) % 7]} ${clock(h.split('-')[0])}` };
  }
  return { open: false, label: 'Hours not listed' };
}

/** The nth weekdays of each month ("1st and 3rd Wednesday") in [from, from + days). */
export function monthlyDates(weekday: number, nths: number[], from: string, days: number) {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const key = addDays(from, i);
    if (weekdayOf(key) === weekday && nths.includes(Math.ceil(Number(key.slice(8)) / 7))) out.push(key);
  }
  return out;
}
