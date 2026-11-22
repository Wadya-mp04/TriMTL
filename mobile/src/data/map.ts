/**
 * The Map tab's only data source; swapping a source means changing this file and nothing else. All real:
 *
 * - Collection days: collections.json, built by scripts/build-collections.ts from the Ville de Montréal
 *   "Secteurs Info-collectes" open data (CC-BY 4.0). It covers the city's 19 boroughs; the other cities on
 *   the island (Westmount, Mount Royal, Dorval…) run their own collection and are not in it.
 * - Écocentres: ecocentres.json, built by scripts/build-ecocentres.ts from RECYC-QUÉBEC's open data
 *   (CC-BY 4.0). It has no hours or accepted items, so those come from elsewhere or are linked, never made up.
 */
import collections from './collections.json';
import eco from './ecocentres.json';
import { rules } from './rules';
import rulesFile from '../../shared/data/quebecRules.json';
import type { Sector } from '../map/infoCollectes';

export type Dropoff = {
  id: string;
  name: string;
  /** Borough, or the city for a municipal écocentre. */
  area: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  /** What it takes, from the app's Montréal rules; null when it is run by another city. */
  materials: string[] | null;
  /** Where to check hours and conditions; no open data publishes them. */
  infoUrl: string;
  /** What to bring, from the rules file; null when it is run by another city. */
  note: string | null;
};

/** Items Montréal's rules send to an écocentre (the same list the Scan tab answers with). */
const ECOCENTRE_ITEMS = rules.RULES.filter((r) => r.dropoff === 'ecocentre').map((r) => r.name.en);
const MONTREAL_LIST = 'https://montreal.ca/lieux?mtl_content.lieux.type.code=ECOC&orderBy=dc_title';

/** [lng, lat] rings; the first ring is the outline, the rest are holes. */
export type Zone = Sector & { polygons: [number, number][][][] };

export type MapData = {
  zones: Zone[];
  dropoffs: Dropoff[];
  source: string;
  sourceUrl: string;
  fetchedOn: string;
};

export async function loadMapData(): Promise<MapData> {
  return {
    zones: collections.sectors as Zone[],
    dropoffs: eco.ecocentres.map((e) => ({
      ...e,
      materials: e.city === 'Montréal' ? ECOCENTRE_ITEMS : null,
      note: e.city === 'Montréal' ? rulesFile.dropoffs.ecocentre.note?.en ?? null : null,
      // shortcut: other island cities are linked by search; add each city's own page if more appear.
      infoUrl: e.city === 'Montréal' ? MONTREAL_LIST : `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.city} horaire`)}`,
    })),
    source: collections.source,
    sourceUrl: collections.sourceUrl,
    fetchedOn: collections.fetchedOn,
  };
}

export const zoneKey = (z: Pick<Zone, 'stream' | 'id'>) => `${z.stream}:${z.id}`;

function inRing(lng: number, lat: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/** The garbage and recycling sectors a point falls in (either may be missing). */
export function zonesAt(zones: Zone[], p: { lat: number; lng: number }) {
  const hit = (z: Zone) => z.polygons.some(([outer, ...holes]) => inRing(p.lng, p.lat, outer) && !holes.some((h) => inRing(p.lng, p.lat, h)));
  return { garbage: zones.find((z) => z.stream === 'garbage' && hit(z)), recycling: zones.find((z) => z.stream === 'recycling' && hit(z)) };
}

/** OSM tags every address on the island with this county; Laval and the South Shore have their own. */
export const onIsland = (county?: string) => !!county && /Agglomération de Montréal/i.test(county);

/**
 * Street and address search, Island of Montréal only (the trial's scope). Sends only the typed text.
 * Returns 'off-island' when the place exists but is not on the island.
 */
export async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | 'off-island' | null> {
  // The bbox narrows the search to the island and its edges; the county check below makes it exact.
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ca&viewbox=-73.98,45.71,-73.47,45.41&bounded=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TriMTL/1.0 (map trial)', 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string; address?: { county?: string } }[];
  const hit = hits.find((h) => onIsland(h.address?.county));
  if (!hit) return hits.length ? 'off-island' : null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name.split(',').slice(0, 2).join(',') };
}
