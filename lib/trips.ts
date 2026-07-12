import type { Trip } from "./types";

/**
 * Shareable trip links. Trips are persisted to public.trips when Supabase is
 * configured; the tripId in the URL is additionally a self-contained
 * base64url payload so collaboration links work even for anonymous users
 * and in offline/demo mode.
 */

export function encodeTripId(trip: Trip): string {
  const json = JSON.stringify(trip);
  const base64 =
    typeof window === "undefined"
      ? Buffer.from(json, "utf-8").toString("base64")
      : btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTripId(tripId: string): Trip | null {
  try {
    const base64 = tripId.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window === "undefined"
        ? Buffer.from(base64, "base64").toString("utf-8")
        : decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.polyline)) return null;
    return parsed as Trip;
  } catch {
    return null;
  }
}
