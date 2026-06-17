import { describe, expect, it } from "vitest";
import {
  emptyMemory,
  learnedContext,
  recordCorrection,
  recordJobAlias,
} from "./memory.js";
import { buildExtractionPrompt } from "./extraction.js";

describe("learning memory", () => {
  it("merges aliases into one job and dedupes", () => {
    let m = emptyMemory();
    m = recordJobAlias(m, "Perplexity", ["181 Fremont", "PPLX"], "11836-15");
    m = recordJobAlias(m, "Perplexity", ["PPLX", "10th & 11th Floors"]);
    expect(m.jobAliases).toHaveLength(1);
    expect(m.jobAliases[0]!.jobNumber).toBe("11836-15");
    expect(m.jobAliases[0]!.aliases.sort()).toEqual(["10th & 11th Floors", "181 Fremont", "PPLX"]);
  });

  it("renders learned context and feeds it into the prompt", () => {
    let m = emptyMemory();
    m = recordJobAlias(m, "Perplexity", ["181 Fremont"], "11836-15");
    m = recordCorrection(m, { subjectHint: "RE: floor drains", wrong: "RFI Field Coordination", right: "Change Order" });
    const ctx = learnedContext(m);
    expect(ctx).toContain("181 Fremont");
    expect(ctx).toContain("category is Change Order, NOT RFI Field Coordination");

    const prompt = buildExtractionPrompt({ subject: "RE: floor drains", body: "..." }, ctx);
    expect(prompt).toContain("LEARNED CONTEXT");
    expect(prompt).toContain("Change Order, NOT RFI");
  });

  it("caps corrections so the prompt never grows unbounded", () => {
    let m = emptyMemory();
    for (let i = 0; i < 250; i++) {
      m = recordCorrection(m, { subjectHint: `e${i}`, wrong: "A", right: "B" });
    }
    expect(m.corrections.length).toBe(200);
  });
});
