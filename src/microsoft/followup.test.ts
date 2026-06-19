import { describe, expect, it } from "vitest";
import { addBusinessDays, businessDaysBetween, evaluateFollowUp, type OpenItem } from "./followup.js";

const base: OpenItem = {
  kind: "quote_request",
  job: "Perplexity",
  jobNumber: "11836-15",
  vendor: "Ferguson",
  contactName: "Dave Smith",
  contactEmail: "dave@ferguson.com",
  ask: "pricing on 25 floor drains",
  threadSubject: "Quote request - floor drains",
  sentAt: "2026-06-15T17:00:00Z", // Monday
  nudgeCount: 0,
};

describe("business-day math", () => {
  it("skips weekends", () => {
    // Fri -> Mon is 1 business day
    expect(businessDaysBetween(new Date("2026-06-19"), new Date("2026-06-22"))).toBe(1);
    expect(addBusinessDays(new Date("2026-06-19"), 1).getDay()).toBe(1); // Monday
  });
  it("returns 0 for non-positive spans", () => {
    expect(businessDaysBetween(new Date("2026-06-19"), new Date("2026-06-19"))).toBe(0);
  });
});

describe("evaluateFollowUp", () => {
  it("waits before the first nudge", () => {
    const d = evaluateFollowUp(base, new Date("2026-06-16T17:00:00Z")); // +1 business day
    expect(d.action).toBe("wait");
    expect(d.nextCheck).toBeTruthy();
  });

  it("sends the first nudge once cadence is met, with a drafted chaser", () => {
    const d = evaluateFollowUp(base, new Date("2026-06-17T18:00:00Z")); // +2 business days
    expect(d.action).toBe("send");
    expect(d.draft?.to).toBe("dave@ferguson.com");
    expect(d.draft?.subject).toMatch(/^RE:/);
    expect(d.draft?.body).toContain("25 floor drains");
    expect(d.draft?.body).toContain("Perplexity (11836-15)");
  });

  it("escalates to the PM after max nudges", () => {
    const d = evaluateFollowUp(
      { ...base, nudgeCount: 3, lastNudgeAt: "2026-06-10T17:00:00Z" },
      new Date("2026-06-17T17:00:00Z"),
    );
    expect(d.action).toBe("escalate");
    expect(d.reason).toContain("unresponsive");
  });

  it("tightens cadence for high urgency", () => {
    // firstAfter 2 -> 1 when High, so +1 business day already triggers a send
    const d = evaluateFollowUp({ ...base, urgency: "High" }, new Date("2026-06-16T18:00:00Z"));
    expect(d.action).toBe("send");
  });

  it("escalates tone by the third nudge", () => {
    const d = evaluateFollowUp(
      { ...base, nudgeCount: 2, lastNudgeAt: "2026-06-15T17:00:00Z" },
      new Date("2026-06-17T18:00:00Z"),
    );
    expect(d.action).toBe("send");
    expect(d.draft?.body).toContain("other options");
  });
});
