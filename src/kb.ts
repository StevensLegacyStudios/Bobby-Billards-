import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Classification, Region } from "./schema/project.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Repo root: both src/ and dist/ live one level under it. */
export const REPO_ROOT = resolve(__dirname, "..");
const KB_DIR = resolve(REPO_ROOT, "kb");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(KB_DIR, name), "utf8")) as T;
}

export interface LocalDef {
  name: string;
  regions: Region[];
  source: string;
  effectiveDate: string | null;
  classifications: {
    journeyman: { baseHourly: number; fringes: Record<string, number> };
    foreman: { pctOfJourneyman?: number; baseHourly?: number };
    general_foreman: { pctOfJourneyman?: number; baseHourly?: number };
    apprenticePctOfJourneyman: number[];
  };
}

export interface UaLocalsKb {
  version: string;
  disclaimer: string;
  regionToLocal: Record<Region, string>;
  locals: Record<string, LocalDef>;
}

export interface StageDef {
  id: string;
  label: string;
  summary: string;
  requiredInfo: { path: string; question: string; blocking: boolean }[];
}

export interface WorkflowStagesKb {
  version: string;
  stages: StageDef[];
}

export interface ScopeCatalogItem {
  system: string;
  phase: Classification extends never ? never : string;
  typicalDurationDays: number;
  dependsOnPhases: string[];
}

export interface ScopeCatalogKb {
  version: string;
  note: string;
  items: ScopeCatalogItem[];
}

export interface FastpipeColumnsKb {
  version: string;
  note: string;
  aliases: Record<string, string[]>;
}

export interface BidDefaultsKb {
  version: string;
  note: string;
  laborBurdenPct: number;
  overheadPct: number;
  profitPct: number;
  contingencyPct: number;
}

export interface Contact {
  name: string;
  role?: string;
  company?: string;
  email: string | null;
  phone: string | null;
}

export interface UmiContactsKb {
  version: string;
  note: string;
  company: {
    name: string;
    address: string;
    branchAddress: string;
    phone: string;
    poDepartmentEmail: string;
    bidsEmail: string;
    jobNumberFormat: string;
  };
  defaultPM: Contact;
  internal: Contact[];
  gc: Contact[];
  vendor: Contact[];
}

export const uaLocals = loadJson<UaLocalsKb>("ua_locals.json");
export const workflowStages = loadJson<WorkflowStagesKb>("workflow_stages.json");
export const scopeCatalog = loadJson<ScopeCatalogKb>("scope_catalog.json");
export const fastpipeColumns = loadJson<FastpipeColumnsKb>(
  "fastpipe_columns.json",
);
export const bidDefaults = loadJson<BidDefaultsKb>("bid_defaults.json");
export const umiContacts = loadJson<UmiContactsKb>("umi_contacts.json");

export function localForRegion(region: Region): string {
  return uaLocals.regionToLocal[region];
}

/** Look up a contact by (partial) name or company across the UMI directory. */
export function findContact(query: string): Contact | undefined {
  const q = query.trim().toLowerCase();
  const all = [umiContacts.defaultPM, ...umiContacts.internal, ...umiContacts.gc, ...umiContacts.vendor];
  return (
    all.find((c) => c.name.toLowerCase() === q) ??
    all.find((c) => c.name.toLowerCase().includes(q)) ??
    all.find((c) => (c.company ?? "").toLowerCase().includes(q))
  );
}

export function stageById(id: string): StageDef | undefined {
  return workflowStages.stages.find((s) => s.id === id);
}
