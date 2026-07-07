import { describe, expect, it } from "vitest";
import {
  closeoutProgress,
  jobCloseoutPath,
  requiredDocsForMaterial,
  stagingPath,
  vendorRequestedDocs,
} from "./closeout.js";
import { createProject } from "../factory.js";
import type { CloseoutDoc } from "../schema/project.js";

function doc(p: Partial<CloseoutDoc>): CloseoutDoc {
  return {
    id: p.id ?? "d",
    submittalId: null,
    material: p.material ?? "WC",
    docType: p.docType ?? "o_and_m",
    source: p.source ?? "vendor",
    status: p.status ?? "needed",
    requestedFrom: null,
    requestedAt: null,
    receivedAt: null,
    filedAt: null,
    stagingPath: null,
    jobPath: null,
    note: null,
  };
}

describe("closeout engine", () => {
  it("requires O&M for fixtures/equipment but not for valves/piping", () => {
    const p = createProject({ name: "T", region: "East Bay" });
    const fixture = requiredDocsForMaterial(p, { isFixtureOrEquipment: true }).map((d) => d.docType);
    const piping = requiredDocsForMaterial(p, { isFixtureOrEquipment: false }).map((d) => d.docType);
    expect(fixture).toContain("o_and_m");
    expect(piping).not.toContain("o_and_m");
    // Plumbing closeout core: as-built + warranty letter always present.
    expect(fixture).toContain("as_built");
    expect(fixture).toContain("warranty_letter");
  });

  it("only asks the vendor for vendor-sourced docs", () => {
    const p = createProject({ name: "T", region: "East Bay" });
    const vendorDocs = vendorRequestedDocs(requiredDocsForMaterial(p));
    expect(vendorDocs).toContain("cut_sheet");
    expect(vendorDocs).toContain("o_and_m");
    expect(vendorDocs).not.toContain("warranty_letter"); // internal
    expect(vendorDocs).not.toContain("as_built"); // engineering
  });

  it("builds staging and job folder paths from job name + number", () => {
    const p = createProject({ name: "Perplexity", region: "SF" });
    p.jobNumber = "11836-15";
    expect(stagingPath("Kohler K-30810")).toBe("PM Docs/All Closeout Docs/Kohler K-30810");
    expect(jobCloseoutPath(p, "Kohler K-30810")).toBe("Jobs/Perplexity (11836-15)/Closeout/Kohler K-30810");
  });

  it("tracks progress and flags a material ready to file", () => {
    const p = createProject({ name: "T", region: "East Bay" });
    // All received, nothing outstanding upstream → ready to file.
    p.closeoutDocs = [
      doc({ id: "a", material: "WC", status: "received" }),
      doc({ id: "b", material: "WC", docType: "cut_sheet", status: "received" }),
      doc({ id: "c", material: "Sink", docType: "cut_sheet", status: "requested" }),
    ];
    const prog = closeoutProgress(p);
    expect(prog.readyToFile).toEqual(["WC"]);
    expect(prog.totals.outstanding).toBe(3);
    const sink = prog.byMaterial.find((m) => m.material === "Sink")!;
    expect(sink.requested).toBe(1);
  });
});
