import { NextRequest, NextResponse } from "next/server";

import { TIER_COOKIE, parseTier } from "@/lib/tier";

/**
 * Tier-tracking proxy (Next.js middleware layer).
 *
 * Resolves the visitor's subscription tier (Free vs Premium) and stamps it
 * onto the request as `x-bb-tier` so server components and API routes can
 * enforce entitlements without re-reading auth state. Premium-only routes
 * are redirected to the upgrade page for free users.
 */

const PREMIUM_ONLY_PATHS = ["/offline"];

export default function proxy(req: NextRequest) {
  const tier = parseTier(req.cookies.get(TIER_COOKIE)?.value);

  if (tier === "free" && PREMIUM_ONLY_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/upgrade";
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const headers = new Headers(req.headers);
  headers.set("x-bb-tier", tier);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)).*)"],
};
