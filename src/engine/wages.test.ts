import { describe, expect, it } from "vitest";
import { loadedRate, seedWageRows, toFringes } from "./wages.js";

describe("wages", () => {
  it("loadedRate = base + sum of fringes", () => {
    expect(
      loadedRate({
        baseHourly: 80,
        fringes: { hw: 15.5, pension: 17.5, vacation: 5.5, training: 1.5, other: 1 },
      }),
    ).toBe(121);
  });

  it("seeds a full classification set for a local, all flagged verify=true", () => {
    const rows = seedWageRows("342");
    expect(rows.length).toBe(13); // GF, foreman, journeyman, 10 apprentice steps
    expect(rows.every((r) => r.verify === true)).toBe(true);
    const jw = rows.find((r) => r.classification === "journeyman");
    expect(jw?.loaded).toBe(121);
  });

  it("foreman base is the configured premium over journeyman", () => {
    const rows = seedWageRows("342");
    const foreman = rows.find((r) => r.classification === "foreman");
    // 80 * 1.10 = 88
    expect(foreman?.baseHourly).toBe(88);
  });

  it("an override pattern recomputes loaded and clears verify", () => {
    const rows = seedWageRows("342");
    const jw = rows.find((r) => r.classification === "journeyman")!;
    jw.baseHourly = 90;
    jw.fringes = toFringes({ hw: 16, pension: 18, vacation: 6, training: 2, other: 1 });
    jw.loaded = loadedRate(jw);
    jw.verify = false;
    expect(jw.loaded).toBe(133);
    expect(jw.verify).toBe(false);
  });
});
