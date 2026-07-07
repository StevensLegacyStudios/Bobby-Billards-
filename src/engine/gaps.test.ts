import { describe, expect, it } from "vitest";
import { createProject } from "../factory.js";
import { computeGaps } from "./gaps.js";

describe("gaps", () => {
  it("a fresh project is blocked on publicWorks in lease/scope review", () => {
    const p = createProject({ name: "Demo", region: "East Bay" });
    const gaps = computeGaps(p);
    expect(gaps.currentStage).toBe("lease_scope_review");
    expect(gaps.canAdvance).toBe(false);
    expect(gaps.blockingQuestions.some((q) => /public works/i.test(q))).toBe(true);
  });

  it("becomes advanceable once publicWorks is decided", () => {
    const p = createProject({ name: "Demo", region: "East Bay" });
    p.publicWorks = true;
    const gaps = computeGaps(p);
    expect(gaps.canAdvance).toBe(true);
    expect(gaps.blockingQuestions.length).toBe(0);
  });

  it("the estimate stage blocks on missing labor hours / material", () => {
    const p = createProject({ name: "Demo", region: "East Bay" });
    p.workflowStatus.currentStage = "estimate_takeoff";
    const gaps = computeGaps(p);
    expect(gaps.canAdvance).toBe(false);
    expect(gaps.blockingQuestions.some((q) => /FastPipe|line items|material/i.test(q))).toBe(
      true,
    );
  });
});
