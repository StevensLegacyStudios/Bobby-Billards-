"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Crosshair,
  Loader2,
  LocateFixed,
  MapPin,
  Moon,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_EVENTS, DEMO_VENUES, findDemoVenue } from "@/lib/demo-data";
import { haversineMeters } from "@/lib/geo";
import { searchPlaces, type GeocodedPlace } from "@/lib/geocode";
import { getOpenStatus, WEEKDAY_NAMES } from "@/lib/hours";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatMiles, milesToMeters } from "@/lib/units";
import type { TableSpecification, VenueEvent } from "@/lib/types";

const STORAGE_KEY = "bb-tonight-location";
const DEFAULT_RADIUS_MI = 25;
const WIDE_RADIUS_MI = 100;
const MAX_RESULTS = 30;

interface SavedLocation {
  label: string;
  lat: number;
  lng: number;
}

interface NearbyVenue {
  id: string;
  name: string;
  phone: string | null;
  hours: Record<string, string> | null;
  rating: number | null;
  is_verified: boolean;
  cloth_quality: string | null;
  table_specifications: TableSpecification[] | null;
  lat: number;
  lng: number;
}

type EventWithVenue = VenueEvent & { venues?: { name: string } | null };

/** Raw venues row as the browser client returns it (PostGIS point as GeoJSON). */
interface VenueRow extends Omit<NearbyVenue, "lat" | "lng"> {
  coordinates: { coordinates?: [number, number] } | string | null;
}

/** City input with live geocoder suggestions — same pattern as the trip planner. */
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

