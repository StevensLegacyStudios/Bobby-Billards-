import { describe, expect, it } from "vitest";
import { draftEmail } from "./email.js";
import { createProject } from "../factory.js";

describe("email drafting", () => {
  it("composes an RFI email from the linked RFI", () => {
    const p = createProject({ name: "Acme TI", region: "East Bay" });
    p.client.gc = "Turner";
    p.rfis.push({
      id: "rfi_1",
      subject: "Venting routing",
      question: "Confirm WH-2 flue clearance at grid line C.",
      status: "open",
      dateOpened: "2026-06-17T00:00:00.000Z",
      answer: null,
    });
    const e = draftEmail(p, "rfi", "rfi_1");
    expect(e.party).toBe("Turner");
    expect(e.subject).toContain("Venting routing");
    expect(e.body).toContain("WH-2 flue");
    expect(e.body).toContain("Acme TI");
  });

  it("puts the bid total in a proposal email", () => {
    const p = createProject({ name: "Acme TI", region: "East Bay" });
    p.bid.waterfall.total = 81649.85;
    const e = draftEmail(p, "bid", null);
    expect(e.subject).toContain("Proposal");
    expect(e.body).toContain("81,649.85");
  });
});
