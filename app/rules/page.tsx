import type { Metadata } from "next";

import { RulesClient } from "./rules-client";

export const metadata: Metadata = {
  title: "3D Practice & AI Shot Engine",
  description:
    "Solve trajectories on an interactive 3D table and analyze real frames with the AI shot engine.",
};

export default function RulesPage() {
  return <RulesClient />;
}
