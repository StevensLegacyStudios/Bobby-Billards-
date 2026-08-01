import { Suspense } from "react";
import type { Metadata } from "next";

import { TonightClient } from "./tonight-client";

export const metadata: Metadata = {
  title: "Tonight",
  description: "Pool rooms open near you right now, plus tonight's tournaments and specials.",
};

export default function TonightPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Racking up…</div>}>
      <TonightClient />
    </Suspense>
  );
}
