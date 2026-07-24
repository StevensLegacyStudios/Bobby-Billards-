"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Clock,
  Download,
  Link2,
  MapPin,
  Megaphone,
  Route,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOfflineMaps } from "@/hooks/use-offline-maps";
import { useTier } from "@/hooks/use-tier";
import { DEMO_CAMPAIGNS, DEMO_CITIES, DEMO_VENUES } from "@/lib/demo-data";
import { distanceToPolylineMeters, toWktLineString, type LngLat } from "@/lib/geo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { decodeTripId, encodeTripId } from "@/lib/trips";
import type { Trip, Venue } from "@/lib/types";

function geocode(name: string): LngLat | null {
  return DEMO_CITIES[name.trim().toLowerCase()] ?? null;
}

/**
 * Approximate a driving route: straight line origin → destination, detoured
 * through any known waypoint city lying within 3x the corridor buffer.
 * (A production build would call a routing provider here.)
 */
function buildPolyline(origin: LngLat, destination: LngLat, bufferMeters: number): LngLat[] {
  const direct: LngLat[] = [origin, destination];
  const waypoints = Object.values(DEMO_CITIES)
    .filter((c) => c !== origin && c !== destination)
    .filter((c) => distanceToPolylineMeters(c, direct) < bufferMeters * 3)
    .map((c) => {
      // Sort by progress along the route.
      const t =
        ((c[0] - origin[0]) * (destination[0] - origin[0]) +
          (c[1] - origin[1]) * (destination[1] - origin[1])) /
        ((destination[0] - origin[0]) ** 2 + (destination[1] - origin[1]) ** 2 || 1);
      return { c, t };
    })
    .filter(({ t }) => t > 0.05 && t < 0.95)
    .sort((a, b) => a.t - b.t)
    .map(({ c }) => c);
  return [origin, ...waypoints, destination];
}

