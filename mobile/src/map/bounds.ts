/** [[west, south], [east, north]] in degrees. */
export type Bounds = [[number, number], [number, number]];

/** The box around the outlines of one or more zones' polygons ([lng, lat] rings); holes cannot extend it. */
export function boundsOf(zones: { polygons: [number, number][][][] }[]): Bounds | null {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const z of zones) {
    for (const [outer] of z.polygons) {
      for (const [lng, lat] of outer ?? []) {
        if (lng < w) w = lng;
        if (lng > e) e = lng;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}
