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
}

const OSRM_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

export async function fetchDrivingRoute(from: LngLat, to: LngLat): Promise<DrivingRoute> {
  const fallback: DrivingRoute = {
    polyline: [from, to],
    distanceMeters: haversineMeters(from, to),
    durationSeconds: (haversineMeters(from, to) / 1609.344 / 55) * 3600, // ~55 mph guess
    isRoadRoute: false,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const url = `${OSRM_ENDPOINT}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      code: string;
      routes?: { geometry: { coordinates: [number, number][] }; distance: number; duration: number }[];
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!route || route.geometry.coordinates.length < 2) return fallback;
    return {
      polyline: simplifyPolyline(route.geometry.coordinates as LngLat[], 120),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      isRoadRoute: true,
    };
  } catch {
    return fallback;
  }
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
