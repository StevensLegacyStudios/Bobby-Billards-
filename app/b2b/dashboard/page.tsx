import { Suspense } from "react";
import type { Metadata } from "next";

import { B2bDashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: "B2B Merchant Portal",
  description: "Verify your venue, track engagement analytics, and publish events.",
};

export default function B2bDashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading portal…</div>}>
      <B2bDashboardClient />
    </Suspense>
  );
}
