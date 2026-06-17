import { DEFAULT_FEES, DEFAULT_SALES_TAX, DEFAULT_TERM_MONTHS } from "./constants";

/** Standard fixed-rate amortized monthly payment. */
export function monthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number = DEFAULT_TERM_MONTHS,
): number {
  if (principal <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

/** Total of all payments over the life of the loan. */
export function totalOfPayments(
  principal: number,
  annualRatePct: number,
  termMonths: number = DEFAULT_TERM_MONTHS,
): number {
  return monthlyPayment(principal, annualRatePct, termMonths) * termMonths;
}

/** Out-the-door price = sticker + sales tax + fees. */
export function outTheDoor(
  price: number,
  salesTax: number = DEFAULT_SALES_TAX,
  fees: number = DEFAULT_FEES,
): number {
  return price * (1 + salesTax) + fees;
}

/**
 * Amount that must be financed for a given down payment, respecting an optional
 * lender cap on the amount financed. Returns the financed amount plus the down
 * payment actually required to make the deal work.
 */
export function financingFor(opts: {
  price: number;
  downPayment: number;
  loanCap?: number;
  salesTax?: number;
  fees?: number;
}): { otd: number; amountFinanced: number; requiredDown: number; fitsCap: boolean } {
  const otd = outTheDoor(opts.price, opts.salesTax, opts.fees);
  const baseFinanced = Math.max(0, otd - opts.downPayment);

  if (opts.loanCap == null) {
    return { otd, amountFinanced: baseFinanced, requiredDown: opts.downPayment, fitsCap: true };
  }

  const fitsCap = baseFinanced <= opts.loanCap;
  // If the lender won't finance the whole gap, the buyer must cover the rest in cash.
  const requiredDown = fitsCap ? opts.downPayment : Math.max(opts.downPayment, otd - opts.loanCap);
  const amountFinanced = Math.min(baseFinanced, opts.loanCap);
  return { otd, amountFinanced, requiredDown, fitsCap };
}

export function round0(n: number): number {
  return Math.round(n);
}
