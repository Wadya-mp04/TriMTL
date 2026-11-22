// Run: npm test (node --test, no extra dependency).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countdown, humanDay, nextPickup, openStatus, upcoming, weekly, type CollectionRule } from './schedule.ts';

// 2026-11-23 is a Monday.
const weeklyTue: CollectionRule = { weekday: 2, every: 1, anchor: '2026-11-03' };
const biweeklyThu: CollectionRule = { weekday: 4, every: 2, anchor: '2026-11-19' };

test('weekly: next Tuesday, and today when today is the day', () => {
  assert.equal(nextPickup(weeklyTue, 'garbage', '2026-11-23')?.date, '2026-11-24');
  assert.equal(nextPickup(weeklyTue, 'garbage', '2026-11-24')?.date, '2026-11-24');
  assert.equal(nextPickup(weeklyTue, 'garbage', '2026-11-25')?.date, '2026-12-01');
});

test('biweekly: skips the off week, counted from the anchor', () => {
  assert.equal(nextPickup(biweeklyThu, 'recycling', '2026-11-20')?.date, '2026-12-03');
  assert.equal(nextPickup(biweeklyThu, 'recycling', '2026-12-03')?.date, '2026-12-03');
  // An anchor in the future still lines up with the same weeks.
  assert.equal(nextPickup({ ...biweeklyThu, anchor: '2027-01-14' }, 'recycling', '2026-11-20')?.date, '2026-12-03');
});

test('holiday: a moved pickup lands on the new day, a cancelled one falls to the next cycle', () => {
  const xmas = [
    { date: '2026-12-29', stream: 'garbage' as const, moveTo: '2026-12-30', note: 'Moved for the holidays' },
    { date: '2026-12-31', stream: 'both' as const, moveTo: null, note: 'No collection' },
  ];
  const p = nextPickup(weeklyTue, 'garbage', '2026-12-28', xmas);
  assert.deepEqual(p, { date: '2026-12-30', note: 'Moved for the holidays' });
  // Thursday Dec 31 is a biweekly recycling day (Dec 3 + 4 weeks); cancelled, so the next is Jan 14.
  assert.equal(nextPickup(biweeklyThu, 'recycling', '2026-12-30', xmas)?.date, '2027-01-14');
});

test('holiday: a pickup moved forward from before the window is still found', () => {
  const ex = [{ date: '2026-11-24', stream: 'garbage' as const, moveTo: '2026-11-26', note: 'Moved' }];
  assert.equal(nextPickup(weeklyTue, 'garbage', '2026-11-25', ex)?.date, '2026-11-26');
});

test('DST: the November clock change does not shift a day', () => {
  assert.equal(nextPickup({ weekday: 0, every: 1, anchor: '2026-10-25' }, 'garbage', '2026-10-31')?.date, '2026-11-01');
});

test('upcoming merges both streams on the same day', () => {
  const days = upcoming([{ stream: 'garbage', rule: { weekday: 4, every: 1, anchor: '2026-11-19' } }, { stream: 'recycling', rule: biweeklyThu }], '2026-11-30', 7);
  assert.deepEqual(days, [{ date: '2026-12-03', streams: ['garbage', 'recycling'] }]);
});

test('human labels', () => {
  assert.equal(humanDay('2026-11-23', '2026-11-23'), 'Today');
  assert.equal(humanDay('2026-11-24', '2026-11-23'), 'Tomorrow, Tue');
  assert.equal(humanDay('2026-11-27', '2026-11-23'), 'Friday');
  assert.equal(humanDay('2026-12-02', '2026-11-23'), 'Wed, Dec 2');
  assert.equal(countdown('2026-11-25', '2026-11-23'), 'in 2 days');
});

test('opening hours: open, before opening, after close, closed days', () => {
  const hours = [null, '09:00-17:00', '09:00-17:00', null, null, null, null];
  const mon = (h: number, m = 0) => new Date(2026, 10, 23, h, m); // Monday
  assert.deepEqual(openStatus(hours, mon(10)), { open: true, label: 'Closes at 5 pm' });
  assert.deepEqual(openStatus(hours, mon(8, 30)), { open: false, label: 'Opens at 9 am' });
  assert.deepEqual(openStatus(hours, mon(17)), { open: false, label: 'Opens tomorrow 9 am' });
  assert.deepEqual(openStatus(hours, new Date(2026, 10, 25, 12)), { open: false, label: 'Opens Mon 9 am' });
  assert.equal(openStatus(Array(7).fill('00:00-24:00'), mon(3)).label, 'Open 24 hours');
});

test('weekly(): any weekday anchors to a date that is that weekday', () => {
  for (let d = 0; d < 7; d++) assert.equal(nextPickup(weekly(d), 'garbage', '2026-11-23')?.date.length, 10);
  assert.equal(nextPickup(weekly(3), 'garbage', '2026-11-23')?.date, '2026-11-25');
});
