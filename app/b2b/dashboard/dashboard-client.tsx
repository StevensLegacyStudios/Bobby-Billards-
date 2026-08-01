"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/hooks/use-auth";
import { DEMO_EVENTS, DEMO_VENUES } from "@/lib/demo-data";
import { WEEKDAY_NAMES } from "@/lib/hours";
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

interface OwnedVenue {
  id: string;
  name: string;
}

/** "Every Tuesday, 7pm" or a localized date-time. */
function describeWhen(event: VenueEvent): string {
  if (event.recurs_weekly && event.weekday != null && WEEKDAY_NAMES[event.weekday]) {
    const d = new Date(event.starts_at);
    const hour = d.getHours();
    const minute = d.getMinutes();
    const meridiem = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const time =
      minute === 0
        ? `${hour12}${meridiem}`
        : `${hour12}:${String(minute).padStart(2, "0")}${meridiem}`;
    return `Every ${WEEKDAY_NAMES[event.weekday]}, ${time}`;
  }
  return new Date(event.starts_at).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function B2bDashboardClient() {
  const searchParams = useSearchParams();
  const { user, supabase, configured } = useAuth();
  const [venueId, setVenueId] = useState(DEMO_VENUES[0].id);
  const [verifyPending, setVerifyPending] = useState(false);
  const [demoVerified, setDemoVerified] = useState(searchParams.get("verified") === "demo");

  // Owned venues (live mode). null = not loaded yet / not applicable.
  const [ownedVenues, setOwnedVenues] = useState<OwnedVenue[] | null>(null);
  const [postVenueId, setPostVenueId] = useState<string | null>(null);

  // Event form state.
  const [events, setEvents] = useState<VenueEvent[]>(DEMO_EVENTS);
  const [liveEvents, setLiveEvents] = useState<VenueEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventKind, setEventKind] = useState<VenueEvent["kind"]>("tournament");
  const [eventDate, setEventDate] = useState("");
  const [repeatsWeekly, setRepeatsWeekly] = useState(false);
  const [eventWeekday, setEventWeekday] = useState(2); // Tuesday — league night default.
  const [eventTime, setEventTime] = useState("19:00");
  const [eventFee, setEventFee] = useState("");
  const [eventRace, setEventRace] = useState("");
  const [eventFargo, setEventFargo] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [posting, setPosting] = useState(false);
  const [postStatus, setPostStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const venue = DEMO_VENUES.find((v) => v.id === venueId) ?? DEMO_VENUES[0];
  const isVerified = venue.is_verified || demoVerified;
  const stats = useMemo(() => analyticsFor(venue.id), [venue.id]);

  const liveMode = configured && Boolean(user);
  const canPostLive = liveMode && (ownedVenues?.length ?? 0) > 0;

  // Load venues the signed-in user owns, plus their published events.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Yield a microtask so state updates never run synchronously in the effect.
      await Promise.resolve();
      if (cancelled) return;
      if (!supabase || !user) {
        setOwnedVenues(null);
        setPostVenueId(null);
        return;
      }
      const { data, error } = await supabase
        .from("venues")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("name");
      if (cancelled) return;
      const owned = error ? [] : ((data ?? []) as OwnedVenue[]);
      setOwnedVenues(owned);
      setPostVenueId((prev) => prev ?? owned[0]?.id ?? null);
      if (owned.length > 0) {
        const { data: eventRows } = await supabase
          .from("venue_events")
          .select("*")
          .in(
            "venue_id",
            owned.map((v) => v.id)
          )
          .order("starts_at", { ascending: true });
        if (!cancelled && eventRows) setLiveEvents(eventRows as VenueEvent[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

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

  const formValid =
    eventTitle.trim().length > 0 && (repeatsWeekly ? eventTime.length > 0 : eventDate.length > 0);

  const resetForm = () => {
    setEventTitle("");
    setEventDate("");
    setEventFee("");
    setEventRace("");
    setEventFargo("");
    setEventDetails("");
  };

  const publishEvent = useCallback(async () => {
    if (!formValid) return;
    setPostStatus(null);

    // Resolve the first upcoming timestamp for the event.
    let startsAt: Date;
    if (repeatsWeekly) {
      const [hh, mm] = eventTime.split(":").map(Number);
      const now = new Date();
      startsAt = new Date(now);
      startsAt.setDate(now.getDate() + ((eventWeekday - now.getDay() + 7) % 7));
      startsAt.setHours(hh || 0, mm || 0, 0, 0);
      if (startsAt < now) startsAt.setDate(startsAt.getDate() + 7);
    } else {
      startsAt = new Date(eventDate);
      if (Number.isNaN(startsAt.getTime())) {
        setPostStatus({ ok: false, message: "That date and time didn't parse — check the field." });
        return;
      }
    }

    const feeDollars = eventFee.trim() === "" ? null : Number(eventFee);
    if (feeDollars !== null && (Number.isNaN(feeDollars) || feeDollars < 0)) {
      setPostStatus({ ok: false, message: "Entry fee must be a dollar amount, like 20 or 12.50." });
      return;
    }

    const payload = {
      kind: eventKind,
      title: eventTitle.trim(),
      starts_at: startsAt.toISOString(),
      details: eventDetails.trim() || null,
      recurs_weekly: repeatsWeekly,
      weekday: repeatsWeekly ? eventWeekday : null,
      entry_fee_cents: feeDollars === null ? null : Math.round(feeDollars * 100),
      race_format: eventRace.trim() || null,
      fargo_range: eventFargo.trim() || null,
    };

    if (canPostLive && supabase && user && postVenueId) {
      setPosting(true);
      try {
        const { data, error } = await supabase
          .from("venue_events")
          .insert({ ...payload, venue_id: postVenueId, created_by: user.id })
          .select()
          .single();
        if (error) {
          setPostStatus({ ok: false, message: `Couldn't publish: ${error.message}` });
          return;
        }
        setLiveEvents((prev) => [data as VenueEvent, ...prev]);
        setPostStatus({ ok: true, message: "Event published — it's live on Tonight and your venue page." });
        resetForm();
      } finally {
        setPosting(false);
      }
      return;
    }

    // Demo mode — local state only, mirroring the pre-Supabase behavior.
    setEvents((prev) => [
      { id: `local-${prev.length}`, venue_id: venue.id, ...payload, details: payload.details ?? "" },
      ...prev,
    ]);
    setPostStatus({ ok: true, message: "Event published to the demo calendar." });
    resetForm();
  }, [
    formValid,
    repeatsWeekly,
    eventTime,
    eventWeekday,
    eventDate,
    eventFee,
    eventKind,
    eventTitle,
    eventDetails,
    eventRace,
    eventFargo,
    canPostLive,
    supabase,
    user,
    postVenueId,
    venue.id,
  ]);

  const publishedEvents = canPostLive
    ? liveEvents.filter((e) => !postVenueId || e.venue_id === postVenueId)
    : events.filter((e) => e.venue_id === venue.id);

  const publishDisabled = posting || !formValid || (!canPostLive && !isVerified);

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
              <CalendarPlus className="h-4 w-4 text-primary" /> Post an event
            </CardTitle>
            <CardDescription>
              Tournaments, brackets, and specials publish straight to the Tonight page and
              your consumer venue page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveMode && ownedVenues !== null && ownedVenues.length === 0 && (
              <p className="rounded-md border border-accent/60 bg-accent/10 px-3 py-2 text-xs">
                Claim your venue to post events. Verification links your account as the
                venue owner — start above, or contact support if your room is already listed.
              </p>
            )}
            {canPostLive && ownedVenues && (
              <div className="space-y-1.5">
                <Label htmlFor="evt-venue">Venue</Label>
                <select
                  id="evt-venue"
                  value={postVenueId ?? ""}
                  onChange={(e) => setPostVenueId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ownedVenues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                  <option value="special">Special</option>
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={repeatsWeekly}
                    onChange={(e) => setRepeatsWeekly(e.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Repeats weekly
                </label>
              </div>
            </div>
            {repeatsWeekly ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="evt-weekday">Every</Label>
                  <select
                    id="evt-weekday"
                    value={eventWeekday}
                    onChange={(e) => setEventWeekday(Number(e.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {WEEKDAY_NAMES.map((name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evt-time">Start time</Label>
                  <Input
                    id="evt-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="evt-date">Date &amp; time</Label>
                <Input
                  id="evt-date"
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="evt-fee">Entry fee ($)</Label>
                <Input
                  id="evt-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={eventFee}
                  onChange={(e) => setEventFee(e.target.value)}
                  placeholder="20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-race">Race format</Label>
                <Input
                  id="evt-race"
                  value={eventRace}
                  onChange={(e) => setEventRace(e.target.value)}
                  placeholder="Race to 5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evt-fargo">Fargo range</Label>
                <Input
                  id="evt-fargo"
                  value={eventFargo}
                  onChange={(e) => setEventFargo(e.target.value)}
                  placeholder="Under 600"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="evt-details">Details</Label>
              <Input
                id="evt-details"
                value={eventDetails}
                onChange={(e) => setEventDetails(e.target.value)}
                placeholder="Double elimination, cash payouts top four"
              />
            </div>
            <Button onClick={() => void publishEvent()} disabled={publishDisabled}>
              {posting
                ? "Publishing…"
                : canPostLive || isVerified
                  ? "Publish"
                  : "Verification required to publish"}
            </Button>
            {postStatus && (
              <p
                className={`rounded-md border px-3 py-2 text-xs ${
                  postStatus.ok
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-destructive/50 bg-destructive/10 text-destructive"
                }`}
              >
                {postStatus.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" /> Published events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {publishedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing published yet.</p>
            ) : (
              publishedEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{event.title}</span>
                    <Badge variant="outline" className="capitalize">
                      {event.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describeWhen(event)}
                    {event.entry_fee_cents != null &&
                      ` · $${
                        event.entry_fee_cents % 100 === 0
                          ? event.entry_fee_cents / 100
                          : (event.entry_fee_cents / 100).toFixed(2)
                      } entry`}
                    {event.race_format ? ` · ${event.race_format}` : ""}
                    {event.fargo_range ? ` · Fargo ${event.fargo_range}` : ""}
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
