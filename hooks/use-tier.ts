"use client";

import { useCallback, useSyncExternalStore } from "react";

import { TIER_COOKIE, parseTier } from "@/lib/tier";
import type { SubscriptionTier } from "@/lib/types";

function readTierCookie(): SubscriptionTier {
  if (typeof document === "undefined") return "free";
  const match = document.cookie.match(new RegExp(`(?:^|; )${TIER_COOKIE}=([^;]*)`));
  return parseTier(match?.[1]);
}

// Cookies have no native change event, so tier updates (e.g. after checkout)
// notify subscribers explicitly via refresh().
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): SubscriptionTier {
  return "free";
}

export function useTier() {
  const tier = useSyncExternalStore(subscribe, readTierCookie, getServerSnapshot);

  const refresh = useCallback(() => {
    for (const listener of listeners) listener();
  }, []);

  return { tier, isPremium: tier === "premium", refresh };
}
