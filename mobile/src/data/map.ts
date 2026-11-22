/**
 * The Map tab's only data source; swapping a source means changing this file and nothing else. All real:
 *
 * - Collection days: collections.json, built by scripts/build-collections.ts from the Ville de Montréal
 *   "Secteurs Info-collectes" open data (CC-BY 4.0). It covers the city's 19 boroughs; the other cities on
 *   the island (Westmount, Mount Royal, Dorval…) run their own collection and are not in it.
 * - Écocentres: ecocentres.json, built by scripts/build-ecocentres.ts from RECYC-QUÉBEC's open data
 *   (CC-BY 4.0). It has no hours or accepted items, so those come from elsewhere or are linked, never made up.
 * - Pharmacies and battery drop-offs: osmPoints.json, built by scripts/build-osm-points.ts from
 *   OpenStreetMap (ODbL). Community-mapped: pharmacies are well covered, battery points are not, so the
 *   app points to the official battery locator alongside them.
 * - What each place takes comes from the app's own Montréal sorting rules (quebecRules.json).
 */
import collections from './collections.json';
import eco from './ecocentres.json';
import osm from './osmPoints.json';
import rulesFile from '../../shared/data/quebecRules.json';
import type { Sector } from '../map/infoCollectes';

export type PlaceKind = 'ecocentre' | 'pharmacy' | 'battery';
/** The map's filters: what someone is carrying, not what kind of place it is. */
export type Material = 'batteries' | 'hazardous' | 'electronics' | 'medicines';

export type Dropoff = {
  id: string;
  kind: PlaceKind;
  name: string;
  /** Borough, city, or a short description. */
  area: string;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  /** Filter keys this place answers to; empty when unknown (shown under "All" only). */
  takes: Material[];
  /** Item names to show; null when unknown. */
  items: string[] | null;
  note: string | null;
  /** Hours as published by the source (OSM opening_hours text); null when not published. */
  hours: string | null;
  /** Where to check hours and conditions. */
  infoUrl: string | null;
  source: string;
};

const R = rulesFile as unknown as { items: { name: { en: string }; category: string; dropoff?: string | null }[]; dropoffs: Record<string, { note: { en: string } | null }> };
const itemsTo = (dropoff: string) => R.items.filter((r) => r.dropoff === dropoff);
/** Rule categories -> filter keys. */
const CATEGORY_MATERIAL: Record<string, Material> = { battery: 'batteries', hazardous: 'hazardous', automotive: 'hazardous', electronics: 'electronics', appliance: 'electronics', medical: 'medicines' };
const materialsOf = (dropoff: string) => [...new Set(itemsTo(dropoff).map((r) => CATEGORY_MATERIAL[r.category]).filter(Boolean))];

const MONTREAL_LIST = 'https://montreal.ca/lieux?mtl_content.lieux.type.code=ECOC&orderBy=dc_title';
export const BATTERY_LOCATOR = 'https://recycleyourbatteries.ca/find-a-drop-off-location/';

function places(): Dropoff[] {
  const ecocentres: Dropoff[] = eco.ecocentres.map((e) => {
    const mtl = e.city === 'Montréal';
    return {
      ...e,
      kind: 'ecocentre',
      takes: mtl ? materialsOf('ecocentre') : [],
      items: mtl ? itemsTo('ecocentre').map((r) => r.name.en) : null,
      note: mtl ? R.dropoffs.ecocentre?.note?.en ?? null : null,
      hours: null,
      // shortcut: other island cities are linked by search; add each city's own page if more appear.
      infoUrl: mtl ? MONTREAL_LIST : `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.city} horaire`)}`,
      source: 'RECYC-QUÉBEC open data',
    };
  });
  const pharmacies: Dropoff[] = osm.pharmacies.map((p) => ({
    ...p,
    kind: 'pharmacy',
    area: 'Pharmacy',
    city: null,
    takes: materialsOf('pharmacy'),
    items: itemsTo('pharmacy').map((r) => r.name.en),
    note: null,
    infoUrl: null,
    source: 'OpenStreetMap, community-mapped',
  }));
  const batteries: Dropoff[] = osm.batteryPoints.map((b) => ({
    ...b,
    kind: 'battery',
    area: 'Community-mapped drop-off',
    city: null,
    takes: b.takes as Material[],
    items: b.accepted.map((a) => a[0].toUpperCase() + a.slice(1)),
    note: null,
    infoUrl: BATTERY_LOCATOR,
    source: 'OpenStreetMap, community-mapped',
  }));
  return [...ecocentres, ...batteries, ...pharmacies];
}

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
    dropoffs: places(),
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
