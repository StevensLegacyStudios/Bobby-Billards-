/**
 * Deterministic end-to-end check of the tool → engine → store loop, exactly as
 * the agent would drive it, but without the LLM (so it needs no API key).
 * Exercises the plan's verification scenarios and asserts on the results.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Isolate state in a temp dir BEFORE importing the store.
process.env.RYDESHARE_DATA_DIR = mkdtempSync(resolve(tmpdir(), "rydeshare-e2e-"));

const { executeTool } = await import("../src/agent/tools.js");
const { loadProject } = await import("../src/store/projects.js");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = (name: string, input: unknown): any => {
  const r = executeTool(name, input) as Record<string, unknown>;
  if (r && typeof r === "object" && "error" in r) {
    throw new Error(`${name} failed: ${JSON.stringify(r)}`);
  }
  return r;
};

const SAMPLE = resolve(__dirname, "../samples/sample_fastpipe.xlsx");
let pass = 0;
const ok = (label: string, cond: boolean) => {
  assert.ok(cond, label);
  pass += 1;
  console.log(`  ✓ ${label}`);
};

console.log("Rydeshare e2e\n");

// 1. Create a project.
const created = call("create_project", { name: "Demo TI", region: "East Bay" });
const projectId: string = created.projectId;
ok("create_project returns an id", typeof projectId === "string");
ok("UA local resolved to 342 for East Bay", created.uaLocal === "342");
ok(
  "initial gaps block on public works",
  created.gaps.blockingQuestions.some((q: string) => /public works/i.test(q)),
);

// 2. A brand-new project refuses to advance (blocking info missing).
const fresh = call("create_project", { name: "Fresh", region: "SF" });
const refusal = call("advance_stage", { projectId: fresh.projectId });
ok("advance_stage refuses when blocked", refusal.advanced === false);

// 3. Ingest the FastPipe export.
const ingest = call("parse_fastpipe_excel", { projectId, filePath: SAMPLE });
ok("ingest mapped 5 line items", ingest.lineItemCount === 5);
ok("ingest rolled up labor hours", ingest.rollups.laborHours === 338.5);
ok("ingest reported the unmapped Notes column", ingest.unmappedColumns.includes("Notes"));

// 4. Answer the open questions via update_project (public works + crew).
call("update_project", {
  projectId,
  patch: {
    publicWorks: true,
    scopeSummary: "12th-floor office TI: DWV, domestic water, gas, fixtures.",
    labor: {
      crew: [
        { classification: "foreman", count: 1 },
        { classification: "journeyman", count: 3 },
        { classification: "apprentice_step_3", count: 1 },
      ],
    },
  },
});

// 5. Compute labor cost.
const labor = call("compute_labor_cost", { projectId });
ok("labor cost computed > 0", labor.totalLaborCost > 0);
ok("labor flagged use of unverified placeholder wages", labor.usedVerifyRows === true);

// 6. Compute the bid.
const bid1 = call("compute_bid", { projectId, overheadPct: 15, profitPct: 10 });
ok("bid total computed > 0", bid1.waterfall.total > 0);
ok(
  "bid flags unverified placeholder wages",
  bid1.assumptionFlags.some((f: string) => /UNVERIFIED/i.test(f)),
);

// 7. Override the journeyman wage with a confirmed number, recompute.
call("set_wage_override", {
  projectId,
  classification: "journeyman",
  baseHourly: 95,
  note: "Confirmed Local 342 CBA",
});
call("compute_labor_cost", { projectId });
const bid2 = call("compute_bid", { projectId, overheadPct: 15, profitPct: 10 });
ok("bid total changed after wage override", bid2.waterfall.total !== bid1.waterfall.total);

const afterOverride = loadProject(projectId)!;
const jwRow = afterOverride.wageAssumptions.rows.find(
  (r) => r.classification === "journeyman",
)!;
ok("overridden journeyman row is no longer flagged verify", jwRow.verify === false);

// 8. Advance the stage now that lease/scope is satisfied.
const advanced = call("advance_stage", { projectId });
ok("advance_stage succeeds once unblocked", advanced.advanced === true);

// 9. Persistence: reload from disk and confirm state survived.
const reloaded = loadProject(projectId)!;
ok("public works persisted", reloaded.publicWorks === true);
ok("estimate persisted", reloaded.estimate.rollups.laborHours === 338.5);
ok("crew persisted", reloaded.labor.crew.length === 3);
ok("activity log recorded", reloaded.activityLog.length > 0);

// 10. Tasks: add, surface overdue, complete.
const task = call("add_task", {
  projectId,
  title: "Confirm foreman & apprentice CBA rates",
  priority: "high",
  due: "2020-01-01",
});
ok("add_task returns a task id", typeof task.task.id === "string");
const tlist = call("list_tasks", { projectId });
ok("overdue task surfaces in list", tlist.counts.overdue === 1);
call("update_task", { projectId, taskId: task.task.id, status: "done" });
const tlist2 = call("list_tasks", { projectId });
ok("completing a task clears open and records done", tlist2.counts.open === 0 && tlist2.counts.done === 1);

// 11. Email: draft from state, track to sent, reply clears awaiting.
const demoRfi = call("log_rfi", { projectId, subject: "Venting", question: "Confirm WH-2 flue routing." });
const email = call("draft_email", { projectId, kind: "rfi", relatedId: demoRfi.rfi.id });
ok("draft_email composes a subject from job state", /Venting/.test(email.email.subject));
ok("draft_email starts as a draft", email.email.status === "draft");
call("update_email_status", { projectId, emailId: email.email.id, status: "sent" });
ok("sent outbound email is awaiting reply", call("list_emails", { projectId }).awaitingReplies === 1);
call("log_inbound_email", { projectId, from: "Architect", subject: "RE: Venting", kind: "rfi", relatedId: demoRfi.rfi.id });
ok("inbound reply clears the awaiting-reply flag", call("list_emails", { projectId }).awaitingReplies === 0);

// 12. Briefing rolls it all up.
const briefing = call("daily_briefing", { projectId });
ok("briefing reports the current stage", typeof briefing.stage === "string" && briefing.stage.length > 0);
ok("briefing counts the open RFI", briefing.rfis.open >= 1);

// 13. Closeout docs: request with submittal → receive → file on approval.
const sub = call("log_submittal", { projectId, spec: "22 40 00", description: "Kohler K-30810 WC" });
const req = call("request_closeout_docs", {
  projectId,
  material: "Kohler K-30810 Water Closet",
  vendor: "Cal Steam",
  submittalId: sub.submittal.id,
  neededBy: "2026-07-01",
});
ok("request_closeout_docs stages a PM Docs folder", req.stagingPath === "PM Docs/All Closeout Docs/Kohler K-30810 Water Closet");
ok("request_closeout_docs drafts the combined vendor email", req.email.kind === "closeout_request" && /Closeout Docs/.test(req.email.subject));
ok("vendor docs are marked requested", req.created.some((d: any) => d.source === "vendor" && d.status === "requested"));
ok("as-built is sourced from engineering", req.created.some((d: any) => d.docType === "as_built" && d.source === "engineering"));
call("log_closeout_doc_received", { projectId, material: "Kohler K-30810 Water Closet" });
const csReceived = call("closeout_status", { projectId });
ok("received docs are staged, ready to file", csReceived.readyToFile.includes("Kohler K-30810 Water Closet"));
const filed = call("file_closeout_docs", { projectId, material: "Kohler K-30810 Water Closet" });
ok("filing moves docs into the job closeout folder", /\/Closeout\/Kohler K-30810 Water Closet$/.test(filed.to));
const csFiled = call("closeout_status", { projectId });
ok("filed docs clear from outstanding", csFiled.byMaterial.find((m: any) => m.material === "Kohler K-30810 Water Closet").filed > 0);

console.log(`\nAll ${pass} checks passed.`);
