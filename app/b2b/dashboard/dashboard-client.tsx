"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarPlus,
  Eye,
  Info,
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

import { ClaimVenue } from "./claim-venue";

interface OwnedVenue {
  id: string;
  name: string;
  is_verified: boolean;
}

/** Real stats for one venue, computed from actual rows — zero when there's genuinely no traffic yet. */
interface RealStats {
  pageViews30d: number;
  adClicks30d: number;
  eventsPublished: number;
  /** Page views bucketed into the last 8 weeks, oldest first. */
  weekly: number[];
}

const EMPTY_STATS: RealStats = { pageViews30d: 0, adClicks30d: 0, eventsPublished: 0, weekly: [0, 0, 0, 0, 0, 0, 0, 0] };

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
  const { user, session, supabase, configured } = useAuth();
  const [demoVenueId, setDemoVenueId] = useState(DEMO_VENUES[0].id);
  const [verifyPending, setVerifyPending] = useState(false);
  const [demoVerified, setDemoVerified] = useState(searchParams.get("verified") === "demo");

  // Owned venues (live mode). null = not loaded yet.
  const [ownedVenues, setOwnedVenues] = useState<OwnedVenue[] | null>(null);
  const [postVenueId, setPostVenueId] = useState<string | null>(null);
  const [realStats, setRealStats] = useState<RealStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const liveMode = configured && Boolean(user);
  const hasOwnedVenues = (ownedVenues?.length ?? 0) > 0;
  const canPostLive = liveMode && hasOwnedVenues;

  // Selected venue: a real owned venue in live mode, a demo venue otherwise.
  const selectedOwned = ownedVenues?.find((v) => v.id === postVenueId) ?? ownedVenues?.[0] ?? null;
  const demoVenue = DEMO_VENUES.find((v) => v.id === demoVenueId) ?? DEMO_VENUES[0];
  const venue = canPostLive && selectedOwned ? selectedOwned : demoVenue;
  const isVerified = canPostLive && selectedOwned ? selectedOwned.is_verified : demoVenue.is_verified || demoVerified;

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
        .select("id, name, is_verified")
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

  // Real analytics for the selected owned venue — zero, honestly, when there's no traffic yet.
  // (When there's no live venue selected, `stats` below never reads `realStats` at all, so
  // there's nothing to reset here — the initial state is already EMPTY_STATS.)
  useEffect(() => {
    if (!canPostLive || !supabase || !selectedOwned) return;
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const now = new Date();
      const since30d = new Date(now.getTime() - 30 * 86_400_000).toISOString();
      const since8w = new Date(now.getTime() - 56 * 86_400_000).toISOString();

      const [{ count: pageViews30d }, { count: adClicks30d }, { data: weeklyRows }] = await Promise.all([
        supabase
          .from("venue_page_views")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", selectedOwned.id)
          .gte("viewed_at", since30d),
        supabase
          .from("ad_clicks")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", selectedOwned.id)
          .gte("clicked_at", since30d),
        supabase
          .from("venue_page_views")
          .select("viewed_at")
          .eq("venue_id", selectedOwned.id)
          .gte("viewed_at", since8w),
      ]);
      if (cancelled) return;

      const weekly = Array.from({ length: 8 }, () => 0);
      for (const row of weeklyRows ?? []) {
        const ageMs = now.getTime() - new Date((row as { viewed_at: string }).viewed_at).getTime();
        const weekIndex = 7 - Math.min(7, Math.floor(ageMs / (7 * 86_400_000)));
        weekly[weekIndex] += 1;
      }
      const maxWeek = Math.max(1, ...weekly);

      setRealStats({
        pageViews30d: pageViews30d ?? 0,
        adClicks30d: adClicks30d ?? 0,
        eventsPublished: liveEvents.filter((e) => e.venue_id === selectedOwned.id).length,
        weekly: weekly.map((v) => Math.round((v / maxWeek) * 100)),
      });
      setStatsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [canPostLive, supabase, selectedOwned, liveEvents]);

  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Only a real, owned venue can be verified — checkout itself re-checks
  // ownership server-side, but there's nothing legitimate to buy here
  // without one, so the button isn't even shown otherwise (see below).
  const startVerification = async () => {
    if (!canPostLive || !selectedOwned) return;
    setVerifyPending(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ plan: "verified_venue", venueId: selectedOwned.id }),
      });
      const data = await res.json();
      if (data.url?.startsWith("http")) {
        window.location.href = data.url;
      } else if (data.demo) {
        // No Stripe keys configured (local dev) — the real webhook would
        // flip is_verified in Supabase, so mirror that locally instead.
        setOwnedVenues((prev) =>
          prev?.map((v) => (v.id === selectedOwned.id ? { ...v, is_verified: true } : v)) ?? prev
        );
      } else {
        setVerifyError(data.message ?? "Couldn't start checkout — try again.");
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

  const stats = useMemo(
    () =>
      canPostLive
        ? realStats
        : {
            pageViews30d: 0,
            adClicks30d: 0,
            eventsPublished: publishedEvents.length,
            weekly: [0, 0, 0, 0, 0, 0, 0, 0],
          },
    [canPostLive, realStats, publishedEvents.length]
  );

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
        {canPostLive && ownedVenues ? (
          <select
            value={postVenueId ?? ""}
            onChange={(e) => setPostVenueId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {ownedVenues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        ) : (
          !liveMode && (
            <select
              value={demoVenueId}
              onChange={(e) => {
                setDemoVenueId(e.target.value);
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
          )
        )}
      </div>

      {!canPostLive && (
        <Card className="border-accent/60 bg-accent/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-foreground" />
            <div>
              {liveMode ? (
                <p>
                  <strong>No real venue is linked to your account yet.</strong> Everything below
                  (venue name, stats, published events) is illustrative demo data — it isn&apos;t
                  tied to your account and isn&apos;t seen by real players. Find your venue and
                  submit a claim in the Verified Venue Profile card below to get it linked, and
                  this panel switches to your real numbers automatically.
                </p>
              ) : (
                <p>
                  <strong>You&apos;re viewing demo data.</strong> Sign in to see your real venue,
                  real page views, and real ad clicks — nothing here is tied to an account until
                  you do.{" "}
                  <Link href="/account" className="underline">
                    Sign in
                  </Link>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
              : canPostLive
                ? `Upload your business registration to activate the verified badge, publish table specifications, and unlock event publishing — $${VERIFIED_VENUE_PRICE_USD.toFixed(2)}/mo. Verification flips automatically when the Stripe provisioning webhook lands.`
                : liveMode
                  ? "No real venue is linked to your account yet — find it below and submit a claim. Once it's linked, verification unlocks here for real."
                  : "Sign in, then link your real venue, to activate the verified badge and event publishing."}
          </CardDescription>
        </CardHeader>
        {!isVerified && (
          <CardContent className="space-y-3">
            {canPostLive && selectedOwned ? (
              <div className="flex flex-wrap items-center gap-3">
                <Input type="file" className="max-w-xs" aria-label="Business registration document" />
                <Button onClick={startVerification} disabled={verifyPending}>
                  {verifyPending ? "Starting checkout…" : `Verify for $${VERIFIED_VENUE_PRICE_USD.toFixed(2)}/mo`}
                </Button>
              </div>
            ) : liveMode ? (
              supabase && user && <ClaimVenue supabase={supabase} user={user} />
            ) : (
              <Button asChild>
                <Link href="/account">Sign in to claim your venue</Link>
              </Button>
            )}
            {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}
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
            <CardTitle className="text-3xl">
              {statsLoading ? "…" : stats.pageViews30d.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <MousePointerClick className="h-4 w-4" /> Ad clicks (30d)
            </CardDescription>
            <CardTitle className="text-3xl">
              {statsLoading ? "…" : stats.adClicks30d.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <ListPlus className="h-4 w-4" /> Events published
            </CardDescription>
            <CardTitle className="text-3xl">{stats.eventsPublished.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" /> Weekly page views
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canPostLive ? (
            <>
              <div className="flex h-28 items-end gap-2">
                {stats.weekly.map((v, i) => (
                  <div key={i} className="flex-1">
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(2, v)}%` }}
                      title={`Week ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Last 8 weeks, real page views to your venue page.
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Real traffic charts appear here once your venue is linked to your account.
            </p>
          )}
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
