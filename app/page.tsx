import Link from "next/link";
import { ArrowRight, Camera, Crown, MapPin, Route, ShieldCheck, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_VENUES } from "@/lib/demo-data";

const FEATURES = [
  {
    icon: Route,
    title: "Corridor route planning",
    body: "Buffer any road trip into a PostGIS spatial corridor and surface every pool room within striking distance of your route.",
    href: "/trip-planner",
  },
  {
    icon: Camera,
    title: "AI shot analysis",
    body: "Snap the table from any angle — a YOLOv8 vision pipeline flattens the perspective and solves the optimal trajectory.",
    href: "/rules",
  },
  {
    icon: ShieldCheck,
    title: "Crowd-verified conditions",
    body: "Cloth quality, pocket cuts, cue clearance — validated by the players who actually shot there.",
    href: `/venues/${DEMO_VENUES[0].id}`,
  },
  {
    icon: WifiOff,
    title: "Offline corridors",
    body: "Premium members sync corridor geometry and map data into IndexedDB for fully disconnected rural stretches.",
    href: "/upgrade",
  },
];

export default function HomePage() {
  const featured = DEMO_VENUES.filter((v) => v.is_verified).slice(0, 3);

  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-3xl space-y-6 pt-8 text-center sm:pt-16">
        <Badge variant="secondary" className="mx-auto">
          Enterprise-grade billiard routing &amp; spatial intelligence
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Never drive past a great table again.
        </h1>
        <p className="text-lg text-muted-foreground">
          Bobby Billiards maps every pool hall along your route, verifies the playing
          conditions, and sharpens your game with a 3D AI shot engine.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/trip-planner">
              Plan a corridor <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/rules">Try the 3D shot canvas</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body, href }) => (
          <Link key={title} href={href}>
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <Icon className="mb-2 h-6 w-6 text-primary" />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Verified venues on the I-5 corridor</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/trip-planner">
              See all <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {featured.map((venue) => (
            <Link key={venue.id} href={`/venues/${venue.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {venue.name}
                    <Badge variant="accent">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {venue.rating} ★ · {venue.table_specifications?.[0]?.label}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Crown className="h-5 w-5" /> Go Premium — $4.99/mo
              </div>
              <p className="mt-1 text-sm opacity-90">
                Unlimited AI shot uploads, corridor detours, offline maps, and pro camera modules.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg">
              <Link href="/upgrade">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
