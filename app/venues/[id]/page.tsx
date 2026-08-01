import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Clock, Navigation, Phone, ShieldCheck, Star } from "lucide-react";

import BilliardCanvasLazy from "@/components/billiards/billiard-canvas-lazy";
import { VenueMap } from "@/components/venue-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_EVENTS, findDemoVenue } from "@/lib/demo-data";
import { solveDirectShot, POCKETS } from "@/lib/engine/trajectory";
import { WEEKDAY_NAMES } from "@/lib/hours";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Venue, VenueEvent } from "@/lib/types";

import { ValidationForm } from "./validation-form";

async function fetchVenue(id: string): Promise<Venue | null> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data } = await supabase
      .from("venues")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null; // With a live database, missing means missing.
    const coords = data.coordinates;
    return {
      ...data,
      lat: typeof coords === "object" ? coords?.coordinates?.[1] ?? 0 : 0,
      lng: typeof coords === "object" ? coords?.coordinates?.[0] ?? 0 : 0,
    } as Venue;
  }
  return findDemoVenue(id) ?? null;
}

async function fetchVenueEvents(venueId: string): Promise<VenueEvent[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("venue_events")
      .select("*")
      .eq("venue_id", venueId)
      .order("starts_at", { ascending: true });
    if (error || !data) return []; // With a live database, demo events would mislead.
    return data as VenueEvent[];
  }
  return DEMO_EVENTS.filter((e) => e.venue_id === venueId);
}

/** "Every Tuesday, 7pm" or "Aug 8, 2026, 12:00 PM". */
function formatEventWhen(event: VenueEvent): string {
  const starts = new Date(event.starts_at);
  if (event.recurs_weekly && event.weekday != null && WEEKDAY_NAMES[event.weekday]) {
    const hour = starts.getHours();
    const minute = starts.getMinutes();
    const meridiem = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const time =
      minute === 0
        ? `${hour12}${meridiem}`
        : `${hour12}:${String(minute).padStart(2, "0")}${meridiem}`;
    return `Every ${WEEKDAY_NAMES[event.weekday]}, ${time}`;
  }
  return starts.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const venue = await fetchVenue(id);
  return { title: venue?.name ?? "Venue" };
}

export default async function VenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await fetchVenue(id);
  if (!venue) notFound();

  const events = await fetchVenueEvents(venue.id);
  const houseShot = solveDirectShot([45, 65], [130, 42], POCKETS.top_right);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          {venue.is_verified && (
            <Badge variant="accent">
              <ShieldCheck className="h-3 w-3" /> Verified Venue Profile
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 text-accent-foreground" /> {venue.rating ?? "unrated"}
          </span>
          {venue.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-4 w-4" /> {venue.phone}
            </span>
          )}
          {venue.hours && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Object.entries(venue.hours)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </span>
          )}
        </div>
      </div>

      {venue.table_specifications && venue.table_specifications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {venue.table_specifications.map((spec) => (
            <Badge key={spec.label} variant="secondary">
              {spec.count}× {spec.label}
            </Badge>
          ))}
        </div>
      )}

      {venue.lat !== 0 && venue.lng !== 0 && (
        <Card className="overflow-hidden p-0">
          <VenueMap venue={venue} />
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <span className="text-sm text-muted-foreground">
              {venue.lat.toFixed(4)}, {venue.lng.toFixed(4)}
            </span>
            <Button asChild size="sm" variant="outline">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation className="h-4 w-4" /> Get directions
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>House table, house shot</CardTitle>
            <CardDescription>
              Interactive 3D layout — the classic cross-table cut to the top-right pocket.
              Drag to orbit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BilliardCanvasLazy
              cue={[45, 65]}
              objects={[[130, 42]]}
              trajectory={houseShot}
              className="h-[300px] w-full overflow-hidden rounded-lg"
            />
          </CardContent>
        </Card>

        <ValidationForm venue={venue} />
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" /> Upcoming at {venue.name}
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published events. Venue owners can publish brackets and specials from the
            B2B dashboard.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((event) => (
              <Card key={event.id}>
                <CardHeader>
                  <CardTitle className="text-base">{event.title}</CardTitle>
                  <CardDescription className="space-y-1.5">
                    <span className="block">
                      <Badge variant="outline" className="mr-2 capitalize">
                        {event.kind}
                      </Badge>
                      {formatEventWhen(event)}
                    </span>
                    {(event.entry_fee_cents != null || event.race_format || event.fargo_range) && (
                      <span className="flex flex-wrap gap-1.5">
                        {event.entry_fee_cents != null && (
                          <Badge variant="secondary">
                            {event.entry_fee_cents % 100 === 0
                              ? `$${event.entry_fee_cents / 100}`
                              : `$${(event.entry_fee_cents / 100).toFixed(2)}`}{" "}
                            entry
                          </Badge>
                        )}
                        {event.race_format && (
                          <Badge variant="secondary">{event.race_format}</Badge>
                        )}
                        {event.fargo_range && (
                          <Badge variant="secondary">Fargo {event.fargo_range}</Badge>
                        )}
                      </span>
                    )}
                    {event.details && <span className="block">{event.details}</span>}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
