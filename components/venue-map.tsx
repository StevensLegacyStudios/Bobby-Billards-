"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import type { Venue } from "@/lib/types";

const TripMap = dynamic(() => import("@/components/trip-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] w-full items-center justify-center rounded-xl bg-card">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

/** Single-venue location map for the venue detail page. */
export function VenueMap({ venue }: { venue: Venue }) {
  return (
    <TripMap
      route={[]}
      bufferMeters={0}
      venues={[venue]}
      className="h-[280px] w-full"
    />
  );
}
