import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "../samples/sample_fastpipe.xlsx");
mkdirSync(dirname(out), { recursive: true });

// Array-of-arrays: a couple of title rows, then the header row, then data.
// "Notes" is intentionally an unmapped column to exercise unmapped detection.
const aoa = [
  ["ACME TOWER — 12th Floor TI — FastPIPE Export"],
  [],
  [
    "Section",
    "Zone",
    "Cost Code",
    "Tag",
    "Description",
    "Labor Hrs",
    "Material Cost",
    "Fixtures",
    "Rentals",
    "Tax",
    "Notes",
  ],
  ["Domestic Water", "L12 Core", "15400", "CW", "Copper main + branches", 120.5, 8420, 6, 350, 720, "verify hangers"],
  ["DWV Above-Ground", "L12 Core", "15300", "WV", "Waste & vent", 86, 5100, 0, 0, 410, ""],
  ["DWV Above-Ground", "L12 West", "15300", "WV", "Waste & vent west", 64, 3800, 0, 0, 305, ""],
  ["Fixtures", "L12 Core", "15400", "FX", "Set & connect fixtures", 40, 2200, 12, 0, 180, ""],
  ["Gas", "L12 Mech", "15500", "GAS", "Natural gas to RTU", 28, 1900, 0, 150, 150, ""],
];

const ws = XLSX.utils.aoa_to_sheet(aoa);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Estimate");
XLSX.writeFile(wb, out);
console.log(`Wrote ${out}`);
