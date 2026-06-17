import { estimateApr } from "./apr";
import { DEFAULT_TERM_MONTHS } from "./constants";
import { monthlyPayment } from "./payment";
import { tierFromScore, type Profile } from "@/lib/profile";

/** Remaining principal after `n` payments on an amortized loan. */
function balanceAfter(principal: number, annualRatePct: number, termMonths: number, n: number): number {
  const r = annualRatePct / 100 / 12;
  const pmt = monthlyPayment(principal, annualRatePct, termMonths);
  if (r === 0) return Math.max(0, principal - pmt * n);
  const grown = principal * Math.pow(1 + r, n);
  const paid = pmt * ((Math.pow(1 + r, n) - 1) / r);
  return Math.max(0, grown - paid);
}

export interface RefiProjection {
  monthsUntilRefi: number;
  currentApr: number;
  currentMonthly: number;
  projectedScore: number;
  projectedApr: number;
  refiMonthly: number;
  interestSaved: number;
}

/**
 * Projects refinancing a subprime loan after ~12 months of on-time payments and
 * credit cleanup, which typically lifts a deep-subprime score into "fair".
 */
export function refiProjection(
  amountFinanced: number,
  profile: Profile,
  opts: { termMonths?: number; monthsUntilRefi?: number; scoreGain?: number } = {},
): RefiProjection {
  const term = opts.termMonths ?? DEFAULT_TERM_MONTHS;
  const monthsUntilRefi = opts.monthsUntilRefi ?? 12;
  const scoreGain = opts.scoreGain ?? 90;

  const currentTier = tierFromScore(profile.creditScore);
  const currentApr = estimateApr(currentTier, "used");
  const currentMonthly = monthlyPayment(amountFinanced, currentApr, term);

  const projectedScore = Math.min(720, profile.creditScore + scoreGain);
  const projectedApr = estimateApr(tierFromScore(projectedScore), "used");

  const bal = balanceAfter(amountFinanced, currentApr, term, monthsUntilRefi);
  const remTerm = term - monthsUntilRefi;
  const refiMonthly = monthlyPayment(bal, projectedApr, remTerm);

  const totalInterestNoRefi = currentMonthly * term - amountFinanced;
  const totalInterestWithRefi =
    currentMonthly * monthsUntilRefi + refiMonthly * remTerm - amountFinanced;
  const interestSaved = Math.max(0, totalInterestNoRefi - totalInterestWithRefi);

  return {
    monthsUntilRefi,
    currentApr,
    currentMonthly,
    projectedScore,
    projectedApr,
    refiMonthly,
    interestSaved,
  };
}

export interface CreditFixStep {
  title: string;
  detail: string;
}

/** Concrete credit-recovery steps that make the refinance possible. */
export function creditFixPlan(): CreditFixStep[] {
  return [
    {
      title: "Autopay every bill, on time",
      detail:
        "Recent late/missed payments are the single biggest score-killer. Once you stop adding new ones, your score starts climbing.",
    },
    {
      title: "Stop applying for new credit for 6+ months",
      detail: "Too many inquiries drag your score down. You already have financing — don't add more pulls.",
    },
    {
      title: "Open 1-2 secured credit cards, keep usage under 10%",
      detail: "Adds positive revolving history and fixes 'too few bankcards with high limits.'",
    },
    {
      title: "Dispute any errors on your report",
      detail: "Pull your free report at annualcreditreport.com and challenge anything inaccurate.",
    },
    {
      title: "Let the car loan do its job",
      detail: "On-time installment payments build history. In ~9-12 months, refinance out of the high rate.",
    },
  ];
}
