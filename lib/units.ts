/** US-customary distance helpers — the app displays miles everywhere. */

const METERS_PER_MILE = 1609.344;

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE;
}

export function milesToMeters(mi: number): number {
  return mi * METERS_PER_MILE;
}

/** "0.4 mi", "12 mi" — one decimal under 10 miles, whole numbers above. */
export function formatMiles(meters: number): string {
  const mi = metersToMiles(meters);
  if (mi < 0.1) return `${Math.round(meters * 3.28084)} ft`;
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function formatDriveTime(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
