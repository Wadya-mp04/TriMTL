/**
 * Builds src/data/osmPoints.json: pharmacies and battery drop-off points on the Island of Montréal,
 * from OpenStreetMap (© OpenStreetMap contributors, ODbL). Community-mapped, so coverage is uneven and the
 * app says so.
 *
 * Usage: node scripts/build-osm-points.ts <overpass.json> [YYYY-MM-DD]
 * where overpass.json is the result of this query on overpass-api.de (relation 8508277 is the agglomeration):
 *   [out:json];area(id:3608508277)->.isl;
 *   (nwr["amenity"="pharmacy"](area.isl);nwr["healthcare"="pharmacy"](area.isl);nwr["recycling:batteries"="yes"](area.isl););
 *   out center tags;
 */
import { readFileSync, writeFileSync } from 'node:fs';

type El = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };

const [file, fetchedOn = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const els = (JSON.parse(readFileSync(file, 'utf8')) as { elements: El[] }).elements;
const eco = (JSON.parse(readFileSync(new URL('../src/data/ecocentres.json', import.meta.url), 'utf8')) as { ecocentres: { lat: number; lng: number }[] }).ecocentres;

const at = (e: El) => ({ lat: e.lat ?? e.center!.lat, lng: e.lon ?? e.center!.lon });
const address = (t: Record<string, string>) =>
  t['addr:street'] ? `${t['addr:housenumber'] ? `${t['addr:housenumber']}, ` : ''}${t['addr:street']}${t['addr:city'] ? `, ${t['addr:city']}` : ''}` : null;
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lng - b.lng) * 78_600, (a.lat - b.lat) * 111_200);

const pharmacies = els
  .filter((e) => e.tags.amenity === 'pharmacy' || e.tags.healthcare === 'pharmacy')
  .map((e) => ({ id: `osm-${e.type}-${e.id}`, name: e.tags.name ?? e.tags.brand ?? 'Pharmacy', ...at(e), address: address(e.tags), hours: e.tags.opening_hours ?? null }));

// What a recycling point says it takes, in the app's filter vocabulary.
const takes = (t: Record<string, string>) => [
  ...(t['recycling:batteries'] === 'yes' ? ['batteries'] : []),
  ...(['electronics', 'phones', 'mobile_phones', 'electrical_appliances', 'small_appliances'].some((k) => t[`recycling:${k}`] === 'yes') ? ['electronics'] : []),
  ...(['paint', 'engine_oil', 'gas_cylinders'].some((k) => t[`recycling:${k}`] === 'yes') ? ['hazardous'] : []),
];
const accepted = (t: Record<string, string>) =>
  Object.entries(t).filter(([k, v]) => k.startsWith('recycling:') && v === 'yes').map(([k]) => k.slice(10).replace(/_/g, ' '));

const batteryPoints = els
  .filter((e) => e.tags['recycling:batteries'] === 'yes')
  // The écocentres already come from RECYC-QUÉBEC; skip OSM's copy of the same place.
  .filter((e) => !eco.some((c) => metres(at(e), c) < 200))
  .map((e) => ({
    id: `osm-${e.type}-${e.id}`,
    name: e.tags.name ?? (e.tags.recycling_type === 'container' || e.tags.recycling_type === 'box' ? 'Battery drop-off box' : 'Battery drop-off'),
    ...at(e),
    address: address(e.tags),
    hours: e.tags.opening_hours ?? null,
    takes: takes(e.tags),
    accepted: accepted(e.tags),
  }));

writeFileSync(
  new URL('../src/data/osmPoints.json', import.meta.url),
  JSON.stringify({ source: '© OpenStreetMap contributors (ODbL)', fetchedOn, pharmacies, batteryPoints }),
);
console.log(`pharmacies ${pharmacies.length} (with hours ${pharmacies.filter((p) => p.hours).length}), battery points ${batteryPoints.length}`);
console.log(batteryPoints.map((b) => `${b.name} · ${b.address ?? 'no address'} · ${b.accepted.join(', ')}`).join('\n'));
