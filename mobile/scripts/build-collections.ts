/**
 * Builds src/data/collections.json from the Ville de Montréal "Secteurs Info-collectes" GeoJSON
 * (donneesquebec.ca/recherche/dataset/vmtl-info-collectes, CC-BY 4.0).
 *
 * Usage: node scripts/build-collections.ts <ordures> <matieres-recyclables> <residus-alimentaires>
 *   <matieres-organiques> <residus-verts> <crd-et-encombrants> [YYYY-MM-DD]   (all .geojson)
 * Organics (food and yard waste in one brown bin, in some boroughs) is stored as the food stream.
 * Download both files from the dataset page in a browser; the portal refuses scripted downloads.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { parseSector } from '../src/map/infoCollectes.ts';

type Ring = [number, number][];
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

// Douglas-Peucker in degrees; 0.00004 is about 3-4 m at Montréal's latitude, below street width.
function simplify(pts: Ring, tol = 0.00004): Ring {
  if (pts.length < 4) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / (Math.hypot(dx, dy) || 1);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

const round = (r: Ring): Ring => r.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);

// A ring starts and ends on the same point, which has no chord to measure against, so split it at the
// point farthest from the start and simplify each half.
function simplifyRing(r: Ring): Ring {
  let far = 0;
  r.forEach(([x, y], i) => { if (Math.hypot(x - r[0][0], y - r[0][1]) > Math.hypot(r[far][0] - r[0][0], r[far][1] - r[0][1])) far = i; });
  return [...simplify(r.slice(0, far + 1)).slice(0, -1), ...simplify(r.slice(far))];
}

function polygons(g: Geometry): Ring[][] {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.map((rings) => rings.map((r) => round(simplifyRing(r))).filter((r) => r.length >= 4)).filter((p) => p.length);
}

const args = process.argv.slice(2);
const fetchedOn = /^\d{4}-\d\d-\d\d$/.test(args[args.length - 1]) ? args.pop()! : new Date().toISOString().slice(0, 10);
const [ordures, recyclables, food, organics, yard, bulky] = args;
const files = [[ordures, 'garbage', ''], [recyclables, 'recycling', ''], [food, 'food', ''], [organics, 'food', 'MO:'], [yard, 'yard', ''], [bulky, 'bulky', '']] as const;
const sectors = [];
for (const [file, stream, prefix] of files) {
  if (!file) continue;
  const fc = JSON.parse(readFileSync(file, 'utf8')) as { features: { properties: Record<string, string>; geometry: Geometry | null }[] };
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const s = parseSector(f.properties as never, stream);
    sectors.push({ ...s, id: prefix + s.id, polygons: polygons(f.geometry) });
  }
}

const out = {
  source: 'Ville de Montréal, Secteurs Info-collectes (CC-BY 4.0)',
  sourceUrl: 'https://donneesquebec.ca/recherche/dataset/vmtl-info-collectes',
  fetchedOn,
  sectors,
};
writeFileSync(new URL('../src/data/collections.json', import.meta.url), JSON.stringify(out));
for (const stream of ['garbage', 'recycling', 'food', 'yard', 'bulky']) {
  const list = sectors.filter((x) => x.stream === stream);
  const unread = list.filter((s) => !s.days.length && !s.dates?.length && !s.seeOther);
  console.log(`${stream}: ${list.length} sectors, ${list.filter((s) => s.dates).length} with listed dates, ${list.filter((s) => s.monthly).length} monthly, ${list.filter((s) => s.seeOther).length} covered by another collection, unread: ${unread.map((s) => s.id).join(' ') || 'none'}`);
}
console.log('every other week:', sectors.filter((s) => s.biweekly).length);
console.log('holiday changes:', sectors.reduce((n, s) => n + s.exceptions.length, 0));
