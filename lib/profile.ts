// User profile: the constraints CarMan uses to find cars you can actually get.

export type FuelType = "gas" | "hybrid" | "phev" | "electric";
export type BodyStyle = "sedan" | "suv" | "hatchback" | "minivan" | "truck" | "coupe" | "wagon";
export type CreditTier = "excellent" | "good" | "fair" | "subprime" | "deep-subprime";

export interface Profile {
  /** Cash available for a down payment. */
  downPayment: number;
  /** Comfortable maximum monthly payment. */
  maxMonthlyPayment: number;
  /** Lender's max amount financed, if known from a pre-approval (e.g. Carvana cap). */
  loanCap?: number;
  /** Most recent credit score. */
  creditScore: number;
  /** Search center. */
  zip: string;
  radiusMiles: number;
  /** Acceptable fuel types. Empty = any. */
  fuelTypes: FuelType[];
  /** Acceptable body styles. Empty = any. */
  bodyStyles: BodyStyle[];
  minSeats: number;
  maxMileage?: number;
  minMpg?: number;
  minYear?: number;
  /** Driving volume, used for fuel-cost math (a long commute makes MPG matter more). */
  commuteMilesPerMonth: number;
  useCase?: string;
}

export function tierFromScore(score: number): CreditTier {
  if (score >= 781) return "excellent";
  if (score >= 661) return "good";
  if (score >= 601) return "fair";
  if (score >= 501) return "subprime";
  return "deep-subprime";
}

export function tierLabel(tier: CreditTier): string {
  switch (tier) {
    case "excellent":
      return "Excellent (781+)";
    case "good":
      return "Good (661-780)";
    case "fair":
      return "Fair (601-660)";
    case "subprime":
      return "Subprime (501-600)";
    case "deep-subprime":
      return "Deep subprime (below 501)";
  }
}

/**
 * Default profile — seeded with NON-IDENTIFYING preferences only.
 * No street address, SSN, or other PII is stored here.
 */
export const SEED_PROFILE: Profile = {
  downPayment: 2000,
  maxMonthlyPayment: 600,
  loanCap: 13500,
  creditScore: 529,
  zip: "95832",
  radiusMiles: 150,
  fuelTypes: ["hybrid"],
  bodyStyles: ["sedan", "hatchback", "suv"],
  minSeats: 5,
  maxMileage: 130000,
  minMpg: 38,
  minYear: 2014,
  commuteMilesPerMonth: 2000,
  useCase: "Long commute + kids; needs great MPG and rock-solid reliability",
};

const STORAGE_KEY = "carman.profile.v1";

export function loadProfile(): Profile {
  if (typeof window === "undefined") return SEED_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_PROFILE;
    return { ...SEED_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    return SEED_PROFILE;
  }
}

export function saveProfile(profile: Profile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
