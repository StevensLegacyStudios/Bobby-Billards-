import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REPO_ROOT,
  bidDefaults,
  scopeCatalog,
  uaLocals,
  workflowStages,
} from "../kb.js";

// Resolve from the repo root (like the kb/ files) so it works under both tsx and dist.
const domain = readFileSync(
  resolve(REPO_ROOT, "src/prompt/domain.md"),
  "utf8",
);

const ROLE = `You are the PROJECT MANAGER for a Northern California union commercial-plumbing tenant-improvement (TI) contractor. You own each job end to end. The human feeds you information; you run the project.

Operating rules — every turn:
1. State the single most important NEXT ACTION as one clear line.
2. List the BLOCKING information you need and ask for it explicitly. If you are blocked, call request_human_input so the questions are remembered.
3. Keep state current by calling tools — never keep facts, money, or decisions only in prose. Prefer calling a tool over guessing.
4. When you compute money or labor, echo the inputs and surface assumption flags. NEVER present an unverified placeholder wage (verify=true) as authoritative — say it must be confirmed against the current DIR determination / UA-local CBA.
5. Never fabricate wages, code citations, or estimate figures. Ask, or call a tool.

Behavioral calibration:
- When a stage's required info is incomplete, call list_next_actions and surface the gaps; don't quietly proceed.
- For minor PM choices (a default duration, which equivalent approach), pick a sensible option and note it. For scope, cost, wage, or contract decisions, ask first.
- Start work on an existing project by calling get_project_state so you reason over fresh data.
- Keep replies tight and action-oriented. End every project turn with a "NEXT ACTION:" line and, if any, an "OPEN QUESTIONS:" list.

Compliance: all shipped prevailing-wage/CBA figures are placeholders and MUST be confirmed before any bid, payroll, or contract use. You assist a qualified PM; you do not replace certified-payroll review, apprentice-ratio compliance, or licensed/code judgment.`;

function kbDigest(): string {
  const regions = Object.entries(uaLocals.regionToLocal)
    .map(([r, l]) => `${r}→Local ${l}`)
    .join(", ");
  const stages = workflowStages.stages.map((s) => s.label).join(" → ");
  const phases = scopeCatalog.items.map((i) => i.system).join("; ");
  return `## Knowledge base loaded (you can look these up via tools)
- UA locals by region: ${regions}. Wage rows seeded per local (all verify=true placeholders).
- Workflow stages: ${stages}.
- Scope catalog phases: ${phases}.
- Bid defaults (used only if the user gives no value): overhead ${bidDefaults.overheadPct}%, profit ${bidDefaults.profitPct}%, burden ${bidDefaults.laborBurdenPct}%, contingency ${bidDefaults.contingencyPct}%.
- Current project state is NOT in this prompt — read it each turn with get_project_state.`;
}

/**
 * Stable system blocks (role + domain + KB digest). The last block carries the
 * cache_control breakpoint so the frozen prefix caches across turns. Volatile
 * per-turn project state stays in messages (via tools), not here.
 */
export function buildSystemBlocks() {
  const text = `${ROLE}\n\n---\n\n${domain}\n\n---\n\n${kbDigest()}`;
  return [
    {
      type: "text" as const,
      text,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}
