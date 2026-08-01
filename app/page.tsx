import Link from "next/link";
import {
  ArrowRight,
  Crosshair,
  Crown,
  Map,
  MapPin,
  Route,
  ShieldCheck,
  Star,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_VENUES } from "@/lib/demo-data";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Venue } from "@/lib/types";

// Refresh the featured-venue list every 5 minutes.
export const revalidate = 300;

const FEATURES = [
  {
    icon: Map,
    title: "Plan trips on a real map",
    body: "Enter any two cities — real driving routes, a detour corridor you control, and every pool room along the way pinned on an interactive map.",
    href: "/trip-planner",
  },
  {
    icon: Crosshair,
    title: "Shot Lab",
    body: "Drag balls to match your real table and the solver shows the make: ghost-ball aim, cut angle, banks — in 2D and on a 3D table you can orbit.",
    href: "/rules",
  },
  {
    icon: ShieldCheck,
    title: "Conditions verified by players",
    body: "Simonis or worn felt? Pro-cut 4.5″ pockets or buckets? Room to stroke or walls in your way? Validated by players who shot there.",
    href: "/trip-planner",
  },
  {
    icon: WifiOff,
    title: "Works where cell service doesn't",
    body: "Premium saves your route and venue data offline, so rural stretches between rooms never leave you guessing.",
    href: "/upgrade",
  },
];

async function getVenueStats(): Promise<{ featured: Venue[]; total: number }> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("venues")
        .select("id, name, rating, is_verified, cloth_quality, table_specifications")
        .order("is_verified", { ascending: false })
        .order("rating", { ascending: false, nullsFirst: false })
        .order("name")
        .limit(3),
      supabase.from("venues").select("id", { count: "exact", head: true }),
    ]);
    if (data && data.length > 0) {
      return { featured: data as unknown as Venue[], total: count ?? data.length };
    }
  }
  return { featured: DEMO_VENUES.filter((v) => v.is_verified).slice(0, 3), total: DEMO_VENUES.length };
}

export default async function HomePage() {
  const { featured, total } = await getVenueStats();

  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl space-y-6 pt-10 text-center sm:pt-20">
        <Badge variant="secondary" className="mx-auto">
          <MapPin className="h-3 w-3 text-primary" /> {total} pool rooms mapped across California
        </Badge>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Never drive past
          <br />
          <span className="bg-gradient-to-r from-primary via-emerald-300 to-accent bg-clip-text text-transparent">
            a great table again.
          </span>
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Buddy Billiards puts every pool hall on your route on a real map — with the
          table conditions players actually care about — and sharpens your game in the
          Shot Lab.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="shadow-lg shadow-primary/20">
            <Link href="/trip-planner">
              Plan a road trip <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/rules">Open the Shot Lab</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body, href }) => (
          <Link key={title} href={href}>
            <Card className="table-card h-full">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="leading-relaxed">{body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Rooms players rate highest</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/trip-planner">
              Find rooms near you <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {featured.map((venue) => (
            <Link key={venue.id} href={`/venues/${venue.id}`}>
              <Card className="table-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {venue.name}
                    {venue.is_verified && (
                      <Badge variant="accent">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-accent" />
                    {venue.rating ? `${venue.rating}` : "unrated"}
                    {venue.table_specifications?.[0]?.label
                      ? ` · ${venue.table_specifications[0].label}`
                      : venue.cloth_quality
                        ? ` · ${venue.cloth_quality.replaceAll("_", " ")}`
                        : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Card className="border-accent/30 bg-gradient-to-br from-primary/15 via-card to-accent/10">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Crown className="h-5 w-5 text-accent" /> Go Premium — $4.99/mo
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                60-mile detours, offline routes, and unlimited Shot Lab analysis.
              </p>
            </div>
            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
              <Link href="/upgrade">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="flex items-center justify-center gap-2 pb-4 text-xs text-muted-foreground">
        <Route className="h-3.5 w-3.5" />
        Routes by OSRM · Maps © OpenStreetMap contributors
      </section>
    </div>
  );
}
