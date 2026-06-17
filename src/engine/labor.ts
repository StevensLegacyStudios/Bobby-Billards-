import type {
  CrewMember,
  Estimate,
  Labor,
  WageRow,
} from "../schema/project.js";
import { findWageRow, loadedRate } from "./wages.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface LaborBreakdownRow {
  classification: string;
  count: number;
  loadedRate: number;
  verify: boolean;
}

export interface LaborResult {
  computed: Labor["computed"];
  blendedLoadedRate: number;
  breakdown: LaborBreakdownRow[];
}

/**
 * Labor cost = total estimate hours × blended loaded crew rate.
 * Blended rate is the count-weighted average loaded rate across the crew mix;
 * with no crew defined we fall back to the journeyman rate.
 */
export function computeLabor(
  rows: WageRow[],
  crew: CrewMember[],
  estimate: Estimate,
): LaborResult {
  const totalHours = estimate.rollups.laborHours;
  const breakdown: LaborBreakdownRow[] = [];
  let usedVerifyRows = false;

  let weightedSum = 0;
  let headcount = 0;
  for (const member of crew) {
    const row = findWageRow(rows, member.classification);
    const rate = row ? loadedRate(row) : 0;
    if (row?.verify) usedVerifyRows = true;
    breakdown.push({
      classification: member.classification,
      count: member.count,
      loadedRate: rate,
      verify: row?.verify ?? true,
    });
    weightedSum += rate * member.count;
    headcount += member.count;
  }

  let blended: number;
  if (headcount > 0) {
    blended = round2(weightedSum / headcount);
  } else {
    const jw = findWageRow(rows, "journeyman");
    blended = jw ? loadedRate(jw) : 0;
    if (jw?.verify) usedVerifyRows = true;
  }

  const totalLaborCost = round2(totalHours * blended);

  // Distribute by zone using each zone's share of labor hours.
  const byZone: Record<string, number> = {};
  const zoneHours: Record<string, number> = {};
  for (const li of estimate.lineItems) {
    const zone = li.zone ?? "(unassigned)";
    zoneHours[zone] = (zoneHours[zone] ?? 0) + li.laborHours;
  }
  for (const [zone, hours] of Object.entries(zoneHours)) {
    byZone[zone] = round2(hours * blended);
  }

  return {
    computed: {
      totalLaborCost,
      totalHours,
      byZone,
      usedVerifyRows,
      computedAt: new Date().toISOString(),
    },
    blendedLoadedRate: blended,
    breakdown,
  };
}