export function TripPlannerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPremium } = useTier();
  const offline = useOfflineMaps();

  const [origin, setOrigin] = useState("Stockton");
  const [destination, setDestination] = useState("San Jose");
  const [bufferKm, setBufferKm] = useState(8);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [queryMs, setQueryMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [adNotice, setAdNotice] = useState<string | null>(null);

  const runCorridorQuery = useCallback(async (activeTrip: Trip) => {
    const started = performance.now();
    const supabase = getSupabaseBrowserClient();

    if (supabase) {
      const { data, error: rpcError } = await supabase.rpc("get_venues_in_corridor", {
        route_polyline: toWktLineString(activeTrip.polyline),
        buffer_meters: activeTrip.buffer_meters,
      });
      if (!rpcError && data) {
        setVenues(data as Venue[]);
        setQueryMs(performance.now() - started);
        return;
      }
      // Fall through to demo data on RPC failure so the page stays usable.
    }

    const matched = DEMO_VENUES.map((v) => ({
      ...v,
      distance_from_route_m: distanceToPolylineMeters([v.lng, v.lat], activeTrip.polyline),
    }))
      .filter((v) => v.distance_from_route_m! <= activeTrip.buffer_meters)
      .sort((a, b) => a.distance_from_route_m! - b.distance_from_route_m!);
    setVenues(matched);
    setQueryMs(performance.now() - started);
  }, []);

  const planTrip = useCallback(
    (originName: string, destinationName: string, bufferMeters: number) => {
      const from = geocode(originName);
      const to = geocode(destinationName);
      if (!from || !to) {
        setError(
          `Unknown city. Demo geocoder knows: ${Object.keys(DEMO_CITIES)
            .map((c) => c.replace(/\b\w/g, (m) => m.toUpperCase()))
            .join(", ")}.`
        );
        return;
      }
      setError(null);
      setTrip({
        id: crypto.randomUUID(),
        origin: originName,
        destination: destinationName,
        polyline: buildPolyline(from, to, bufferMeters),
        buffer_meters: bufferMeters,
        created_at: new Date().toISOString(),
      });
    },
    []
  );

  // Hydrate from a shared ?tripId= link — state adjustment during render.
  const tripIdParam = searchParams.get("tripId");
  const [hydratedTripId, setHydratedTripId] = useState<string | null>(null);
  if (tripIdParam && tripIdParam !== hydratedTripId) {
    setHydratedTripId(tripIdParam);
    const shared = decodeTripId(tripIdParam);
    if (shared && shared.id !== trip?.id) {
      setOrigin(shared.origin);
      setDestination(shared.destination);
      setBufferKm(Math.round(shared.buffer_meters / 1000));
      setTrip(shared);
    }
  }

  // Run the corridor query whenever a new trip becomes active.
  const queriedTripId = useRef<string | null>(null);
  useEffect(() => {
    if (!trip || queriedTripId.current === trip.id) return;
    queriedTripId.current = trip.id;
    void runCorridorQuery(trip);
  }, [trip, runCorridorQuery]);

  const shareTrip = useCallback(async () => {
    if (!trip) return;
    const tripId = encodeTripId(trip);
    const url = `${window.location.origin}/trip-planner?tripId=${tripId}`;
    router.replace(`/trip-planner?tripId=${tripId}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Share link: ${url}`);
    }
  }, [trip, router]);

  const boosted = useMemo(() => {
    if (venues.length === 0) return null;
    const candidates = DEMO_CAMPAIGNS.filter(
      (c) => c.status === "active" && venues.some((v) => v.id === c.venue_id)
    ).sort((a, b) => b.bid_cpc_cents - a.bid_cpc_cents);
    if (candidates.length === 0) return null;
    const venue = venues.find((v) => v.id === candidates[0].venue_id)!;
    return { campaign: candidates[0], venue };
  }, [venues]);

  const trackAdClick = useCallback(
    async (campaignId: string) => {
      const res = await fetch("/api/ads/click-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          routeContext: trip ? `${trip.origin} → ${trip.destination}` : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdNotice(`Sponsored click billed: ${(data.chargedCents / 100).toFixed(2)} USD (second-price auction)`);
        setTimeout(() => setAdNotice(null), 4000);
      }
    },
    [trip]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Route className="h-6 w-6 text-primary" /> Corridor Trip Planner
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outline a route and we&apos;ll buffer it into a spatial corridor to find every
          billiard room worth a detour.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="origin">Origin</Label>
            <Input
              id="origin"
              list="bb-cities"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Stockton"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              list="bb-cities"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="San Jose"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buffer">Detour buffer (km)</Label>
            <Input
              id="buffer"
              type="number"
              min={1}
              max={isPremium ? 100 : 15}
              value={bufferKm}
              onChange={(e) => setBufferKm(Number(e.target.value) || 1)}
              className="w-full sm:w-32"
            />
            {!isPremium && (
              <p className="text-[11px] text-muted-foreground">
                Free tier caps detours at 15 km.{" "}
                <Link href="/upgrade" className="text-primary underline">
                  Upgrade
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button
              onClick={() =>
                planTrip(origin, destination, Math.min(bufferKm, isPremium ? 100 : 15) * 1000)
              }
            >
              Find venues
            </Button>
          </div>
          <datalist id="bb-cities">
            {Object.keys(DEMO_CITIES).map((c) => (
              <option key={c} value={c.replace(/\b\w/g, (m) => m.toUpperCase())} />
            ))}
          </datalist>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {trip && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {trip.origin} → {trip.destination}
          </Badge>
          {queryMs !== null && (
            <Badge variant={queryMs <= 150 ? "accent" : "outline"}>
              <Clock className="h-3 w-3" /> corridor query {queryMs.toFixed(0)}ms
              {queryMs <= 150 ? " ✓ <150ms budget" : ""}
            </Badge>
          )}
          <Badge variant="outline">{venues.length} venues in corridor</Badge>
          <Button size="sm" variant="outline" onClick={shareTrip}>
            {copied ? <Check /> : <Link2 />} {copied ? "Link copied" : "Share trip"}
          </Button>
          {isPremium ? (
            offline.savedTripIds.has(trip.id) ? (
              <Button size="sm" variant="ghost" onClick={() => offline.remove(trip.id)} disabled={offline.busy}>
                <Trash2 /> Remove offline copy
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => offline.download(trip, venues)}
                disabled={offline.busy}
              >
                <Download /> Save for offline
              </Button>
            )
          ) : (
            <Button size="sm" variant="ghost" asChild>
              <Link href="/upgrade">
                <Download /> Offline (Premium)
              </Link>
            </Button>
          )}
        </div>
      )}

      {adNotice && (
        <div className="rounded-md border border-accent bg-accent/10 px-3 py-2 text-xs">
          {adNotice}
        </div>
      )}

      {boosted && (
        <Link
          href={`/venues/${boosted.venue.id}`}
          onClick={() => void trackAdClick(boosted.campaign.id)}
        >
          <Card className="border-accent/70 bg-accent/5 transition-colors hover:border-accent">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-accent-foreground" />
                  {boosted.venue.name}
                </span>
                <Badge variant="accent">Sponsored</Badge>
              </CardTitle>
              <CardDescription>
                Boosted along your route · {boosted.venue.rating} ★ ·{" "}
                {(boosted.venue.distance_from_route_m! / 1000).toFixed(1)} km off corridor
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {venues
          .filter((v) => v.id !== boosted?.venue.id)
          .map((venue) => (
            <Link key={venue.id} href={`/venues/${venue.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {venue.name}
                    {venue.is_verified && (
                      <Badge variant="accent">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {(venue.distance_from_route_m! / 1000).toFixed(1)} km off route ·{" "}
                      {venue.rating ?? "–"} ★
                    </span>
                    <span>
                      {venue.cloth_quality?.replaceAll("_", " ") ?? "cloth unverified"} ·{" "}
                      {venue.pocket_widths?.replaceAll("_", " ") ?? "pockets unverified"}
                    </span>
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
      </div>

      {trip && venues.length === 0 && !error && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No venues inside this corridor — widen the detour buffer.
        </p>
      )}
    </div>
  );
}
