/**
 * Lightweight spherical geometry helpers used by the demo corridor matcher
 * (the production path runs PostGIS ST_DWithin inside get_venues_in_corridor).
 * Coordinates are [lng, lat] pairs, distances in meters.
 */

const EARTH_RADIUS_M = 6_371_000;

export type LngLat = [number, number];

export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Distance from a point to a polyline, approximated by projecting onto each
 * segment in a locally-flat equirectangular frame. Accurate to well under 1%
 * at corridor scales (< 100km), which is all the demo fallback needs.
 */
export function distanceToPolylineMeters(point: LngLat, polyline: LngLat[]): number {
  if (polyline.length === 0) return Number.POSITIVE_INFINITY;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  const toRad = (d: number) => (d * Math.PI) / 180;
  const latRef = toRad(point[1]);
  const project = (p: LngLat): [number, number] => [
    toRad(p[0]) * Math.cos(latRef) * EARTH_RADIUS_M,
    toRad(p[1]) * EARTH_RADIUS_M,
  ];

  const [px, py] = project(point);
  let best = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [ax, ay] = project(polyline[i]);
    const [bx, by] = project(polyline[i + 1]);
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
    const cx = ax + t * abx;
    const cy = ay + t * aby;
    best = Math.min(best, Math.hypot(px - cx, py - cy));
  }
  return best;
}

/** Serialize a polyline to WKT LINESTRING for the PostGIS RPC. */
export function toWktLineString(polyline: LngLat[]): string {
  const coords = polyline.map(([lng, lat]) => `${lng} ${lat}`).join(", ");
  return `LINESTRING(${coords})`;
}
