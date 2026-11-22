/**
 * Type-ahead street and address search for the Island of Montréal, on Photon (photon.komoot.io), a free
 * OpenStreetMap geocoder built for search-as-you-type. Nominatim, the usual choice, bans autocomplete.
 * Only the typed text leaves the device, and only while someone is typing in the search box.
 * shortcut: the public Photon server has a fair-use limit and no SLA; self-host it or pay for a provider
 * before this ships to many users.
 */
export type Suggestion = {
  id: string;
  /** "4200 Rue Saint-Denis", or the place's name. */
  title: string;
  /** "Le Plateau-Mont-Royal, Montreal". */
  subtitle: string;
  kind: 'address' | 'street';
  lat: number;
  lng: number;
};

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    county?: string;
  };
};

/** Photon tags every address on the island with this county (in English or French); Laval and the South Shore have their own. */
export const onIsland = (county?: string) => !!county && /agglom[ée]ration (de|of) montr[ée]al/i.test(county);

/** Suggestions on the island, de-duplicated; `offIsland` says results existed but all were elsewhere. */
export function parsePhoton(json: { features?: Feature[] }): { places: Suggestion[]; offIsland: boolean } {
  const features = json.features ?? [];
  const seen = new Set<string>();
  const places: Suggestion[] = [];
  for (const f of features) {
    const p = f.properties;
    if (!onIsland(p.county)) continue;
    const isStreet = p.type === 'street';
    const street = isStreet ? p.name : p.street;
    if (!street) continue;
    const address = `${p.housenumber ? `${p.housenumber} ` : ''}${street}`;
    // A named place ("Écocentre L'Acadie") leads with its name and keeps the address underneath.
    const named = !isStreet && p.name && p.name !== street;
    const where = [...new Set([p.district, p.city].filter(Boolean))].join(', ');
    const title = named ? p.name! : address;
    const subtitle = named ? [address, where].filter(Boolean).join(', ') : where;
    const key = `${title}|${subtitle}`;
    if (seen.has(key)) continue; // Photon returns one street once per segment
    seen.add(key);
    const [lng, lat] = f.geometry.coordinates;
    places.push({ id: `${p.osm_id ?? key}`, title, subtitle, kind: isStreet ? 'street' : 'address', lat, lng });
  }
  return { places, offIsland: places.length === 0 && features.length > 0 };
}

export async function suggest(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({
    q: query,
    limit: '8',
    lang: 'en',
    // The island and its edges; the county check above makes it exact. Biased to the island's middle.
    bbox: '-74.05,45.40,-73.47,45.73',
    lat: '45.55',
    lon: '-73.70',
  });
  params.append('layer', 'house');
  params.append('layer', 'street');
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!res.ok) throw new Error(`address search ${res.status}`);
  return parsePhoton(await res.json());
}
