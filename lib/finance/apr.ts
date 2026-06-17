import type { CreditTier } from "@/lib/profile";

/**
 * Estimated auto-loan APR by credit tier and vehicle condition.
 * Figures reflect 2026 market averages (Experian/LendingTree/US News tiers):
 *  - deep-subprime (300-500): ~16.0% new / ~21.5% used
 *  - subprime (501-600):      ~13.3% new / ~19.0% used
 *  - fair (601-660):          ~9.6%  new / ~13.5% used
 *  - good (661-780):          ~6.7%  new / ~8.9%  used
 *  - excellent (781-850):     ~5.3%  new / ~6.8%  used
 * These are estimates for planning — a real pre-approval overrides them.
 */
const APR_TABLE: Record<CreditTier, { new: number; used: number }> = {
  "deep-subprime": { new: 16.0, used: 21.5 },
  subprime: { new: 13.3, used: 19.0 },
  fair: { new: 9.6, used: 13.5 },
  good: { new: 6.7, used: 8.9 },
  excellent: { new: 5.3, used: 6.8 },
};

export type VehicleCondition = "new" | "used";

export function estimateApr(tier: CreditTier, condition: VehicleCondition): number {
  return APR_TABLE[tier][condition];
}

/** A model-year within ~1 year of now is treated as "new" for rate purposes. */
export function conditionForYear(year: number, now = new Date()): VehicleCondition {
  return year >= now.getFullYear() - 1 ? "new" : "used";
}
