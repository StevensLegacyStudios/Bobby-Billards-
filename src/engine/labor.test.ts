import { describe, expect, it } from "vitest";
import { EstimateSchema } from "../schema/project.js";
import { computeLabor } from "./labor.js";
import { loadedRate, seedWageRows } from "./wages.js";

function estimateWithHours(hours: number) {
  return EstimateSchema.parse({ rollups: { laborHours: hours } });
}

describe("labor", () => {
  it("totalLaborCost = hours × count-weighted blended loaded rate", () => {
    const rows = seedWageRows("342");
    const crew = [
      { classification: "foreman" as const, count: 1 },
      { classification: "journeyman" as const, count: 2 },
      { classification: "apprentice_step_3" as const, count: 1 },
    ];
    const rate = (c: string) =>
      loadedRate(rows.find((r) => r.classification === c)!);
    const expectedBlended =
      Math.round(((rate("foreman") + rate("journeyman") * 2 + rate("apprentice_step_3")) / 4) * 100) / 100;

    const res = computeLabor(rows, crew, estimateWithHours(100));
    expect(res.blendedLoadedRate).toBe(expectedBlended);
    expect(res.computed.totalLaborCost).toBe(
      Math.round(100 * expectedBlended * 100) / 100,
    );
    expect(res.computed.usedVerifyRows).toBe(true);
  });

  it("falls back to the journeyman rate when no crew is defined", () => {
    const rows = seedWageRows("342");
    const res = computeLabor(rows, [], estimateWithHours(10));
    const jw = loadedRate(rows.find((r) => r.classification === "journeyman")!);
    expect(res.blendedLoadedRate).toBe(jw);
    expect(res.computed.totalLaborCost).toBe(Math.round(10 * jw * 100) / 100);
  });
});
