import type { Bid, Estimate, Labor } from "../schema/project.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BidInputs {
  laborBurdenPct: number;
  overheadPct: number;
  profitPct: number;
  contingencyPct: number;
}

/**
 * Bid waterfall:
 *   labor (+ burden) + material + tax + rentals + equipment = subtotal
 *   subtotal + contingency = base cost
 *   + overhead (on base) + profit (markup on base+overhead) = total
 * Every input is echoed back; assumption flags list anything unverified.
 */
export function computeBid(
  estimate: Estimate,
  laborComputed: Labor["computed"],
  inputs: BidInputs,
  opts: { defaultedFields?: string[] } = {},
): Pick<Bid, "inputs" | "waterfall" | "assumptionFlags" | "computedAt"> {
  const labor = laborComputed.totalLaborCost;
  const laborWithBurden = round2(labor * (1 + inputs.laborBurdenPct / 100));
  const material = estimate.rollups.materialCost;
  const tax = estimate.rollups.tax;
  const rentals = estimate.rollups.rentals;
  const equipment = 0;

  const subtotal = round2(
    laborWithBurden + material + tax + rentals + equipment,
  );
  const contingency = round2(subtotal * (inputs.contingencyPct / 100));
  const base = round2(subtotal + contingency);
  const overhead = round2(base * (inputs.overheadPct / 100));
  const profit = round2((base + overhead) * (inputs.profitPct / 100));
  const total = round2(base + overhead + profit);

  const assumptionFlags: string[] = [];
  if (laborComputed.usedVerifyRows) {
    assumptionFlags.push(
      "Labor uses UNVERIFIED placeholder wage rates (verify=true) — confirm against the current DIR determination / UA-local CBA before quoting.",
    );
  }
  if (opts.defaultedFields && opts.defaultedFields.length > 0) {
    assumptionFlags.push(
      `Used default value(s) for: ${opts.defaultedFields.join(", ")} — confirm with the user.`,
    );
  }
  if (labor === 0) {
    assumptionFlags.push(
      "Labor cost is $0 — run compute_labor_cost first or confirm there is no labor scope.",
    );
  }

  return {
    inputs,
    waterfall: {
      labor,
      laborWithBurden,
      material,
      tax,
      rentals,
      equipment,
      subtotal,
      contingency,
      overhead,
      profit,
      total,
    },
    assumptionFlags,
    computedAt: new Date().toISOString(),
  };
}
