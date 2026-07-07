/**
 * Build docs/Rydeshare-Manual.pdf — the operator's manual as a PDF, including
 * "screenshots" of the guided demo (each step rendered as a real terminal panel,
 * captured live from `npm run demo -- --auto`, ANSI colors and all).
 *
 *   npm run manual:pdf
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "docs");
const OUT = resolve(OUT_DIR, "Rydeshare-Manual.pdf");
mkdirSync(OUT_DIR, { recursive: true });

// ---- 1. Capture the live demo (with ANSI colors) ------------------------

const raw = execFileSync("npx", ["tsx", "scripts/demo.ts", "--auto"], {
  cwd: ROOT,
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "1" },
});

// ---- 2. Parse ANSI SGR into styled segments -----------------------------

const COLORS = {
  fg: "#d4d4d4",
  bg: "#0d1117",
  chrome: "#161b22",
  1: "#ffffff", // bold default → white
  2: "#8b949e", // dim
  32: "#56d364", // green
  33: "#e3b341", // yellow
  35: "#bc8cff", // magenta
  36: "#56b6c2", // cyan
  90: "#6e7681", // gray
};

function parseAnsiLine(line) {
  const segs = [];
  let state = { bold: false, dim: false, color: null };
  let i = 0;
  const re = /\x1b\[([0-9;]*)m/g;
  let m;
  let last = 0;
  const push = (text) => {
    if (!text) return;
    let color = COLORS.fg;
    if (state.color && COLORS[state.color]) color = COLORS[state.color];
    else if (state.bold) color = COLORS[1];
    else if (state.dim) color = COLORS[2];
    segs.push({ text, color, bold: state.bold });
  };
  while ((m = re.exec(line))) {
    push(line.slice(last, m.index));
    const codes = (m[1] || "0").split(";").filter(Boolean);
    if (codes.length === 0) codes.push("0");
    for (const code of codes) {
      const n = Number(code);
      if (n === 0) state = { bold: false, dim: false, color: null };
      else if (n === 1) state.bold = true;
      else if (n === 2) state.dim = true;
      else if ([32, 33, 35, 36, 90].includes(n)) state.color = n;
    }
    last = re.lastIndex;
    i++;
  }
  push(line.slice(last));
  if (segs.length === 0) segs.push({ text: "", color: COLORS.fg, bold: false });
  return segs;
}

// Strip the npm preamble; keep from the demo banner onward.
const allLines = raw.replace(/\r/g, "").split("\n");
const startIdx = allLines.findIndex((l) => /Rydeshare — guided demo/.test(l.replace(/\x1b\[[0-9;]*m/g, "")));
const lines = allLines.slice(startIdx >= 0 ? startIdx : 0);

const plain = (l) => l.replace(/\x1b\[[0-9;]*m/g, "");

// Group into: intro, then one block per STEP.
const blocks = [];
let cur = { title: "Overview", lines: [] };
for (const l of lines) {
  const mm = /▶ STEP (\d+)\/\d+ — (.+)/.exec(plain(l));
  if (mm) {
    blocks.push(cur);
    cur = { title: `Step ${mm[1]} — ${mm[2].trim()}`, lines: [l] };
  } else {
    cur.lines.push(l);
  }
}
blocks.push(cur);

// ---- 3. Render the PDF --------------------------------------------------

const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
doc.pipe(createWriteStream(OUT));

const PAGE_W = 612;
const M = 50;
const CONTENT_W = PAGE_W - M * 2;
const INK = "#1f2328";
const MUTED = "#57606a";
const ACCENT = "#0b5fff";
const WARN_BG = "#fff8e6";
const WARN_BORDER = "#e3b341";

function h1(text) {
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text(text, M, doc.y);
  doc.moveDown(0.3);
}
function h2(text) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(14).text(text, M, doc.y);
  doc.moveDown(0.3);
}
function para(text, opts = {}) {
  doc.fillColor(opts.color || INK).font(opts.font || "Helvetica").fontSize(opts.size || 10.5)
    .text(text, M, doc.y, { width: CONTENT_W, lineGap: 2, ...opts });
  doc.moveDown(0.4);
}
function bullets(items) {
  doc.font("Helvetica").fontSize(10.5).fillColor(INK);
  for (const it of items) {
    doc.text("•  " + it, M + 8, doc.y, { width: CONTENT_W - 8, lineGap: 2 });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.3);
}

// --- Cover ---
doc.rect(0, 0, PAGE_W, 200).fill("#0d1117");
doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(28).text("Rydeshare", M, 60);
doc.fillColor("#56b6c2").font("Helvetica-Bold").fontSize(15)
  .text("AI Project Manager — Operator's Manual", M, 98);
doc.fillColor("#8b949e").font("Helvetica").fontSize(11)
  .text("Commercial-plumbing tenant-improvement (TI) · NorCal union crews", M, 124, { width: CONTENT_W });
doc.fillColor("#6e7681").font("Helvetica").fontSize(9)
  .text("Generated " + new Date().toISOString().slice(0, 10) + "  ·  v0.1.0", M, 160);

doc.y = 230;
doc.fillColor(INK).font("Helvetica").fontSize(11).text(
  "Rydeshare is a terminal chat app that acts as your project manager's brain. You tell it about " +
  "a plumbing TI job; it builds the plan, tracks every stage, tells you the single next action, and " +
  "asks you for whatever it's missing. The money math (labor, wages, bid) is done by deterministic, " +
  "unit-tested code — not guessed by the AI — so the numbers are reproducible. Everything is stored " +
  "as plain JSON files on your machine.",
  M, doc.y, { width: CONTENT_W, lineGap: 3 },
);
doc.moveDown(0.8);

// Compliance box
const boxY = doc.y;
const boxText =
  "COMPLIANCE — READ THIS. Every wage rate shipped with the tool is an unverified placeholder. " +
  "Confirm against the current CA DIR determination (dir.ca.gov/oprl) and the applicable UA-local CBA " +
  "before any bid, payroll, or contract use. This tool assists a qualified PM — it does not replace " +
  "certified-payroll review, apprentice-ratio compliance, or licensed/code judgment.";
doc.font("Helvetica-Bold").fontSize(9.5);
const boxH = doc.heightOfString(boxText, { width: CONTENT_W - 24, lineGap: 2 }) + 20;
doc.roundedRect(M, boxY, CONTENT_W, boxH, 6).fillAndStroke(WARN_BG, WARN_BORDER);
doc.fillColor("#7a5b00").font("Helvetica-Bold").fontSize(9.5)
  .text(boxText, M + 12, boxY + 10, { width: CONTENT_W - 24, lineGap: 2 });
doc.y = boxY + boxH + 10;

// --- Setup ---
doc.addPage();
h1("Getting started");
h2("1. One-time setup");
para("You need Node.js 22 or newer and an Anthropic API key (console.anthropic.com → API Keys). The key lives only in your local .env file, which is gitignored and never committed.");
codeBlock(["cp .env.example .env     # paste your ANTHROPIC_API_KEY into .env", "npm install"]);
h2("2. See it work in 60 seconds (no API key)");
para("Before you wire up a key, watch the whole job play out. It drives the real engine and writes to a throwaway temp dir, so your real jobs are never touched.");
codeBlock(["npm run demo            # press Enter to step through each stage", "npm run demo -- --auto  # hands-off — plays straight through"]);
h2("3. Start the app for real");
codeBlock(["npm run dev            # starts the chat REPL; type a message or a /command"]);
para("Quit any time with /exit (or Ctrl-C).");

h2("Two ways to drive it");
para("Slash commands are shortcuts; you can also just talk in plain English and the brain picks the right tool.", { font: "Helvetica-Oblique" });
bullets([
  '/new "<name>" region=<SF|East Bay|North Bay|Sacramento|San Jose>  — create a job',
  "/open <projectId>  — reopen a saved job and get its next action",
  "/ingest <path-to-xlsx>  — import a FastPipe export into the active job",
  "/status  or  /next  — show the deterministic NEXT ACTION + OPEN QUESTIONS",
  "/briefing  — what's on my plate: next action, tasks, emails, RFIs, closeout",
  "/tasks  — to-dos (overdue first)   ·   /email  — logged emails   ·   /closeout  — doc progress",
  "/projects  — list saved jobs   ·   /help  — banner   ·   /exit  — quit",
]);

h2("Tasks, email & the daily briefing");
para("Beyond estimating and bidding, the tool runs the job day-to-day:");
bullets([
  "TASKS — a real action list (owner, due date, priority, status), separate from the install schedule. Overdue items surface first. Just tell the brain what you need to do, or who owns it.",
  "EMAIL (draft + track, never auto-sends) — it composes RFI, submittal, bid-proposal, change-order, schedule and procurement emails from the job's own data and logs them. You send by copy/paste, then it tracks 'awaiting reply'. Log incoming mail to keep correspondence in one place.",
  "DAILY BRIEFING — one snapshot of the whole job: stage + next action, open/overdue tasks, emails awaiting reply, open RFIs/submittals, upcoming inspections, and closeout-doc status.",
  "CLOSEOUT DOCS — request them WITH the submittal (As-builts from Engineering, O&Ms from the vendor for fixtures/equipment, Warranty Letter from the UMI template). Received docs stage under 'PM Docs/All Closeout Docs/<material>'; once the GC approves the submittal, they file into the job's closeout folder.",
]);
para("Also tracked: RFIs, submittals, change orders, inspections, procurement, the install schedule, and a certified-payroll preview — all shown in the step-by-step demo on the following pages.", { color: MUTED });

h2("The job lifecycle (stages)");
para("A job moves through these stages. The tool will not let you skip ahead while required info is still missing — answer the open questions and it advances.");
bullets([
  "Lease / Scope Review  →  Estimate & Takeoff (FastPipe)  →  Bid / Proposal",
  "Contract / Buyout  →  Submittals & RFIs  →  Schedule & Manpower",
  "Procurement  →  Install & Inspections  →  Certified Payroll",
  "Change Orders  →  Closeout",
]);

h2("Wages — the part that matters most");
bullets([
  "Wages are seeded per UA local (38, 342, 393, 447) and every rate is flagged verify=true — do not trust the number yet.",
  'To confirm a rate, just tell the brain: "Confirmed journeyman base is $95/hr per the Local 342 CBA." That clears the flag and records who/when.',
  "Any bid computed while unverified rates are in play is stamped UNVERIFIED — your guardrail against sending a number to a customer too early.",
]);

h2("Troubleshooting");
bullets([
  "WARNING: ANTHROPIC_API_KEY is not set  →  copy .env.example to .env and paste your key.",
  'Unknown region "..."  →  use exactly: SF, East Bay, North Bay, Sacramento, or San Jose.',
  "Won't advance a stage  →  there are still OPEN QUESTIONS; run /status and answer them.",
  "A bid still says UNVERIFIED  →  at least one wage rate is still a placeholder.",
  "Node version error  →  you need Node 22+ (check with node --version).",
]);

// --- Demo screenshots ---
doc.addPage();
h1("The guided demo, step by step");
para("These are live screenshots captured from npm run demo -- --auto. Every number is produced by the real engine — no API key, throwaway data dir.", { color: MUTED });

for (const block of blocks) {
  if (block.title === "Overview") continue; // skip banner block in the screenshot section
  terminalPanel(block.title, block.lines);
}

// Footer note
doc.moveDown(0.5);
para("That's the loop: ingest → plan → ask → compute → verify → advance. Run it for real with your own jobs via npm run dev. The editable source of this manual is MANUAL.md in the repo.", { color: MUTED });

// ---- helpers that draw blocks ----

function codeBlock(cmds) {
  const padY = 8, lineH = 14;
  const h = padY * 2 + cmds.length * lineH;
  if (doc.y + h > 740) doc.addPage();
  const y = doc.y;
  doc.roundedRect(M, y, CONTENT_W, h, 5).fill("#0d1117");
  doc.font("Courier").fontSize(9.5).fillColor("#56d364");
  cmds.forEach((cmd, i) => doc.text(cmd, M + 12, y + padY + i * lineH, { width: CONTENT_W - 24, lineBreak: false }));
  doc.y = y + h + 8;
  doc.fillColor(INK);
}

function terminalPanel(title, panelLines) {
  const FS = 8.5;
  const LH = 11.5;
  const padX = 12;
  const padTop = 26; // room for window chrome
  const padBot = 10;
  const innerW = CONTENT_W - padX * 2;

  // Pre-measure wrapped height.
  doc.font("Courier").fontSize(FS);
  let textH = 0;
  const measured = panelLines.map((l) => {
    const segs = parseAnsiLine(l);
    const joined = segs.map((s) => s.text).join("") || " ";
    const hh = doc.heightOfString(joined, { width: innerW, lineGap: 1 });
    textH += Math.max(hh, LH);
    return segs;
  });
  const panelH = padTop + textH + padBot;

  // Title above the panel.
  if (doc.y + panelH + 26 > 750) doc.addPage();
  doc.moveDown(0.4);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(title, M, doc.y);
  doc.moveDown(0.2);

  const y0 = doc.y;
  // Panel background + window chrome.
  doc.roundedRect(M, y0, CONTENT_W, panelH, 6).fill(COLORS.bg);
  doc.roundedRect(M, y0, CONTENT_W, 18, 6).fill(COLORS.chrome);
  doc.rect(M, y0 + 9, CONTENT_W, 9).fill(COLORS.chrome);
  const dots = ["#ff5f56", "#ffbd2e", "#27c93f"];
  dots.forEach((c, i) => doc.circle(M + 14 + i * 12, y0 + 9, 3).fill(c));

  // Render lines.
  let cy = y0 + padTop;
  for (const segs of measured) {
    const joined = segs.map((s) => s.text).join("");
    const hh = Math.max(doc.heightOfString(joined || " ", { width: innerW, lineGap: 1 }), LH);
    let first = true;
    segs.forEach((s, idx) => {
      const isLast = idx === segs.length - 1;
      doc.font(s.bold ? "Courier-Bold" : "Courier").fontSize(FS).fillColor(s.color);
      if (first) {
        doc.text(s.text, M + padX, cy, { width: innerW, lineGap: 1, continued: !isLast });
        first = false;
      } else {
        doc.text(s.text, { continued: !isLast });
      }
    });
    if (segs.length === 1 && segs[0].text === "") {
      // blank line — nothing rendered, just advance
    }
    cy += hh;
  }
  doc.y = y0 + panelH + 6;
  doc.fillColor(INK);
}

doc.end();
console.log("Wrote", OUT);
