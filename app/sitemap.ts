import type { MetadataRoute } from "next";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddy-billiards.vercel.app";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/tonight", priority: 0.8, changeFrequency: "hourly" },
  { path: "/trip-planner", priority: 0.8, changeFrequency: "weekly" },
  { path: "/rules", priority: 0.6, changeFrequency: "monthly" },
  { path: "/upgrade", priority: 0.3, changeFrequency: "monthly" },
  { path: "/account", priority: 0.1, changeFrequency: "yearly" },
];

/** Every venue page, so Google can actually find and index all of them —
 * there's no other page that links to every one of the 300+ synced venues. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data } = await supabase
      .from("venues")
      .select("id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);
    for (const venue of data ?? []) {
      entries.push({
        url: `${SITE_URL}/venues/${venue.id}`,
        lastModified: venue.updated_at ? new Date(venue.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
