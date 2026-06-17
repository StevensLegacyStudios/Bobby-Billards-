import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { Agent } from "./agent/loop.js";
import { closeoutProgress } from "./engine/closeout.js";
import { computeGaps } from "./engine/gaps.js";
import { buildBriefing, taskBuckets } from "./engine/tasks.js";
import { REGIONS } from "./schema/project.js";
import { listProjects, loadProject } from "./store/projects.js";

const BANNER = `
Rydeshare — AI Project Manager for Commercial Plumbing TI (NorCal Union)
------------------------------------------------------------------------
Type a message, or use a command:
  /new "<name>" region=<SF|East Bay|North Bay|Sacramento|San Jose>
  /open <projectId>          open a project and get the next action
  /ingest <path-to-xlsx>     import a FastPipe export into the active project
  /status | /next            show NEXT ACTION + OPEN QUESTIONS (deterministic)
  /briefing                  what's on my plate: next action, tasks, emails, RFIs
  /tasks                     list the job's to-dos (overdue first)
  /email                     list logged emails (drafts + awaiting reply)
  /closeout                  closeout-doc progress per material
  /projects                  list saved projects
  /help                      show this help
  /exit                      quit

Wages shipped with this tool are UNVERIFIED placeholders — confirm against the
current CA DIR determination (dir.ca.gov/oprl) and the UA-local CBA before use.
`;

const agent = new Agent();

function renderGapFooter(projectId: string | null): void {
  if (!projectId) return;
  const project = loadProject(projectId);
  if (!project) return;
  const gaps = computeGaps(project);
  const today = new Date().toISOString().slice(0, 10);
  const buckets = taskBuckets(project, today);
  const awaiting = project.emails.filter(
    (e) => e.direction === "outbound" && e.status === "sent",
  ).length;
  stdout.write(`\n\x1b[1m[${project.name} · ${gaps.currentStageLabel}]\x1b[0m\n`);
  stdout.write(`NEXT ACTION: ${gaps.nextAction}\n`);
  if (gaps.blockingQuestions.length) {
    stdout.write("OPEN QUESTIONS:\n");
    for (const q of gaps.blockingQuestions) stdout.write(`  • ${q}\n`);
  }
  if (buckets.open.length) {
    const od = buckets.overdue.length ? ` (${buckets.overdue.length} overdue)` : "";
    stdout.write(`TASKS: ${buckets.open.length} open${od}\n`);
    for (const t of buckets.open.slice(0, 3))
      stdout.write(`  • [${t.priority}] ${t.title}${t.assignee ? ` → ${t.assignee}` : ""}${t.due ? ` (due ${t.due})` : ""}\n`);
  }
  if (awaiting) stdout.write(`AWAITING REPLY: ${awaiting} email(s)\n`);
}

function renderTasks(projectId: string | null): void {
  if (!projectId) return void stdout.write("No active project. /open <id> or /new.\n");
  const project = loadProject(projectId);
  if (!project) return;
  const today = new Date().toISOString().slice(0, 10);
  const b = taskBuckets(project, today);
  stdout.write(
    `\n\x1b[1mTasks — ${project.name}\x1b[0m  (${b.open.length} open · ${b.overdue.length} overdue · ${b.done.length} done)\n`,
  );
  if (!b.open.length) stdout.write("  (no open tasks — add one by telling the brain)\n");
  for (const t of b.open) {
    const od = t.due && t.due < today ? " \x1b[31mOVERDUE\x1b[0m" : "";
    stdout.write(
      `  ${t.status === "in_progress" ? "▸" : t.status === "blocked" ? "✗" : "○"} [${t.priority}] ${t.title}` +
        `${t.assignee ? ` → ${t.assignee}` : ""}${t.due ? ` (due ${t.due})` : ""}${od}\n`,
    );
  }
}

function renderEmails(projectId: string | null): void {
  if (!projectId) return void stdout.write("No active project. /open <id> or /new.\n");
  const project = loadProject(projectId);
  if (!project) return;
  const awaiting = project.emails.filter((e) => e.direction === "outbound" && e.status === "sent").length;
  stdout.write(
    `\n\x1b[1mEmails — ${project.name}\x1b[0m  (${project.emails.length} total · ${awaiting} awaiting reply)\n`,
  );
  if (!project.emails.length) stdout.write("  (none yet — draft one by telling the brain)\n");
  for (const e of project.emails) {
    const arrow = e.direction === "outbound" ? "→" : "←";
    stdout.write(`  ${arrow} [${e.status}] ${e.party}  ·  ${e.subject}\n`);
  }
}

function renderBriefing(projectId: string | null): void {
  if (!projectId) return void stdout.write("No active project. /open <id> or /new.\n");
  const project = loadProject(projectId);
  if (!project) return;
  const br = buildBriefing(project, new Date().toISOString().slice(0, 10));
  stdout.write(`\n\x1b[1m═══ Briefing — ${project.name} · ${br.stage} ═══\x1b[0m\n`);
  stdout.write(`NEXT ACTION: ${br.nextAction}\n`);
  stdout.write(
    `TASKS: ${br.tasks.open} open` +
      `${br.tasks.overdue ? `, ${br.tasks.overdue} overdue` : ""}` +
      `${br.tasks.dueToday ? `, ${br.tasks.dueToday} due today` : ""}\n`,
  );
  for (const t of br.tasks.top) stdout.write(`  • [${t.priority}] ${t.title}${t.due ? ` (due ${t.due})` : ""}\n`);
  stdout.write(`EMAIL: ${br.email.drafts} draft(s), ${br.email.awaitingReplies} awaiting reply\n`);
  stdout.write(`RFIs open: ${br.rfis.open}  ·  Submittals pending: ${br.submittals.pending}  ·  Inspections upcoming: ${br.inspections.upcoming}\n`);
  stdout.write(`CLOSEOUT: ${br.closeout.outstanding} doc(s) outstanding, ${br.closeout.readyToFile} material(s) ready to file\n`);
}

