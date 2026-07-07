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
    const e = draftEmail(p, "rfi", { relatedId: "rfi_1" });
    expect(e.party).toBe("Turner");
    expect(e.subject).toContain("Venting routing");
    expect(e.body).toContain("WH-2 flue");
  });

  it("puts the bid total in a proposal email", () => {
    const p = createProject({ name: "Acme TI", region: "East Bay" });
    p.bid.waterfall.total = 81649.85;
    const e = draftEmail(p, "bid", {});
    expect(e.subject).toContain("Proposal");
    expect(e.body).toContain("81,649.85");
  });

  it("composes a vendor closeout-docs request with the doc bullets", () => {
    const p = createProject({ name: "Acme TI", region: "East Bay" });
    const e = draftEmail(p, "closeout_request", {
      vendor: "Cal Steam",
      material: "Kohler K-30810 Water Closet",
      docLabels: ["Cut sheets", "O&M manual"],
      neededBy: "2026-07-01",
    });
    expect(e.party).toBe("Cal Steam");
    expect(e.subject).toContain("Closeout Docs");
    expect(e.body).toContain("Kohler K-30810");
    expect(e.body).toContain("O&M manual");
    expect(e.body).toContain("2026-07-01");
  });

  it("addresses a PO request to the UMI purchasing department by default", () => {
    const p = createProject({ name: "Acme TI", region: "East Bay" });
    const e = draftEmail(p, "po_request", { vendor: "Pace Supply", items: "2x Floor drains" });
    expect(e.party).toBe("purchasing@umi1.com");
    expect(e.subject).toContain("PO REQUEST");
  });
});
