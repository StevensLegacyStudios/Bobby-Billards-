import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { fastpipeColumns } from "../kb.js";
import {
  EstimateRollupsSchema,
  type EstimateRollups,
  type LineItem,
} from "../schema/project.js";

const TEXT_FIELDS = new Set([
  "section",
  "spec",
  "zone",
  "costCode",
  "tag",
  "description",
]);
const NUMERIC_FIELDS = new Set([
  "laborHours",
  "laborRate",
  "materialCost",
  "fixtures",
  "rentals",
  "tax",
]);

function normalizeHeader(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function aliasIndex(): Map<string, string> {
  const idx = new Map<string, string>();
  for (const [field, aliases] of Object.entries(fastpipeColumns.aliases)) {
    for (const a of aliases) idx.set(normalizeHeader(a), field);
  }
  return idx;
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined) return 0;
  const cleaned = String(v).replace(/[$,()]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

let rowCounter = 0;
function lineId(): string {
  rowCounter += 1;
  return `li_${Date.now().toString(36)}_${rowCounter}`;
}

export interface FastpipeParseResult {
  sheetName: string;
  headerRowIndex: number;
  lineItems: LineItem[];
  unmappedColumns: string[];
  rollups: EstimateRollups;
}

/**
 * Parse a FastPipe / FastEST Excel export into LineItems. Detects the header
 * row, maps headers via the editable alias map, and reports any columns it
 * could not map so the agent can ask the human to confirm the mapping.
 */
export function parseFastpipeExcel(filePath: string): FastpipeParseResult {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Workbook has no sheets.");
  const ws = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });

  const idx = aliasIndex();

  // Find the header row = the row whose cells best match known aliases.
  let headerRowIndex = -1;
  let bestScore = 0;
  const scanLimit = Math.min(rows.length, 20);
  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] ?? [];
    const score = row.reduce<number>(
      (acc, cell) => acc + (idx.has(normalizeHeader(cell)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = r;
    }
  }
  if (headerRowIndex < 0 || bestScore < 2) {
    throw new Error(
      "Could not find a recognizable header row. Check the export, or add column aliases to kb/fastpipe_columns.json.",
    );
  }

  const header = rows[headerRowIndex] ?? [];
  const colToField = new Map<number, string>();
  const unmappedColumns: string[] = [];
  header.forEach((cell, c) => {
    const norm = normalizeHeader(cell);
    if (!norm) return;
    const field = idx.get(norm);
    if (field) colToField.set(c, field);
    else unmappedColumns.push(String(cell));
  });

  const lineItems: LineItem[] = [];
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row.every((c) => c === null || c === undefined || c === "")) continue;

    const li: LineItem = {
      id: lineId(),
      section: null,
      spec: null,
      zone: null,
      costCode: null,
      tag: null,
      description: null,
      laborHours: 0,
      laborRate: 0,
      materialCost: 0,
      fixtures: 0,
      rentals: 0,
      tax: 0,
    };
    let hasData = false;
    for (const [c, field] of colToField) {
      const cell = row[c];
      if (cell === null || cell === undefined || cell === "") continue;
      if (TEXT_FIELDS.has(field)) {
        (li as Record<string, unknown>)[field] = String(cell);
        hasData = true;
      } else if (NUMERIC_FIELDS.has(field)) {
        const n = toNumber(cell);
        (li as Record<string, unknown>)[field] = n;
        if (n !== 0) hasData = true;
      }
    }
    if (hasData) lineItems.push(li);
  }

  const rollups = rollupLineItems(lineItems);
  return { sheetName, headerRowIndex, lineItems, unmappedColumns, rollups };
}

export function rollupLineItems(lineItems: LineItem[]): EstimateRollups {
  const r = lineItems.reduce(
    (acc, li) => {
      acc.laborHours += li.laborHours;
      acc.materialCost += li.materialCost;
      acc.rentals += li.rentals;
      acc.tax += li.tax;
      acc.fixtures += li.fixtures;
      return acc;
    },
    { laborHours: 0, materialCost: 0, rentals: 0, tax: 0, fixtures: 0 },
  );
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return EstimateRollupsSchema.parse({
    laborHours: round2(r.laborHours),
    materialCost: round2(r.materialCost),
    rentals: round2(r.rentals),
    tax: round2(r.tax),
    fixtures: round2(r.fixtures),
  });
}
