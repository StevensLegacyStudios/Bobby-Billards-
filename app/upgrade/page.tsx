import { Suspense } from "react";
import type { Metadata } from "next";

import { UpgradeClient } from "./upgrade-client";

export const metadata: Metadata = {
  title: "Premium",
  description: "Unlock unlimited AI shot analysis, corridor detours, and offline maps.",
};

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading…</div>}>
      <UpgradeClient />
    </Suspense>
  );
}
