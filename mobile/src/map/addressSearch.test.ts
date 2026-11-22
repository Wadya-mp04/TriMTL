// Shapes taken from live Photon responses (22 Nov 2026). Run: npm test.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onIsland, parsePhoton } from './addressSearch.ts';

const island = 'Urban agglomeration of Montreal';
const house = (o: object) => ({ geometry: { coordinates: [-73.57, 45.52] as [number, number] }, properties: { type: 'house', county: island, city: 'Montreal', district: 'Le Plateau-Mont-Royal', ...o } });

test('island county is recognised in English and French, Laval is not', () => {
  assert.ok(onIsland('Urban agglomeration of Montreal'));
  assert.ok(onIsland('Agglomération de Montréal'));
  assert.ok(!onIsland(undefined));
  assert.ok(!onIsland('Laval (administrative region)'));
});

test('a house becomes "number street" with its district and city underneath', () => {
  const { places } = parsePhoton({ features: [house({ osm_id: 1, housenumber: '4200', street: 'Rue Saint-Denis' })] });
  assert.deepEqual(places.map((p) => [p.title, p.subtitle, p.kind]), [['4200 Rue Saint-Denis', 'Le Plateau-Mont-Royal, Montreal', 'address']]);
  assert.equal(places[0].lat, 45.52);
});

test('a named place leads with its name and keeps the address', () => {
  const { places } = parsePhoton({ features: [house({ osm_id: 2, housenumber: '1200', street: 'Boulevard Henri-Bourassa Ouest', name: "Écocentre L'Acadie", district: 'Ahuntsic-Cartierville' })] });
  assert.equal(places[0].title, "Écocentre L'Acadie");
  assert.equal(places[0].subtitle, '1200 Boulevard Henri-Bourassa Ouest, Ahuntsic-Cartierville, Montreal');
});

test('streets repeat once per segment and are shown once', () => {
  const street = { type: 'street', name: 'Avenue du Mont-Royal Est' };
  const { places } = parsePhoton({ features: [house({ ...street, osm_id: 3 }), house({ ...street, osm_id: 4 })] });
  assert.equal(places.length, 1);
  assert.equal(places[0].kind, 'street');
});

test('Laval results are dropped, and reported as off-island only when nothing is left', () => {
  const laval = { geometry: { coordinates: [-73.75, 45.57] as [number, number] }, properties: { type: 'street', name: 'Boulevard Le Carrefour', city: 'Laval' } };
  assert.deepEqual(parsePhoton({ features: [laval] }), { places: [], offIsland: true });
  const mixed = parsePhoton({ features: [laval, house({ osm_id: 5, housenumber: '1', street: 'Rue Berri' })] });
  assert.equal(mixed.places.length, 1);
  assert.equal(mixed.offIsland, false);
  assert.deepEqual(parsePhoton({ features: [] }), { places: [], offIsland: false });
});
