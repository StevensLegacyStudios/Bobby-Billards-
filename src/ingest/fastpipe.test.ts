import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFastpipeExcel } from "./fastpipe.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = resolve(__dirname, "../../samples/sample_fastpipe.xlsx");

describe("fastpipe ingest", () => {
  it("parses the sample export, maps known columns, and reports unmapped ones", () => {
    expect(existsSync(SAMPLE)).toBe(true);
    const res = parseFastpipeExcel(SAMPLE);

    expect(res.lineItems.length).toBe(5);
    expect(res.unmappedColumns).toContain("Notes");

    expect(res.rollups.laborHours).toBe(338.5);
    expect(res.rollups.materialCost).toBe(21420);
    expect(res.rollups.tax).toBe(1765);
    expect(res.rollups.fixtures).toBe(18);
    expect(res.rollups.rentals).toBe(500);

    const water = res.lineItems[0]!;
    expect(water.section).toBe("Domestic Water");
    expect(water.zone).toBe("L12 Core");
    expect(water.laborHours).toBe(120.5);
  });
});
