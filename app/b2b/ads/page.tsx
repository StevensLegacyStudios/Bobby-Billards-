import type { Metadata } from "next";

import { AdsClient } from "./ads-client";

export const metadata: Metadata = {
  title: "CPC Boosting Dashboard",
  description: "Bid on high-visibility highlights along driving routes near your venue.",
};

export default function AdsPage() {
  return <AdsClient />;
}
