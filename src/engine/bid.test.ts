import { describe, expect, it } from "vitest";
import { EstimateSchema, LaborSchema } from "../schema/project.js";
import { computeBid } from "./bid.js";

describe("bid", () => {
  const estimate = EstimateSchema.parse({
    rollups: { laborHours: 100, materialCost: 10000, tax: 800, rentals: 500 },
  });

  it("computes the waterfall and total for known inputs", () => {
    const labor = LaborSchema.parse({
      computed: { totalLaborCost: 12100, usedVerifyRows: false },
    }).computed;
    const bid = computeBid(estimate, labor, {
      laborBurdenPct: 0,
      overheadPct: 10,
      profitPct: 10,
      contingencyPct: 0,
    });
    // subtotal 23400, overhead 2340, profit (23400+2340)*0.1=2574, total 28314
    expect(bid.waterfall.subtotal).toBe(23400);
    expect(bid.waterfall.overhead).toBe(2340);
    expect(bid.waterfall.profit).toBe(2574);
    expect(bid.waterfall.total).toBe(28314);
  });

  it("flags unverified placeholder wages when labor used verify rows", () => {
    const labor = LaborSchema.parse({
      computed: { totalLaborCost: 12100, usedVerifyRows: true },
    }).computed;
    const bid = computeBid(estimate, labor, {
      laborBurdenPct: 0,
      overheadPct: 10,
      profitPct: 10,
      contingencyPct: 0,
    });
    expect(bid.assumptionFlags.some((f) => /UNVERIFIED/i.test(f))).toBe(true);
  });
});
