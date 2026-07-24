import { Suspense } from "react";
import type { Metadata } from "next";

import { TripPlannerClient } from "./trip-planner-client";

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "Find billiard venues inside the spatial corridor of your route.",
};

export default function TripPlannerPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading planner…</div>}>
      <TripPlannerClient />
    </Suspense>
  );
}
