import { conditionForYear, estimateApr } from "./apr";
import { DEFAULT_TERM_MONTHS } from "./constants";
import { monthlyFuelCost, monthlyFuelSavingsVsBaseline } from "./gas";
import { financingFor, monthlyPayment, totalOfPayments } from "./payment";
import { reliabilityLabel, reliabilityScore } from "./reliability";
import { tierFromScore, type Profile } from "@/lib/profile";
import type { Car } from "@/lib/inventory/types";

export interface FitResult {
  car: Car;
  apr: number;
  termMonths: number;
  otd: number;
  amountFinanced: number;
  requiredDown: number;
  extraDownNeeded: number;
  monthly: number;
  totalCost: number;
  fitsCap: boolean;
  affordableMonthly: boolean;
  canAfford: boolean;
  monthlyFuel: number;
  monthlyFuelSavings: number;
  reliability: number;
  reliabilityText: string;
  /** True monthly cost of ownership = payment + fuel. */
  monthlyAllIn: number;
  fitScore: number;
  reasons: string[];
  warnings: string[];
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreCar(
  car: Car,
  profile: Profile,
  termMonths: number = DEFAULT_TERM_MONTHS,
): FitResult {
  const tier = tierFromScore(profile.creditScore);
  const apr = estimateApr(tier, conditionForYear(car.year));

  const fin = financingFor({
    price: car.price,
    downPayment: profile.downPayment,
    loanCap: profile.loanCap,
  });
  const monthly = monthlyPayment(fin.amountFinanced, apr, termMonths);
  const totalCost = totalOfPayments(fin.amountFinanced, apr, termMonths) + fin.requiredDown;
  const extraDownNeeded = Math.max(0, fin.requiredDown - profile.downPayment);

  const monthlyFuel = monthlyFuelCost(car.mpg, profile.commuteMilesPerMonth);
  const monthlyFuelSavings = monthlyFuelSavingsVsBaseline(car.mpg, profile.commuteMilesPerMonth);
  const reliability = reliabilityScore(car.make, car.model);

  const affordableMonthly = monthly <= profile.maxMonthlyPayment;
  const canAfford = fin.fitsCap && extraDownNeeded === 0 && affordableMonthly;

  // ---- sub-scores ----
  // Affordability (45): under budget & within lender cap.
  let affordability = 0;
  if (fin.fitsCap) affordability += 25;
  if (affordableMonthly) {
    const headroom = (profile.maxMonthlyPayment - monthly) / profile.maxMonthlyPayment;
    affordability += 10 + clamp(headroom * 100, 0, 10);
  }
  if (extraDownNeeded === 0) affordability += 0; // already covered by fitsCap
  affordability = clamp(affordability, 0, 45);

  // Reliability (25).
  const reliabilityPts = (reliability / 100) * 25;

  // Fuel / MPG (20): rewards high MPG, weighted by how much they drive.
  const mpgTarget = Math.max(profile.minMpg ?? 35, 35);
  const fuelPts = clamp((((car.mpg ?? mpgTarget) - 25) / (60 - 25)) * 20, 0, 20);

  // Freshness (10): newer + lower miles.
  const ageYears = new Date().getFullYear() - car.year;
  const milesScore = clamp((1 - car.mileage / 200000) * 6, 0, 6);
  const ageScore = clamp((1 - ageYears / 15) * 4, 0, 4);

  const fitScore = clamp(
    affordability + reliabilityPts + fuelPts + milesScore + ageScore,
    0,
    100,
  );

  // ---- narrative ----
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (canAfford) reasons.push(`Fits your budget: ~$${Math.round(monthly)}/mo with $${Math.round(profile.downPayment)} down`);
  if (reliability >= 88) reasons.push(`${reliabilityLabel(reliability)} reliability — low risk of surprise repairs`);
  if ((car.mpg ?? 0) >= 45) reasons.push(`${car.mpg} MPG saves ~$${Math.round(monthlyFuelSavings)}/mo in gas on your commute`);
  if (car.distanceMiles != null && car.distanceMiles <= 25) reasons.push(`Only ${car.distanceMiles} mi away`);

  if (!fin.fitsCap)
    warnings.push(
      `Above your ~$${Math.round(profile.loanCap ?? 0)} loan cap — needs ~$${Math.round(fin.requiredDown)} down (about $${Math.round(extraDownNeeded)} more than you have).`,
    );
  else if (!affordableMonthly)
    warnings.push(`~$${Math.round(monthly)}/mo is over your $${Math.round(profile.maxMonthlyPayment)} target.`);
  if (car.mileage >= 110000) warnings.push(`Higher mileage (${car.mileage.toLocaleString()} mi) — verify the hybrid battery health.`);
  if (reliability < 70) warnings.push("Below-average reliability for the brand — budget for repairs.");

  return {
    car,
    apr,
    termMonths,
    otd: fin.otd,
    amountFinanced: fin.amountFinanced,
    requiredDown: fin.requiredDown,
    extraDownNeeded,
    monthly,
    totalCost,
    fitsCap: fin.fitsCap,
    affordableMonthly,
    canAfford,
    monthlyFuel,
    monthlyFuelSavings,
    reliability,
    reliabilityText: reliabilityLabel(reliability),
    monthlyAllIn: monthly + monthlyFuel,
    fitScore,
    reasons,
    warnings,
  };
}

/** Score and rank a list of cars; affordable + best-fit first. */
export function rankCars(cars: Car[], profile: Profile): FitResult[] {
  return cars
    .map((c) => scoreCar(c, profile))
    .sort((a, b) => {
      if (a.canAfford !== b.canAfford) return a.canAfford ? -1 : 1;
      return b.fitScore - a.fitScore;
    });
}
