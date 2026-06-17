import type { Project } from "../schema/project.js";
import { findWageRow } from "./wages.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CertifiedPayrollSummary {
  weekEnding: string;
  found: boolean;
  entries: {
    worker: string;
    classification: string;
    hours: number;
    baseRate: number;
    grossComputed: number;
    verify: boolean;
  }[];
  totalHours: number;
  totalGross: number;
  ratioCheck: { ok: boolean; detail: string };
  flags: string[];
}

const isApprentice = (c: string) => c.startsWith("apprentice");

/**
 * Certified-payroll PREVIEW from logged crew hours: gross at the prevailing
 * (base) rate per classification, plus a simple apprentice-to-journeyman ratio
 * check. v1 is a preview only — DIR/eMars XML export is phase 2.
 */
export function certifiedPayrollSummary(
  project: Project,
  weekEnding: string,
): CertifiedPayrollSummary {
  const week = project.payroll.find((w) => w.weekEnding === weekEnding);
  const flags: string[] = [];

  if (!project.publicWorks) {
    flags.push(
      "publicWorks is not set to true — certified payroll is only required on public works (> $1,000 public funds).",
    );
  }

  if (!week) {
    return {
      weekEnding,
      found: false,
      entries: [],
      totalHours: 0,
      totalGross: 0,
      ratioCheck: { ok: true, detail: "No payroll logged for this week." },
      flags: [
        ...flags,
        `No payroll entries found for week ending ${weekEnding}. Log crew hours first.`,
      ],
    };
  }

  let apprenticeHours = 0;
  let journeymanHours = 0;
  let usedVerify = false;

  const entries = week.entries.map((e) => {
    const row = findWageRow(project.wageAssumptions.rows, e.classification);
    const baseRate = row?.baseHourly ?? 0;
    if (row?.verify) usedVerify = true;
    if (isApprentice(e.classification)) apprenticeHours += e.hours;
    if (e.classification === "journeyman") journeymanHours += e.hours;
    return {
      worker: e.worker,
      classification: e.classification,
      hours: e.hours,
      baseRate,
      grossComputed: round2(e.hours * baseRate),
      verify: row?.verify ?? true,
    };
  });

  const totalHours = round2(entries.reduce((s, e) => s + e.hours, 0));
  const totalGross = round2(entries.reduce((s, e) => s + e.grossComputed, 0));

  // Simple placeholder ratio: apprentice hours should not exceed journeyman hours (1:1).
  const ratioOk = apprenticeHours <= journeymanHours || journeymanHours === 0;
  const ratioCheck = {
    ok: ratioOk,
    detail: ratioOk
      ? `Apprentice hours (${apprenticeHours}) within 1:1 of journeyman hours (${journeymanHours}). NOTE: confirm the actual ratio in the applicable apprenticeship standards.`
      : `Apprentice hours (${apprenticeHours}) exceed journeyman hours (${journeymanHours}) — likely out of ratio. Verify against the apprenticeship standards.`,
  };

  if (usedVerify) {
    flags.push(
      "Gross computed from UNVERIFIED placeholder wage rates — confirm prevailing-wage determination before submitting CPRs.",
    );
  }
  flags.push(
    "PREVIEW ONLY — not a DIR-compliant certified payroll report. XML/eMars export is a later phase.",
  );

  return {
    weekEnding,
    found: true,
    entries,
    totalHours,
    totalGross,
    ratioCheck,
    flags,
  };
}
