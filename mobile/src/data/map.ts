/**
 * The Map tab's only data source. Everything the tab shows comes through `loadMapData`, so swapping in real
 * data means changing this file and nothing else.
 *
 * Today it returns map.sample.json: real street shapes from OpenStreetMap with INVENTED schedules and
 * drop-offs, labelled "Sample" in the UI. Real sources to swap in (both CC-BY 4.0, Ville de Montréal):
 * - Collection sectors: donneesquebec.ca/recherche/dataset/vmtl-info-collectes (one GeoJSON of polygons per
 *   stream, with collection days). Sectors are zones, not streets; draw them as polygons.
 * - Écocentres and drop-off points: not verified yet; montreal.ca lists the écocentres with hours.
 */
import sample from './map.sample.json';
import type { CollectionRule, Exception } from '../map/schedule';

export type DropoffType = 'recycling' | 'ewaste' | 'hazardous' | 'compost' | 'donation';

export type Lane = {
  id: string;
  name: string;
  borough: string;
  /** [lat, lng] points along the street. */
  path: [number, number][];
  garbage: CollectionRule;
  recycling: CollectionRule;
  exceptions?: Exception[];
};

export type Dropoff = {
  id: string;
  type: DropoffType;
  name: string;
  address: string;
  lat: number;
  lng: number;
  materials: string[];
  /** Sunday-first; "HH:MM-HH:MM" or null when closed. */
  hours: (string | null)[];
};

export type MapData = { lanes: Lane[]; dropoffs: Dropoff[]; isSample: boolean };

export async function loadMapData(): Promise<MapData> {
  return { lanes: sample.lanes as Lane[], dropoffs: sample.dropoffs as Dropoff[], isSample: true };
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
