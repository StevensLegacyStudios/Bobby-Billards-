import { haversineMeters, type LngLat } from "./geo";

/**
 * Real driving routes from the public OSRM demo server (keyless). Falls back
 * to a straight line when the router is unreachable so the planner always
 * produces a corridor.
 */

export interface DrivingRoute {
  polyline: LngLat[];
  distanceMeters: number;
  durationSeconds: number;
  /** false when the router failed and we fell back to a straight line. */
  isRoadRoute: boolean;
  /** The highway/road this route spends the most distance on, e.g. "I-5" — best-effort, from OSRM turn-by-turn step names. */
  via?: string;
}

interface OsrmStep {
  distance: number;
  name?: string;
  ref?: string;
}
interface OsrmRoute {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs?: { steps?: OsrmStep[] }[];
}

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

/** The named road (ref like "I-5"/"CA-99", falling back to the street name) this route spends the most distance on. */
function dominantRoadName(route: OsrmRoute): string | undefined {
  const totals = new Map<string, number>();
  for (const leg of route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      const label = (step.ref || step.name)?.trim();
      if (!label) continue;
      totals.set(label, (totals.get(label) ?? 0) + step.distance);
    }
  }
  let best: string | undefined;
  let bestDistance = 0;
  for (const [label, distance] of totals) {
    if (distance > bestDistance) {
      best = label;
      bestDistance = distance;
    }
  }
  return best;
}

function fallbackRoute(from: LngLat, to: LngLat): DrivingRoute {
  return {
    polyline: [from, to],
    distanceMeters: haversineMeters(from, to),
    durationSeconds: (haversineMeters(from, to) / 1609.344 / 55) * 3600, // ~55 mph guess
    isRoadRoute: false,
  };
}

/**
 * Every driving route OSRM can find between two points — not just the
 * fastest. Riders often care more about which highway a route runs (I-5 vs
 * 99, say) than shaving a few minutes, so this always returns every
 * alternative OSRM offers (deduped by dominant road) rather than picking one
 * for the caller.
 */
export async function fetchDrivingRoutes(from: LngLat, to: LngLat): Promise<DrivingRoute[]> {
  const fallback = fallbackRoute(from, to);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `${OSRM_ENDPOINT}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&alternatives=true&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [fallback];
    const data = (await res.json()) as { code: string; routes?: OsrmRoute[] };
    const routes = data.code === "Ok" ? (data.routes ?? []) : [];
    const valid = routes.filter((r) => r.geometry.coordinates.length >= 2);
    if (valid.length === 0) return [fallback];

    const mapped = valid.map((route) => ({
      polyline: simplifyPolyline(route.geometry.coordinates as LngLat[], 120),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      isRoadRoute: true,
      via: dominantRoadName(route),
    }));

    // OSRM occasionally returns two "alternatives" that run the same highway
    // for nearly the whole trip — keep the shortest one per dominant road.
    const byRoad = new Map<string, DrivingRoute>();
    const unnamed: DrivingRoute[] = [];
    for (const route of mapped) {
      if (!route.via) {
        unnamed.push(route);
        continue;
      }
      const existing = byRoad.get(route.via);
      if (!existing || route.distanceMeters < existing.distanceMeters) byRoad.set(route.via, route);
    }
    return [...byRoad.values(), ...unnamed].sort((a, b) => a.durationSeconds - b.durationSeconds);
  } catch {
    return [fallback];
  }
}

export async function fetchDrivingRoute(from: LngLat, to: LngLat): Promise<DrivingRoute> {
  const [first] = await fetchDrivingRoutes(from, to);
  return first;
}

/**
 * Douglas–Peucker simplification with a tolerance in meters, so shared trip
 * URLs and the PostGIS corridor query stay compact without visibly changing
 * the drawn route.
 */
export function simplifyPolyline(points: LngLat[], toleranceMeters: number): LngLat[] {
  if (points.length <= 2) return points;

  const latRef = (points[0][1] * Math.PI) / 180;
  const mPerDegLng = 111_320 * Math.cos(latRef);
  const mPerDegLat = 110_540;
  const toXY = (p: LngLat): [number, number] => [p[0] * mPerDegLng, p[1] * mPerDegLat];

  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    const [ax, ay] = toXY(points[start]);
    const [bx, by] = toXY(points[end]);
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;

    let maxDist = 0;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = toXY(points[i]);
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
      const dist = Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > toleranceMeters) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
