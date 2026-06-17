import { describe, expect, it } from "vitest";
import {
  buildExtractionPrompt,
  EMAIL_CATEGORIES,
  parseExtraction,
} from "./extraction.js";

describe("email extraction (Hybrid M365 brain)", () => {
  it("builds a prompt with the UMI categories and known parties", () => {
    const prompt = buildExtractionPrompt({
      subject: "RE: 11836-15 - Perplexity - 181 Fremont, SF - WILL CALL",
      from_name: "Marius Silas",
      from_email: "msilas@pacesupply.com",
      body: "Order confirmation attached. Thank you.",
    });
    expect(prompt).toContain("United Mechanical");
    expect(prompt).toContain("Closeout Docs");
    expect(prompt).toContain("Change Order");
    expect(prompt).toContain("Pace Supply — San Francisco");
    // Every category is offered to the model.
    for (const c of EMAIL_CATEGORIES) expect(prompt).toContain(c);
  });

  it("parses and coerces a model JSON response", () => {
    const raw =
      'Here you go:\n{"email_category":"PO Confirmation","job_number":"11836-15",' +
      '"vendor":"Pace Supply","amount":"394.46","action_required":"true",' +
      '"urgency":"Normal","confidence":"0.92"}';
    const e = parseExtraction(raw);
    expect(e.email_category).toBe("PO Confirmation");
    expect(e.job_number).toBe("11836-15");
    expect(e.action_required).toBe(true); // coerced from "true"
    expect(e.confidence).toBeCloseTo(0.92); // coerced from "0.92"
    expect(e.needs_review).toBe(false); // defaulted
    expect(e.submittal_status).toBe(""); // missing → default
  });

  it("falls back to Normal on an unexpected urgency value", () => {
    const e = parseExtraction('{"email_category":"General Other","urgency":"whenever"}');
    expect(e.urgency).toBe("Normal");
  });

  it("throws when there is no JSON object", () => {
    expect(() => parseExtraction("I could not parse this email.")).toThrow();
  });
});
