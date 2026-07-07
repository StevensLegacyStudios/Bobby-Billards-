import { localForRegion, uaLocals, type LocalDef } from "../kb.js";
import {
  CLASSIFICATIONS,
  type Classification,
  type Fringes,
  type Region,
  type WageRow,
} from "../schema/project.js";

export function sumFringes(f: Partial<Fringes>): number {
  return (
    (f.hw ?? 0) +
    (f.pension ?? 0) +
    (f.vacation ?? 0) +
    (f.training ?? 0) +
    (f.other ?? 0)
  );
}

export function loadedRate(row: {
  baseHourly: number;
  fringes: Partial<Fringes>;
}): number {
  return round2(row.baseHourly + sumFringes(row.fringes));
}

export function toFringes(f: Record<string, number>): Fringes {
  return {
    hw: f.hw ?? 0,
    pension: f.pension ?? 0,
    vacation: f.vacation ?? 0,
    training: f.training ?? 0,
    other: f.other ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function apprenticeStep(classification: Classification): number | null {
  const m = /^apprentice_step_(\d+)$/.exec(classification);
  return m ? Number(m[1]) : null;
}

/** Build a full set of seeded (verify=true) wage rows for a local from the KB. */
export function seedWageRows(local: string): WageRow[] {
  const def: LocalDef | undefined = uaLocals.locals[local];
  if (!def) return [];
  const jw = def.classifications.journeyman;
  const jwFringes = toFringes(jw.fringes);
  const jwLoaded = loadedRate({ baseHourly: jw.baseHourly, fringes: jwFringes });

  const rows: WageRow[] = [];
  for (const classification of CLASSIFICATIONS) {
    let baseHourly = 0;
    const fringes: Fringes = toFringes(jw.fringes);

    if (classification === "journeyman") {
      baseHourly = jw.baseHourly;
    } else if (classification === "foreman") {
      baseHourly = premiumBase(jw.baseHourly, def.classifications.foreman);
    } else if (classification === "general_foreman") {
      baseHourly = premiumBase(
        jw.baseHourly,
        def.classifications.general_foreman,
      );
    } else {
      const step = apprenticeStep(classification);
      if (step === null) continue;
      const pct = def.classifications.apprenticePctOfJourneyman[step - 1] ?? 0;
      // Apprentices: scale the *total package* off journeyman as a placeholder.
      baseHourly = round2(jw.baseHourly * pct);
      scaleFringes(fringes, pct);
    }

    rows.push({
      local,
      classification,
      baseHourly: round2(baseHourly),
      fringes,
      loaded: loadedRate({ baseHourly, fringes }),
      source: def.source,
      effectiveDate: def.effectiveDate,
      verify: true,
      overriddenBy: null,
      overriddenAt: null,
      note: null,
    });
  }
  // jwLoaded is referenced to keep the package math intent explicit
  void jwLoaded;
  return rows;
}

function premiumBase(
  jwBase: number,
  def: { pctOfJourneyman?: number; baseHourly?: number },
): number {
  if (typeof def.baseHourly === "number") return def.baseHourly;
  if (typeof def.pctOfJourneyman === "number")
    return jwBase * def.pctOfJourneyman;
  return jwBase;
}

function scaleFringes(f: Fringes, pct: number): void {
  f.hw = round2(f.hw * pct);
  f.pension = round2(f.pension * pct);
  f.vacation = round2(f.vacation * pct);
  f.training = round2(f.training * pct);
  f.other = round2(f.other * pct);
}

export function resolveLocal(
  region: Region | undefined,
  explicit?: string,
): string | undefined {
  if (explicit) return explicit;
  if (region) return localForRegion(region);
  return undefined;
}

export function findWageRow(
  rows: WageRow[],
  classification: Classification,
  local?: string,
): WageRow | undefined {
  return rows.find(
    (r) =>
      r.classification === classification &&
      (local === undefined || r.local === local),
  );
}
