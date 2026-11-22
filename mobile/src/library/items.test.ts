import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupLibraryItems } from './items.ts';

const items = [
  { name: 'Bouteille', origName: 'Plastic bottle', bin: 'recycling' as const, detail: 'Plastique', note: 'Vider et rincer.' },
  { name: 'Batterie', bin: 'special' as const, detail: 'Écocentre', note: 'Apporter au dépôt.' },
  { name: 'Objet inconnu', bin: null, detail: '', note: '' },
];

test('search ignores accents and case and matches words across item fields', () => {
  assert.equal(groupLibraryItems(items, '  ECOCENTRE batterie  ').special.length, 1);
  assert.equal(groupLibraryItems(items, 'bottle rincer').recycling.length, 1);
  assert.equal(groupLibraryItems(items, 'battery compost').special.length, 0);
});

test('thousands of items stay separated by bin and keep newest-first input order', () => {
  const large = Array.from({ length: 5000 }, (_, id) => ({ ...items[id % items.length], id }));
  const groups = groupLibraryItems(large, '');
  assert.equal(Object.values(groups).reduce((n, group) => n + group.length, 0), 5000);
  assert.deepEqual(groups.recycling.slice(0, 3).map((item) => item.id), [0, 3, 6]);
  assert.ok(groups.unsure.length > 0);
  assert.equal(groupLibraryItems(large, 'does not exist').garbage.length, 0);
});
