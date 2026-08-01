"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Car,
  Check,
  Clock,
  Download,
  Link2,
  Loader2,
  MapPin,
  Megaphone,
  Route,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOfflineMaps } from "@/hooks/use-offline-maps";
import { useTier } from "@/hooks/use-tier";
import { DEMO_CAMPAIGNS, DEMO_VENUES } from "@/lib/demo-data";
import { distanceToPolylineMeters, toWktLineString, type LngLat } from "@/lib/geo";
import { geocodeCity, searchPlaces, type GeocodedPlace } from "@/lib/geocode";
import { fetchDrivingRoute } from "@/lib/routing";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { decodeTripId, encodeTripId } from "@/lib/trips";
import { formatDriveTime, formatMiles, milesToMeters } from "@/lib/units";
import type { Trip, Venue } from "@/lib/types";

const TripMap = dynamic(() => import("@/components/trip-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-xl bg-card">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

const FREE_MAX_DETOUR_MI = 10;
const PREMIUM_MAX_DETOUR_MI = 60;

/** City input with live geocoder suggestions (any US city, not a canned list). */
function CityInput({
  id,
  label,
  value,
  onChange,
  onResolved,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onResolved: (place: GeocodedPlace | null) => void;
  placeholder: string;
}) {
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (next: string) => {
    onChange(next);
    onResolved(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const places = await searchPlaces(next, controller.signal);
        setSuggestions(places);
        setOpen(places.length > 0);
      } catch {
        // Aborted — a newer keystroke owns the request.
      }
    }, 250);
  };

  return (
    <div className="relative space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          {suggestions.map((p) => (
            <li key={`${p.label}-${p.lngLat.join(",")}`}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.label);
                  onResolved(p);
                  setOpen(false);
                }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TripPlannerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPremium } = useTier();
  const offline = useOfflineMaps();
  const maxDetour = isPremium ? PREMIUM_MAX_DETOUR_MI : FREE_MAX_DETOUR_MI;

  const [origin, setOrigin] = useState("Stockton, CA");
  const [destination, setDestination] = useState("San Jose, CA");
  const [originPlace, setOriginPlace] = useState<GeocodedPlace | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<GeocodedPlace | null>(null);
  const [bufferMi, setBufferMi] = useState(5);
  const [planning, setPlanning] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [drive, setDrive] = useState<{ distanceMeters: number; durationSeconds: number; isRoadRoute: boolean } | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [adNotice, setAdNotice] = useState<string | null>(null);

  const runCorridorQuery = useCallback(async (activeTrip: Trip) => {
    setSearching(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data, error: rpcError } = await supabase.rpc("get_venues_in_corridor", {
          route_polyline: toWktLineString(activeTrip.polyline),
          buffer_meters: activeTrip.buffer_meters,
        });
        if (!rpcError && data) {
          setVenues(data as Venue[]);
          return;
        }
      }
      const matched = DEMO_VENUES.map((v) => ({
        ...v,
        distance_from_route_m: distanceToPolylineMeters([v.lng, v.lat], activeTrip.polyline),
      }))
        .filter((v) => v.distance_from_route_m! <= activeTrip.buffer_meters)
        .sort((a, b) => a.distance_from_route_m! - b.distance_from_route_m!);
      setVenues(matched);
    } finally {
      setSearching(false);
    }
  }, []);

  const planTrip = useCallback(async () => {
    setPlanning(true);
    setError(null);
    try {
      const from = originPlace ?? (await geocodeCity(origin));
      const to = destinationPlace ?? (await geocodeCity(destination));
      if (!from) {
        setError(`Couldn't find "${origin}" — try adding the state, like "Half Moon Bay, CA".`);
        return;
      }
      if (!to) {
        setError(`Couldn't find "${destination}" — try adding the state, like "Monterey, CA".`);
        return;
      }
      setOriginPlace(from);
      setDestinationPlace(to);

      const route = await fetchDrivingRoute(from.lngLat, to.lngLat);
      setDrive({
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        isRoadRoute: route.isRoadRoute,
      });
      setTrip({
        id: crypto.randomUUID(),
        origin: from.label,
        destination: to.label,
        polyline: route.polyline,
        buffer_meters: milesToMeters(Math.min(bufferMi, maxDetour)),
        created_at: new Date().toISOString(),
      });
    } finally {
      setPlanning(false);
    }
  }, [origin, destination, originPlace, destinationPlace, bufferMi, maxDetour]);

  // Hydrate from a shared ?tripId= link — state adjustment during render.
  const tripIdParam = searchParams.get("tripId");
  const [hydratedTripId, setHydratedTripId] = useState<string | null>(null);
  if (tripIdParam && tripIdParam !== hydratedTripId) {
    setHydratedTripId(tripIdParam);
    const shared = decodeTripId(tripIdParam);
    if (shared && shared.id !== trip?.id) {
      setOrigin(shared.origin);
      setDestination(shared.destination);
      setBufferMi(Math.max(1, Math.round(shared.buffer_meters / 1609.344)));
      setTrip(shared);
      setDrive(null);
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
        setAdNotice(`Sponsored click billed: ${(data.chargedCents / 100).toFixed(2)} USD`);
        setTimeout(() => setAdNotice(null), 4000);
      }
    },
    [trip]
  );

  const mapOrigin = trip
    ? { name: trip.origin, lngLat: trip.polyline[0] as LngLat }
    : undefined;
  const mapDestination = trip
    ? { name: trip.destination, lngLat: trip.polyline[trip.polyline.length - 1] as LngLat }
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Route className="h-7 w-7 text-primary" /> Road Trip Planner
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Enter any two cities and see every pool room worth a detour — on a real map,
          with real driving routes and distances in miles.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto_auto]">
          <CityInput
            id="origin"
            label="From"
            value={origin}
            onChange={setOrigin}
            onResolved={setOriginPlace}
            placeholder="Stockton, CA"
          />
          <CityInput
            id="destination"
            label="To"
            value={destination}
            onChange={setDestination}
            onResolved={setDestinationPlace}
            placeholder="Half Moon Bay, CA"
          />
          <div className="space-y-1.5">
            <Label htmlFor="buffer">Max detour (miles)</Label>
            <Input
              id="buffer"
              type="number"
              min={1}
              max={maxDetour}
              value={bufferMi}
              onChange={(e) => setBufferMi(Number(e.target.value) || 1)}
              className="w-full sm:w-32"
            />
            {!isPremium && (
              <p className="text-[11px] text-muted-foreground">
                Free tier caps detours at {FREE_MAX_DETOUR_MI} mi.{" "}
                <Link href="/upgrade" className="text-primary underline">
                  Upgrade
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-end">
            <Button onClick={() => void planTrip()} disabled={planning}>
              {planning ? <Loader2 className="animate-spin" /> : <Route />}
              {planning ? "Routing…" : "Find pool rooms"}
            </Button>
          </div>
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
          {drive && (
            <Badge variant="outline">
              <Car className="h-3 w-3" /> {formatMiles(drive.distanceMeters)}
              {drive.isRoadRoute ? ` · ${formatDriveTime(drive.durationSeconds)}` : " (straight-line est.)"}
            </Badge>
          )}
          <Badge variant="outline">
            {searching ? (
              <>
                <Clock className="h-3 w-3 animate-pulse" /> searching…
              </>
            ) : (
              `${venues.length} pool room${venues.length === 1 ? "" : "s"} on route`
            )}
          </Badge>
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

      {trip && (
        <Card className="overflow-hidden p-0">
          <TripMap
            route={trip.polyline as LngLat[]}
            bufferMeters={trip.buffer_meters}
            venues={venues}
            origin={mapOrigin}
            destination={mapDestination}
            className="h-[420px] w-full sm:h-[480px]"
          />
        </Card>
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
                {formatMiles(boosted.venue.distance_from_route_m!)} off route
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
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5">
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
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {formatMiles(venue.distance_from_route_m!)} off route
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-accent" />
                        {venue.rating ?? "–"}
                      </span>
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

      {trip && venues.length === 0 && !searching && !error && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No pool rooms inside this corridor — widen the max detour.
        </p>
      )}
    </div>
  );
}
