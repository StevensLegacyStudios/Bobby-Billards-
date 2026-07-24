import type { SubscriptionTier } from "./types";

export const TIER_COOKIE = "bb-tier";
export const UPLOAD_COUNT_COOKIE = "bb-shot-uploads";

export const PREMIUM_PRICE_USD = 4.99;
export const VERIFIED_VENUE_PRICE_USD = 14.99;

export const TIER_LIMITS: Record<
  SubscriptionTier,
  {
    aiShotUploadsPerMonth: number;
    corridorDetours: boolean;
    unlimited3dLayouts: boolean;
    proCameraModules: boolean;
    offlineDownloads: boolean;
  }
> = {
  free: {
    aiShotUploadsPerMonth: 3,
    corridorDetours: false,
    unlimited3dLayouts: false,
    proCameraModules: false,
    offlineDownloads: false,
  },
  premium: {
    aiShotUploadsPerMonth: Number.POSITIVE_INFINITY,
    corridorDetours: true,
    unlimited3dLayouts: true,
    proCameraModules: true,
    offlineDownloads: true,
  },
};

export function parseTier(value: string | undefined | null): SubscriptionTier {
  return value === "premium" ? "premium" : "free";
}
