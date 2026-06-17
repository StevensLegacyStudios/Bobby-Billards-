import { DEFAULT_GAS_PRICE } from "./constants";

/** Estimated monthly fuel cost for a gas/hybrid vehicle. */
export function monthlyFuelCost(
  mpg: number | undefined,
  milesPerMonth: number,
  gasPrice: number = DEFAULT_GAS_PRICE,
): number {
  if (!mpg || mpg <= 0) return 0;
  return (milesPerMonth / mpg) * gasPrice;
}

/** Monthly fuel savings of a car vs a 28 MPG baseline gas car. */
export function monthlyFuelSavingsVsBaseline(
  mpg: number | undefined,
  milesPerMonth: number,
  baselineMpg = 28,
  gasPrice: number = DEFAULT_GAS_PRICE,
): number {
  const baseline = monthlyFuelCost(baselineMpg, milesPerMonth, gasPrice);
  const car = monthlyFuelCost(mpg, milesPerMonth, gasPrice);
  return Math.max(0, baseline - car);
}
