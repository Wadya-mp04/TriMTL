import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadScanHistory } from './scanHistory.ts';

function fakeHistory(failAt?: number, abort?: AbortController) {
  const cursors: (number | undefined)[] = [];
  const source = Array.from({ length: 2050 }, (_, i) => ({ id: 2050 - i, scanned_at: '2026-11-22T12:00:00Z' }));
  const client = { from(table: string) {
    assert.equal(table, 'scanned_items');
    let cursor: number | undefined;
    let size = 0;
    const query = {
      select() { return query; },
      eq(key: string, value: string) { assert.equal(key, 'user_id'); assert.equal(value, 'user-a'); return query; },
      order(key: string) { assert.equal(key, 'id'); return query; },
      limit(n: number) { size = n; return query; },
      lt(key: string, value: number) { assert.equal(key, 'id'); cursor = value; return query; },
      async abortSignal() {
        cursors.push(cursor);
        if (cursors.length === failAt) return { data: null, error: new Error('offline') };
        if (abort) abort.abort();
        return { data: source.filter((row) => cursor === undefined || row.id < cursor).slice(0, size), error: null };
      },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { client, cursors };
}

test('history loads past 200 and 1000 rows using a stable cursor and user filter', async () => {
  const { client, cursors } = fakeHistory();
  const rows = await loadScanHistory(client, 'user-a', new AbortController().signal);
  assert.equal(rows.length, 2050);
  assert.equal(new Set(rows.map((row) => row.id)).size, 2050);
  assert.deepEqual(cursors.slice(0, 3), [undefined, 1851, 1651]);
  assert.equal(rows.at(-1)?.id, 1);
});

test('a failed later page reports an error rather than a complete-looking partial library', async () => {
  const { client } = fakeHistory(2);
  await assert.rejects(loadScanHistory(client, 'user-a', new AbortController().signal), /offline/);
});

test('cancellation stops loading older pages on an account change', async () => {
  const controller = new AbortController();
  const { client, cursors } = fakeHistory(undefined, controller);
  assert.deepEqual(await loadScanHistory(client, 'user-a', controller.signal), []);
  assert.equal(cursors.length, 1);
});
