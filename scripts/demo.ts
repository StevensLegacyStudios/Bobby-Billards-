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
const TOTAL = 8;

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

// ----- the demo ----------------------------------------------------------

const NAME = "Acme Tower 12th-floor TI";

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
  await pause();

  // 8 — Advance the stage.
  step("Advance the stage", "It only lets you move on once the stage's required info is satisfied.");
  typed("say", "Looks good — move us to the next stage.");
  const adv = call("advance_stage", { projectId: id });
  if (adv.advanced) {
    line(`  ${c.green}✓ Advanced.${c.reset}`);
    footer(adv.gaps, NAME);
  } else {
    line(`  ${c.yellow}Held back: ${adv.reason}${c.reset}`);
  }

  line();
  line(`${c.bold}${c.green}That's the loop.${c.reset} ingest → plan → ask → compute → verify → advance.`);
  line(`${c.dim}Run it for real with your own jobs: ${c.reset}${c.bold}npm run dev${c.reset}`);
  line(`${c.dim}Full guide: MANUAL.md${c.reset}`);
  line();
  rl.close();
}

void main();
