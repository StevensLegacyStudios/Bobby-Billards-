"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarPlus,
  Eye,
  ListPlus,
  Megaphone,
  MousePointerClick,
  ShieldCheck,
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
import { DEMO_EVENTS, DEMO_VENUES } from "@/lib/demo-data";
import { VERIFIED_VENUE_PRICE_USD } from "@/lib/tier";
import type { VenueEvent } from "@/lib/types";

/** Deterministic pseudo-analytics per venue (stable across renders/SSR). */
function analyticsFor(venueId: string) {
  let h = 0;
  for (const ch of venueId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    pageViews: 1200 + (h % 4200),
    engagement: 280 + (h % 950),
    travelLogAdds: 35 + (h % 210),
    weekly: Array.from({ length: 8 }, (_, i) => 40 + ((h >> i) % 60)),
  };
}

export function B2bDashboardClient() {
  const searchParams = useSearchParams();
  const [venueId, setVenueId] = useState(DEMO_VENUES[0].id);
  const [verifyPending, setVerifyPending] = useState(false);
  const [demoVerified, setDemoVerified] = useState(searchParams.get("verified") === "demo");
  const [events, setEvents] = useState<VenueEvent[]>(DEMO_EVENTS);
  const [eventTitle, setEventTitle] = useState("");
  const [eventKind, setEventKind] = useState<VenueEvent["kind"]>("tournament");
  const [eventDate, setEventDate] = useState("");
  const [eventDetails, setEventDetails] = useState("");

  const venue = DEMO_VENUES.find((v) => v.id === venueId) ?? DEMO_VENUES[0];
  const isVerified = venue.is_verified || demoVerified;
  const stats = useMemo(() => analyticsFor(venue.id), [venue.id]);
  const venueEvents = events.filter((e) => e.venue_id === venue.id);

  const startVerification = async () => {
    setVerifyPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "verified_venue", venueId: venue.id }),
      });
      const data = await res.json();
      if (data.url?.startsWith("http")) {
        window.location.href = data.url;
      } else {
        // Demo grant — the Stripe webhook would flip is_verified in Supabase.
        setDemoVerified(true);
      }
    } finally {
      setVerifyPending(false);
    }
  };

  const publishEvent = () => {
    if (!eventTitle || !eventDate) return;
    setEvents((prev) => [
      {
        id: `local-${prev.length}`,
        venue_id: venue.id,
        kind: eventKind,
        title: eventTitle,
        starts_at: new Date(eventDate).toISOString(),
        details: eventDetails,
      },
      ...prev,
    ]);
    setEventTitle("");
    setEventDate("");
    setEventDetails("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Briefcase className="h-6 w-6 text-primary" /> Merchant Portal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your venue profile, analytics, events — and boost visibility with{" "}
            <Link href="/b2b/ads" className="text-primary underline">
              contextual CPC ads
            </Link>
            .
          </p>
        </div>
        <select
          value={venueId}
          onChange={(e) => {
            setVenueId(e.target.value);
            setDemoVerified(false);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {DEMO_VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* Verification workflow */}
      <Card className={isVerified ? "border-primary/50" : "border-accent/70"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className={`h-5 w-5 ${isVerified ? "text-primary" : "text-muted-foreground"}`} />
            Verified Venue Profile
          </CardTitle>
          <CardDescription>
            {isVerified
              ? "Your registration is confirmed. The verified badge, table specifications, and event publishing are live across the consumer app."
              : `Upload your business registration to activate the verified badge, publish table specifications, and unlock event publishing — $${VERIFIED_VENUE_PRICE_USD.toFixed(2)}/mo. Verification flips automatically when the Stripe provisioning webhook lands.`}
          </CardDescription>
        </CardHeader>
        {!isVerified && (
          <CardContent className="flex flex-wrap items-center gap-3">
            <Input type="file" className="max-w-xs" aria-label="Business registration document" />
            <Button onClick={startVerification} disabled={verifyPending}>
              {verifyPending ? "Starting checkout…" : `Verify for $${VERIFIED_VENUE_PRICE_USD.toFixed(2)}/mo`}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Analytics control panel */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" /> Page views (30d)
            </CardDescription>
            <CardTitle className="text-3xl">{stats.pageViews.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <MousePointerClick className="h-4 w-4" /> Engagement events
            </CardDescription>
            <CardTitle className="text-3xl">{stats.engagement.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ListPlus className="h-4 w-4" /> Travel log additions
            </CardDescription>
            <CardTitle className="text-3xl">{stats.travelLogAdds.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Weekly engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-2">
            {stats.weekly.map((v, i) => (
              <div key={i} className="flex-1">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${v}%` }}
                  title={`Week ${i + 1}: ${v} interactions/day avg`}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Last 8 weeks, daily average interactions.</p>
        </CardContent>
      </Card>

      {/* Event publishing */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="h-4 w-4 text-primary" /> Publish an event
            </CardTitle>
            <CardDescription>
              Brackets, tournament dates, and menu specials publish straight to your consumer
              venue page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="evt-title">Title</Label>
              <Input
                id="evt-title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Friday 8-Ball Bracket"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-kind">Type</Label>
                <select
                  id="evt-kind"
                  value={eventKind}
                  onChange={(e) => setEventKind(e.target.value as VenueEvent["kind"])}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="tournament">Tournament</option>
                  <option value="bracket">Bracket setup</option>
                  <option value="special">Menu special</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-date">Date &amp; time</Label>
                <Input
                  id="evt-date"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-details">Details</Label>
              <Input
                id="evt-details"
                value={eventDetails}
                onChange={(e) => setEventDetails(e.target.value)}
                placeholder="$15 entry, race to 4, handicapped"
              />
            </div>
            <Button onClick={publishEvent} disabled={!isVerified || !eventTitle || !eventDate}>
              {isVerified ? "Publish" : "Verification required to publish"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Published events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {venueEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing published yet.</p>
            ) : (
              venueEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{event.title}</span>
                    <Badge variant="outline">{event.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(event.starts_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {event.details ? ` — ${event.details}` : ""}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