function renderCloseout(projectId: string | null): void {
  if (!projectId) return void stdout.write("No active project. /open <id> or /new.\n");
  const project = loadProject(projectId);
  if (!project) return;
  const co = closeoutProgress(project);
  stdout.write(
    `\n\x1b[1mCloseout — ${project.name}\x1b[0m  (${co.totals.filed}/${co.totals.total} filed · ${co.totals.outstanding} outstanding)\n`,
  );
  if (!co.byMaterial.length) stdout.write("  (no closeout docs tracked yet — request them when you submit)\n");
  for (const m of co.byMaterial) {
    const ready = co.readyToFile.includes(m.material) ? " \x1b[32mREADY TO FILE\x1b[0m" : "";
    stdout.write(
      `  ${m.complete ? "✓" : "○"} ${m.material}: ${m.filed} filed, ${m.received} staged, ${m.requested} requested, ${m.needed} needed${ready}\n`,
    );
  }
}

function parseNew(line: string): { name: string; region: string } | null {
  const regionMatch = /region=(.+)$/i.exec(line);
  if (!regionMatch) return null;
  const region = regionMatch[1]!.trim();
  const before = line.slice(0, regionMatch.index).replace(/^\/new\s*/i, "");
  const quoted = /"([^"]+)"|'([^']+)'/.exec(before);
  const name = ((quoted ? (quoted[1] ?? quoted[2]) : before) ?? "").trim();
  if (!name) return null;
  return { name, region };
}

async function runTurn(message: string): Promise<void> {
  const result = await agent.send(message, (t) => stdout.write(t));
  stdout.write("\n");
  renderGapFooter(agent.activeProjectId);
}

async function handleCommand(line: string): Promise<boolean> {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  const arg = line.trim().slice((cmd ?? "").length).trim();

  switch (cmd) {
    case "/help":
      stdout.write(BANNER);
      return true;
    case "/exit":
    case "/quit":
      return false;
    case "/projects": {
      const projects = listProjects();
      if (!projects.length) stdout.write("No projects yet. Use /new.\n");
      for (const p of projects)
        stdout.write(
          `  ${p.id}  ${p.name}  [${p.region} · ${p.currentStage}]  open Qs: ${p.openQuestionCount}\n`,
        );
      return true;
    }
    case "/status":
    case "/next":
      if (!agent.activeProjectId) stdout.write("No active project. /open <id> or /new.\n");
      else renderGapFooter(agent.activeProjectId);
      return true;
    case "/briefing":
      renderBriefing(agent.activeProjectId);
      return true;
    case "/tasks":
      renderTasks(agent.activeProjectId);
      return true;
    case "/email":
    case "/emails":
      renderEmails(agent.activeProjectId);
      return true;
    case "/closeout":
      renderCloseout(agent.activeProjectId);
      return true;
    case "/new": {
      const parsed = parseNew(line);
      if (!parsed) {
        stdout.write('Usage: /new "<name>" region=<region>\n');
        return true;
      }
      if (!REGIONS.includes(parsed.region as (typeof REGIONS)[number])) {
        stdout.write(`Unknown region "${parsed.region}". One of: ${REGIONS.join(", ")}\n`);
        return true;
      }
      await runTurn(
        `Create a new project named "${parsed.name}" in region ${parsed.region}, then tell me the next action and what you need from me.`,
      );
      return true;
    }
    case "/open": {
      if (!arg) {
        stdout.write("Usage: /open <projectId>\n");
        return true;
      }
      agent.activeProjectId = arg;
      await runTurn(
        `Open project ${arg}: read its current state and tell me the single next action plus any open questions.`,
      );
      return true;
    }
    case "/ingest": {
      if (!arg) {
        stdout.write("Usage: /ingest <path-to-xlsx>\n");
        return true;
      }
      if (!agent.activeProjectId) {
        stdout.write("No active project. /open <id> or /new first.\n");
        return true;
      }
      await runTurn(
        `Import the FastPipe Excel export at "${arg}" into project ${agent.activeProjectId} with parse_fastpipe_excel, then summarize the rollups and any unmapped columns.`,
      );
      return true;
    }
    default:
      stdout.write(`Unknown command ${cmd}. /help for commands.\n`);
      return true;
  }
}

async function main(): Promise<void> {
  stdout.write(BANNER);
  if (!process.env.ANTHROPIC_API_KEY) {
    stdout.write(
      "\n\x1b[33mWARNING: ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.\x1b[0m\n",
    );
  }

  const rl = createInterface({ input: stdin, output: stdout, prompt: "\nyou › " });
  rl.prompt();

  rl.on("line", async (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    try {
      if (text.startsWith("/")) {
        const keepGoing = await handleCommand(text);
        if (!keepGoing) {
          rl.close();
          return;
        }
      } else {
        await runTurn(text);
      }
    } catch (e) {
      stdout.write(`\n\x1b[31mError: ${(e as Error).message}\x1b[0m\n`);
    }
    rl.prompt();
  });

  rl.on("close", () => {
    stdout.write("\nGoodbye.\n");
    process.exit(0);
  });
}

void main();
