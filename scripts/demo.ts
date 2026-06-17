/**
 * Rydeshare — guided, immersive demo mode.
 *
 *   npm run demo            # paced: press Enter to advance through each step
 *   npm run demo -- --auto  # hands-off: plays straight through (for recordings/CI)
 *
 * It drives the REAL tools (src/agent/tools.ts) through a full job, so every number
 * you see is produced by the same deterministic engine the live app uses — but it
 * needs NO Anthropic API key, and it writes to a throwaway temp directory so your
 * real projects under data/ are never touched.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Isolate state in a throwaway dir BEFORE importing the store.
process.env.RYDESHARE_DATA_DIR = mkdtempSync(resolve(tmpdir(), "rydeshare-demo-"));

const { executeTool } = await import("../src/agent/tools.js");

const SAMPLE = resolve(__dirname, "../samples/sample_fastpipe.xlsx");
const AUTO = process.argv.includes("--auto") || process.env.RYDESHARE_DEMO_AUTO === "1";

// ----- pretty printing ---------------------------------------------------

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};
const w = (s: string) => stdout.write(s);
const line = (s = "") => w(s + "\n");
const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rl = createInterface({ input: stdin, output: stdout });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let stepNo = 0;
const TOTAL = 18;

async function pause(): Promise<void> {
  if (AUTO) {
    await wait(900);
    return;
  }
  await new Promise<void>((r) =>
    rl.question(`${c.gray}   [ press Enter to continue ▸ ]${c.reset}`, () => {
      // erase the prompt line so the transcript stays clean
      w("\x1b[1A\x1b[2K");
      r();
    }),
  );
}

function step(title: string, why: string): void {
  stepNo += 1;
  line();
  line(`${c.bold}${c.cyan}▶ STEP ${stepNo}/${TOTAL} — ${title}${c.reset}`);
  line(`${c.dim}${why}${c.reset}`);
}

/** Show the line the operator would type. */
function typed(kind: "cmd" | "say", text: string): void {
  const label = kind === "cmd" ? `${c.magenta}cmd ›${c.reset}` : `${c.magenta}you ›${c.reset}`;
  line(`  ${label} ${text}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function call(name: string, input: unknown): any {
  const r = executeTool(name, input) as Record<string, unknown>;
  if (r && typeof r === "object" && "error" in r) {
    line(`${c.yellow}  ! ${name} error: ${JSON.stringify(r)}${c.reset}`);
  }
  return r;
}

function footer(gaps: {
  name?: string;
  currentStageLabel: string;
  nextAction: string;
  blockingQuestions: string[];
}, name: string): void {
  line();
  line(`${c.bold}  [${name} · ${gaps.currentStageLabel}]${c.reset}`);
  line(`  ${c.green}NEXT ACTION:${c.reset} ${gaps.nextAction}`);
  if (gaps.blockingQuestions.length) {
    line(`  ${c.yellow}OPEN QUESTIONS:${c.reset}`);
    for (const q of gaps.blockingQuestions) line(`    • ${q}`);
  }
}

function waterfall(bid: any): void {
  const wf = bid.waterfall;
  line(`  ${c.gray}┌─ Bid waterfall ─────────────────────────${c.reset}`);
  const row = (label: string, n: number, strong = false) =>
    line(
      `  ${c.gray}│${c.reset} ${(strong ? c.bold : "")}${label.padEnd(22)}${money(n).padStart(14)}${c.reset}`,
    );
  row("Labor (loaded)", wf.labor);
  row("Labor + burden", wf.laborWithBurden);
  row("Material", wf.material);
  row("Tax", wf.tax);
  row("Rentals", wf.rentals);
  row("Subtotal", wf.subtotal);
  row("Contingency", wf.contingency);
  row("Overhead", wf.overhead);
  row("Profit", wf.profit);
  line(`  ${c.gray}├─────────────────────────────────────────${c.reset}`);
  row("TOTAL BID", wf.total, true);
  line(`  ${c.gray}└─────────────────────────────────────────${c.reset}`);
  for (const f of bid.assumptionFlags ?? []) line(`  ${c.yellow}⚠ ${f}${c.reset}`);
}

function emailCard(email: any): void {
  line(`  ${c.gray}┌─ email (${email.status}) ───────────────────${c.reset}`);
  line(`  ${c.gray}│${c.reset} ${c.dim}To:${c.reset} ${email.party}`);
  line(`  ${c.gray}│${c.reset} ${c.dim}Subject:${c.reset} ${c.bold}${email.subject}${c.reset}`);
  line(`  ${c.gray}│${c.reset}`);
  for (const bl of String(email.body).split("\n").slice(0, 7))
    line(`  ${c.gray}│${c.reset} ${bl}`);
  line(`  ${c.gray}│${c.reset} ${c.dim}…${c.reset}`);
  line(`  ${c.gray}└─────────────────────────────────────────${c.reset}`);
}

function tasksList(tasks: any[], today: string): void {
  for (const t of tasks) {
    const od = t.due && t.due < today ? ` ${c.yellow}OVERDUE${c.reset}` : "";
    line(
      `    ${c.magenta}[${t.priority}]${c.reset} ${t.title}` +
        `${t.assignee ? ` ${c.dim}→ ${t.assignee}${c.reset}` : ""}` +
        `${t.due ? ` ${c.dim}(due ${t.due})${c.reset}` : ""}${od}`,
    );
  }
}

// ----- the demo ----------------------------------------------------------

const NAME = "Acme Tower 12th-floor TI";
const TODAY = "2026-06-17";

async function main(): Promise<void> {
  line();
  line(`${c.bold}${c.cyan}Rydeshare — guided demo${c.reset}`);
  line(
    `${c.dim}A full commercial-plumbing TI job, start to finish. Real engine, no API key,${c.reset}`,
  );
  line(`${c.dim}throwaway data dir. ${AUTO ? "Auto mode." : "Press Enter to step through."}${c.reset}`);
  await pause();

  // 1 — Create the job.
  step("Create the job", "Pick a region; it resolves the UA local and seeds placeholder wages.");
  typed("cmd", `/new "${NAME}" region=East Bay`);
  const created = call("create_project", { name: NAME, region: "East Bay" });
  const id: string = created.projectId;
  const currentStage = (): string => call("list_next_actions", { projectId: id }).currentStage;
  const advanceTo = (target: string): void => {
    for (let k = 0; k < 12; k++) {
      if (currentStage() === target) break;
      if (!call("advance_stage", { projectId: id }).advanced) break;
    }
  };
  line(
    `  → Created. UA Local ${c.bold}${created.uaLocal}${c.reset} (East Bay), wage table seeded ${c.yellow}(all unverified)${c.reset}.`,
  );
  footer(created.gaps, NAME);
  await pause();

  // 2 — Read the next action.
  step("Ask what it needs", "The NEXT ACTION + OPEN QUESTIONS are computed by code, not guessed.");
  typed("cmd", "/status");
  const g2 = call("list_next_actions", { projectId: id });
  footer(g2, NAME);
  line(`  ${c.dim}↑ It is blocking on the public-works question before it will move on.${c.reset}`);
  await pause();

  // 3 — Ingest the FastPipe estimate.
  step("Import the FastPipe estimate", "It parses the export and reports any column it can't map.");
  typed("cmd", "/ingest samples/sample_fastpipe.xlsx");
  const ing = call("parse_fastpipe_excel", { projectId: id, filePath: SAMPLE });
  line(
    `  → ${c.bold}${ing.lineItemCount}${c.reset} line items · ${c.bold}${ing.rollups.laborHours}${c.reset} labor hrs · ${c.bold}${money(ing.rollups.materialCost)}${c.reset} material.`,
  );
  if (ing.unmappedColumns?.length)
    line(
      `  ${c.yellow}⚠ Unmapped column(s): ${ing.unmappedColumns.join(", ")} — confirm or add an alias.${c.reset}`,
    );
  await pause();

  // 4 — Answer the open questions in plain English.
  step("Answer in plain English", "In the live app you just talk; the brain calls update_project.");
  typed(
    "say",
    "Public works yes. Crew is 1 foreman, 3 journeymen, 1 step-3 apprentice.",
  );
  call("update_project", {
    projectId: id,
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
  line(`  → Recorded public-works = yes, scope, and the 5-person crew.`);
  await pause();

  // 5 — Compute labor.
  step("Compute labor cost", "Estimate hours × blended loaded crew rate — deterministic code.");
  typed("say", "What's the labor cost?");
  const labor = call("compute_labor_cost", { projectId: id });
  line(
    `  → ${c.bold}${labor.totalHours}${c.reset} hrs × ${c.bold}${money(labor.blendedLoadedRate)}/hr${c.reset} = ${c.bold}${money(labor.totalLaborCost)}${c.reset}`,
  );
  if (labor.usedVerifyRows)
    line(`  ${c.yellow}⚠ Blend used UNVERIFIED placeholder wages — confirm before quoting.${c.reset}`);
  await pause();

  // 6 — Compute the bid.
  step("Compute the bid", "Full waterfall with overhead & profit. Every input is echoed back.");
  typed("say", "Use 15% overhead and 10% profit. Compute the bid.");
  const bid1 = call("compute_bid", { projectId: id, overheadPct: 15, profitPct: 10 });
  waterfall(bid1);
  line(
    `  ${c.dim}↑ The UNVERIFIED stamp is your guardrail: don't send this number to a customer yet.${c.reset}`,
  );
  await pause();

  // 7 — Confirm a wage, re-run.
  step("Confirm a CBA wage & re-run", "Give it a real number; the verify flag clears, math updates.");
  typed("say", "Confirmed journeyman base is $95/hr per the Local 342 CBA. Re-run the bid.");
  call("set_wage_override", {
    projectId: id,
    classification: "journeyman",
    baseHourly: 95,
    note: "Confirmed Local 342 CBA",
  });
  call("compute_labor_cost", { projectId: id });
  const bid2 = call("compute_bid", { projectId: id, overheadPct: 15, profitPct: 10 });
  waterfall(bid2);
  line(
    `  ${c.green}✓ Journeyman row verified.${c.reset} Bid moved ${c.bold}${money(bid1.waterfall.total)}${c.reset} → ${c.bold}${money(bid2.waterfall.total)}${c.reset}.`,
  );
  // The stage gate: it only advances when the stage's required data is satisfied.
  advanceTo("submittals_rfis");
  line(`  ${c.green}✓ Stage gate:${c.reset} data complete → advanced Lease → Estimate → Bid → Contract → Submittals & RFIs.`);
  await pause();

  // 8 — Draft the bid proposal email.
  step("Draft the proposal email", "draft_email composes from job state and LOGS it — it never auto-sends.");
  typed("say", "Draft the proposal email to the GC.");
  const bidEmail = call("draft_email", { projectId: id, kind: "bid", to: "Turner GC — J. Reyes" });
  emailCard(bidEmail.email);
  call("update_email_status", { projectId: id, emailId: bidEmail.email.id, status: "sent" });
  line(`  ${c.green}✓ Marked sent${c.reset} ${c.dim}(you send by copy/paste; now tracked as awaiting reply).${c.reset}`);
  await pause();

  // 9 — Log an RFI and draft its email.
  step("Log an RFI + email it out", "Field conflicts become tracked RFIs, then a drafted email to the architect.");
  typed("say", "RFI: water-heater venting conflicts with HVAC at grid line C — confirm WH-2 flue routing.");
  const rfi = call("log_rfi", {
    projectId: id,
    subject: "Water heater venting routing",
    question: "WH-2 flue conflicts with HVAC duct at grid line C — confirm routing/clearance.",
  });
  const rfiEmail = call("draft_email", { projectId: id, kind: "rfi", to: "Architect — DLR", relatedId: rfi.rfi.id });
  emailCard(rfiEmail.email);
  call("update_email_status", { projectId: id, emailId: rfiEmail.email.id, status: "sent" });
  line(`  ${c.green}✓ RFI logged & email sent.${c.reset}`);
  await pause();

  // 10 — Log a submittal.
  step("Log a submittal", "Track fixtures/valves/backflow to approval before release.");
  typed("say", "Submittal: 22 40 00 plumbing fixtures + RPZ backflow cut sheets.");
  call("log_submittal", {
    projectId: id,
    spec: "22 40 00 Plumbing Fixtures",
    description: "Fixture cut sheets + 2\" RPZ backflow assembly data.",
  });
  line(`  ${c.green}✓ Submittal pending approval.${c.reset}`);
  await pause();

  // 11 — Add tasks (the to-do list).
  step("Build the to-do list", "Real tasks: owner, due date, priority, status — overdue surfaces first.");
  typed("say", "Add my follow-ups.");
  call("add_task", { projectId: id, title: "Confirm foreman & apprentice CBA base rates", priority: "high", assignee: "You", due: "2026-06-15" });
  call("add_task", { projectId: id, title: "Order 2\" RPZ backflow (long lead)", priority: "high", assignee: "Procurement", due: "2026-06-24" });
  call("add_task", { projectId: id, title: "Walk grid line C with HVAC foreman", priority: "normal", assignee: "Field", due: "2026-06-20" });
  const tl = call("list_tasks", { projectId: id });
  line(`  → ${c.bold}${tl.counts.open}${c.reset} open · ${c.yellow}${tl.counts.overdue} overdue${c.reset}`);
  tasksList(tl.tasks, TODAY);
  await pause();

  // 12 — Generate the install schedule.
  step("Generate the install schedule", "Rough-in → top-out → trim sequence with durations & dependencies.");
  typed("say", "Build the schedule starting 2026-07-01.");
  const sched = call("generate_schedule", { projectId: id, startDate: "2026-07-01" });
  line(`  → ${c.bold}${sched.taskCount}${c.reset} tasks · finish ${c.bold}${sched.finish}${c.reset}`);
  for (const t of sched.tasks.slice(0, 3))
    line(`    ${c.dim}•${c.reset} ${t.name} ${c.dim}(${t.start} → ${t.finish})${c.reset}`);
  advanceTo("install_inspections"); // schedule start set → move through to install
  await pause();

  // 13 — Record procurement.
  step("Record procurement", "Long-lead material tracked against need-by dates.");
  typed("say", "Procurement: 2\" RPZ backflow, Ferguson, quoted, need by 2026-07-10.");
  call("record_procurement", { projectId: id, item: "2\" RPZ backflow assembly", vendor: "Ferguson", status: "quoted", needBy: "2026-07-10" });
  line(`  ${c.green}✓ Logged (quoted).${c.reset}`);
  await pause();

  // 14 — Log an inspection.
  step("Schedule an inspection", "Inspections gate the phases: rough-in before cover, then top-out, final.");
  typed("say", "Schedule the rough-in inspection for 2026-07-08.");
  call("log_inspection", { projectId: id, type: "rough_in", result: "scheduled", date: "2026-07-08" });
  line(`  ${c.green}✓ Rough-in inspection scheduled.${c.reset}`);
  await pause();

  // 15 — Certified payroll preview.
  step("Certified-payroll preview", "Public-works weekly gross at base rate + apprentice-ratio check (preview only).");
  typed("say", "Log week-ending 2026-07-10 hours and show the certified-payroll preview.");
  call("update_project", {
    projectId: id,
    patch: {
      payroll: [
        {
          weekEnding: "2026-07-10",
          entries: [
            { worker: "R. Vasquez", classification: "foreman", hours: 40 },
            { worker: "T. Nguyen", classification: "journeyman", hours: 40 },
            { worker: "M. Silva", classification: "journeyman", hours: 40 },
            { worker: "D. Park", classification: "journeyman", hours: 40 },
            { worker: "J. Cole", classification: "apprentice_step_3", hours: 40 },
          ],
        },
      ],
    },
  });
  const cpr = call("certified_payroll_summary", { projectId: id, weekEnding: "2026-07-10" });
  line(`  → ${c.bold}${cpr.totalHours}${c.reset} hrs · gross ${c.bold}${money(cpr.totalGross)}${c.reset}`);
  line(`  ${cpr.ratioCheck.ok ? c.green + "✓ apprentice ratio OK" : c.yellow + "⚠ ratio issue"}${c.reset} ${c.dim}(${cpr.ratioCheck.detail.split(".")[0]})${c.reset}`);
  for (const f of cpr.flags) line(`  ${c.yellow}⚠ ${f}${c.reset}`);
  await pause();

  // 16 — Log a change order.
  step("Log a change order", "Priced COs are tracked and (phase 2) flow into contract value.");
  typed("say", "CO: add 2 mop sinks in the level-12 break rooms, +$4,200.");
  call("log_change_order", { projectId: id, description: "Add 2 mop sinks, level-12 break rooms", costDelta: 4200 });
  line(`  ${c.green}✓ CO logged (pending).${c.reset}`);
  await pause();

  // 17 — Inbound reply clears the thread; close out a task.
  step("Log a reply & close a task", "Inbound mail can auto-clear the awaiting-reply flag; tasks get marked done.");
  typed("say", "Architect replied on the venting RFI; mark the grid-line-C walk done.");
  call("log_inbound_email", { projectId: id, from: "Architect — DLR", subject: "RE: Water heater venting routing", kind: "rfi", relatedId: rfi.rfi.id });
  const walk = tl.tasks.find((t: any) => /grid line C/i.test(t.title));
  if (walk) call("update_task", { projectId: id, taskId: walk.id, status: "done" });
  line(`  ${c.green}✓ Reply logged (RFI email no longer awaiting); 1 task completed.${c.reset}`);
  await pause();

  // 18 — Daily briefing: the whole plate at a glance.
  step("Daily briefing", "One snapshot of the entire job — the 'what's on my plate' command.");
  typed("cmd", "/briefing");
  const br = call("daily_briefing", { projectId: id });
  line(`  ${c.bold}═══ ${NAME} · ${br.stage} ═══${c.reset}`);
  line(`  ${c.green}NEXT ACTION:${c.reset} ${br.nextAction}`);
  line(`  ${c.bold}TASKS:${c.reset} ${br.tasks.open} open, ${c.yellow}${br.tasks.overdue} overdue${c.reset}`);
  tasksList(br.tasks.top, TODAY);
  line(`  ${c.bold}EMAIL:${c.reset} ${br.email.drafts} draft, ${br.email.awaitingReplies} awaiting reply`);
  line(`  ${c.bold}OPEN:${c.reset} RFIs ${br.rfis.open} · submittals ${br.submittals.pending} · inspections ${br.inspections.upcoming}`);

  line();
  line(`${c.bold}${c.green}That's the whole loop.${c.reset} estimate → bid → RFIs/submittals → email → tasks → schedule →`);
  line(`${c.green}procurement → inspections → payroll → change orders → briefing.${c.reset}`);
  line(`${c.dim}Run it for real with your own jobs: ${c.reset}${c.bold}npm run dev${c.reset}   ${c.dim}· Full guide: MANUAL.md${c.reset}`);
  line();
  rl.close();
}

void main();
