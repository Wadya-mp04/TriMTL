/**
 * Builds src/data/collections.json from the Ville de Montréal "Secteurs Info-collectes" GeoJSON
 * (donneesquebec.ca/recherche/dataset/vmtl-info-collectes, CC-BY 4.0).
 *
 * Usage: node scripts/build-collections.ts <ordures.geojson> <matieres-recyclables.geojson> [YYYY-MM-DD]
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

const [ordures, recyclables, fetchedOn = new Date().toISOString().slice(0, 10)] = process.argv.slice(2);
const sectors = [];
for (const [file, stream] of [[ordures, 'garbage'], [recyclables, 'recycling']] as const) {
  const fc = JSON.parse(readFileSync(file, 'utf8')) as { features: { properties: Record<string, string>; geometry: Geometry | null }[] };
  for (const f of fc.features) {
    if (!f.geometry) continue;
    sectors.push({ ...parseSector(f.properties as never, stream), polygons: polygons(f.geometry) });
  }
}

const out = {
  source: 'Ville de Montréal, Secteurs Info-collectes (CC-BY 4.0)',
  sourceUrl: 'https://donneesquebec.ca/recherche/dataset/vmtl-info-collectes',
  fetchedOn,
  sectors,
};
writeFileSync(new URL('../src/data/collections.json', import.meta.url), JSON.stringify(out));
const by = (s: string) => sectors.filter((x) => x.stream === s);
console.log(`garbage ${by('garbage').length}, recycling ${by('recycling').length}`);
console.log('no day found:', sectors.filter((s) => !s.days.length).map((s) => `${s.stream}:${s.id}`).join(' ') || 'none');
console.log('every other week:', sectors.filter((s) => s.biweekly).length);
console.log('holiday changes:', sectors.reduce((n, s) => n + s.exceptions.length, 0));