/** "7pm", "11:30am" from an ISO timestamp, in the viewer's local time. */
function eventTime(iso: string): string {
  const d = new Date(iso);
  const hour = d.getHours();
  const minute = d.getMinutes();
  const meridiem = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${hour12}${meridiem}`
    : `${hour12}:${String(minute).padStart(2, "0")}${meridiem}`;
}

function formatEntryFee(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function EventCard({ event, showWhen }: { event: EventWithVenue; showWhen: string }) {
  const venueName = event.venues?.name ?? findDemoVenue(event.venue_id)?.name ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span>{event.title}</span>
          <Badge variant="outline" className="shrink-0 capitalize">
            {event.kind}
          </Badge>
        </CardTitle>
        <CardDescription className="space-y-1.5">
          <span className="block">
            {showWhen}
            {venueName && (
              <>
                {" · "}
                <Link href={`/venues/${event.venue_id}`} className="text-primary hover:underline">
                  {venueName}
                </Link>
              </>
            )}
          </span>
          {(event.entry_fee_cents != null || event.race_format || event.fargo_range) && (
            <span className="flex flex-wrap gap-1.5">
              {event.entry_fee_cents != null && (
                <Badge variant="secondary">{formatEntryFee(event.entry_fee_cents)} entry</Badge>
              )}
              {event.race_format && <Badge variant="secondary">{event.race_format}</Badge>}
              {event.fargo_range && <Badge variant="secondary">Fargo {event.fargo_range}</Badge>}
            </span>
          )}
          {event.details && <span className="block">{event.details}</span>}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function TonightClient() {
  const [location, setLocation] = useState<SavedLocation | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [radiusMi, setRadiusMi] = useState(DEFAULT_RADIUS_MI);

  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [events, setEvents] = useState<EventWithVenue[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Restore the last location so returning players skip the prompt. Deferred a
  // microtask so hydration finishes before state changes land.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as SavedLocation;
        if (typeof saved?.lat === "number" && typeof saved?.lng === "number" && saved.label) {
          setLocation(saved);
          setCityQuery(saved.label === "Current location" ? "" : saved.label);
        }
      } catch {
        // Corrupt storage — start fresh.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyLocation = (next: SavedLocation) => {
    setLocation(next);
    setGeoError(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode) — the session still works.
    }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoError("This browser has no location support — search by city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        applyLocation({
          label: "Current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setGeoError("Couldn't read your location — search by city instead.");
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  };

  // Load the venue directory once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("venues")
            .select(
              "id, name, phone, hours, rating, is_verified, cloth_quality, table_specifications, coordinates"
            );
          if (!error && data && !cancelled) {
            const parsed = (data as VenueRow[]).map((row) => {
              const coords = row.coordinates;
              return {
                ...row,
                lat: typeof coords === "object" ? (coords?.coordinates?.[1] ?? 0) : 0,
                lng: typeof coords === "object" ? (coords?.coordinates?.[0] ?? 0) : 0,
              };
            });
            setVenues(parsed);
            return;
          }
        }
        if (!cancelled) setVenues(DEMO_VENUES);
      } finally {
        if (!cancelled) setVenuesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the event calendar once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("venue_events")
            .select("*, venues(name)")
            .order("starts_at", { ascending: true });
          if (!error && data && !cancelled) {
            setEvents(data as EventWithVenue[]);
            return;
          }
        }
        if (!cancelled) {
          setEvents(
            DEMO_EVENTS.map((e) => ({
              ...e,
              venues: { name: findDemoVenue(e.venue_id)?.name ?? "Pool room" },
            }))
          );
        }
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nearby = useMemo(() => {
    if (!location) return { list: [] as (NearbyVenue & { distanceM: number })[], beyond: 0 };
    const withDistance = venues
      .filter((v) => v.lat !== 0 || v.lng !== 0)
      .map((v) => ({
        ...v,
        distanceM: haversineMeters([location.lng, location.lat], [v.lng, v.lat]),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
    const withinRadius = withDistance.filter((v) => v.distanceM <= milesToMeters(radiusMi));
    return {
      list: withinRadius.slice(0, MAX_RESULTS),
      beyond: withDistance.length - withinRadius.length,
    };
  }, [venues, location, radiusMi]);

  const groupedEvents = useMemo(() => {
    const now = new Date();
    const today = now.getDay();
    const weekOut = new Date(now);
    weekOut.setDate(weekOut.getDate() + 7);

    const tonight: { event: EventWithVenue; when: string }[] = [];
    const thisWeek: { event: EventWithVenue; when: string; sortKey: number }[] = [];

    for (const event of events) {
      const starts = new Date(event.starts_at);
      if (Number.isNaN(starts.getTime())) continue;
      const time = eventTime(event.starts_at);

      if (event.recurs_weekly && event.weekday != null) {
        if (event.weekday === today) {
          tonight.push({ event, when: `Tonight · ${time}` });
        } else {
          const daysAhead = (event.weekday - today + 7) % 7;
          thisWeek.push({
            event,
            when: `Every ${WEEKDAY_NAMES[event.weekday]} · ${time}`,
            sortKey: daysAhead,
          });
        }
      } else if (sameLocalDay(starts, now)) {
        tonight.push({ event, when: `Today · ${time}` });
      } else if (starts > now && starts <= weekOut) {
        thisWeek.push({
          event,
          when: `${starts.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · ${time}`,
          sortKey: (starts.getTime() - now.getTime()) / 86_400_000,
        });
      }
    }

    tonight.sort(
      (a, b) => new Date(a.event.starts_at).getHours() - new Date(b.event.starts_at).getHours()
    );
    thisWeek.sort((a, b) => a.sortKey - b.sortKey);
    return { tonight, thisWeek };
  }, [events]);

  const statusNow = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Moon className="h-7 w-7 text-primary" /> Tonight
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Where to play tonight — rooms open near you right now, and what&apos;s on the
          calendar this week.
        </p>
      </div>

      {/* Location picker */}
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-[auto_1fr_auto]">
          <div className="flex items-end">
            <Button onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              {locating ? "Locating…" : "Use my location"}
            </Button>
          </div>
          <CityInput
            id="tonight-city"
            label="Or search by city"
            value={cityQuery}
            onChange={setCityQuery}
            onResolved={(place) => {
              if (place) {
                applyLocation({ label: place.label, lat: place.lngLat[1], lng: place.lngLat[0] });
              }
            }}
            placeholder="Stockton, CA"
          />
          {location && (
            <div className="flex items-end">
              <Badge variant="secondary" className="h-9 px-3">
                <MapPin className="h-3.5 w-3.5" /> {location.label}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {geoError && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">{geoError}</CardContent>
        </Card>
      )}

      {/* Nearby rooms */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Crosshair className="h-5 w-5 text-primary" /> Open tables near you
        </h2>

        {!location ? (
          <p className="text-sm text-muted-foreground">
            Share your location or pick a city and we&apos;ll line up the nearest rooms,
            sorted by distance, with live open-now status.
          </p>
        ) : venuesLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the room list…
          </p>
        ) : nearby.list.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No pool rooms within {radiusMi} miles of {location.label}.
              {nearby.beyond > 0 &&
                ` There ${nearby.beyond === 1 ? "is" : "are"} ${nearby.beyond} more further out — widen the search to see ${nearby.beyond === 1 ? "it" : "them"}.`}
            </p>
            {radiusMi < WIDE_RADIUS_MI && nearby.beyond > 0 && (
              <Button variant="outline" size="sm" onClick={() => setRadiusMi(WIDE_RADIUS_MI)}>
                Widen search to {WIDE_RADIUS_MI} miles
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {nearby.list.map((venue) => {
                const status = getOpenStatus(venue.hours, statusNow);
                return (
                  <Card key={venue.id} className="table-card">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-2 text-base">
                        <Link href={`/venues/${venue.id}`} className="hover:text-primary">
                          {venue.name}
                        </Link>
                        {venue.is_verified && (
                          <Badge variant="accent" className="shrink-0">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {formatMiles(venue.distanceM)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-accent" /> {venue.rating ?? "–"}
                        </span>
                        {status?.isOpen && (
                          <Badge variant="outline" className="border-primary/60 text-primary">
                            Open{status.closesAt ? ` · closes ${status.closesAt}` : ""}
                          </Badge>
                        )}
                        {status && !status.isOpen && status.opensAt && (
                          <Badge variant="secondary" className="text-muted-foreground">
                            Opens {status.opensAt}
                          </Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-3 pt-0 text-sm">
                      {venue.phone ? (
                        <a
                          href={`tel:${venue.phone.replace(/[^+\d]/g, "")}`}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-primary"
                        >
                          <Phone className="h-3.5 w-3.5" /> {venue.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No phone listed</span>
                      )}
                      <Link href={`/venues/${venue.id}`} className="text-primary hover:underline">
                        View venue
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {radiusMi < WIDE_RADIUS_MI && nearby.beyond > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setRadiusMi(WIDE_RADIUS_MI)}>
                Widen search to {WIDE_RADIUS_MI} miles ({nearby.beyond} more further out)
              </Button>
            )}
          </>
        )}
      </section>

      {/* Events */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" /> On the calendar
        </h2>

        {eventsLoading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pulling the bracket board…
          </p>
        ) : groupedEvents.tonight.length === 0 && groupedEvents.thisWeek.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing on the calendar this week. Venue owners and regulars can post
            tournaments and specials from the{" "}
            <Link href="/b2b/dashboard" className="text-primary underline">
              business dashboard
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-5">
            {groupedEvents.tonight.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Tonight
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groupedEvents.tonight.map(({ event, when }) => (
                    <EventCard key={event.id} event={event} showWhen={when} />
                  ))}
                </div>
              </div>
            )}
            {groupedEvents.thisWeek.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Later this week
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groupedEvents.thisWeek.map(({ event, when }) => (
                    <EventCard key={event.id} event={event} showWhen={when} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
