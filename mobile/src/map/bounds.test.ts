import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boundsOf } from './bounds.ts';

const square = (w: number, s: number, e: number, n: number): [number, number][] => [[w, s], [e, s], [e, n], [w, n], [w, s]];

test('box around several zones and every polygon of a multipolygon', () => {
  const a = { polygons: [[square(-73.60, 45.50, -73.58, 45.52)], [square(-73.70, 45.55, -73.65, 45.58)]] };
  const b = { polygons: [[square(-73.59, 45.49, -73.57, 45.53)]] };
  assert.deepEqual(boundsOf([a, b]), [[-73.70, 45.49], [-73.57, 45.58]]);
});

test('a hole does not widen the box, and no zones means no box', () => {
  const holed = { polygons: [[square(-73.6, 45.5, -73.5, 45.6), square(-74, 45, -73, 46)]] };
  assert.deepEqual(boundsOf([holed]), [[-73.6, 45.5], [-73.5, 45.6]]);
  assert.equal(boundsOf([]), null);
});
