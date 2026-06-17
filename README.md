# Rydeshare — AI Project Manager for Commercial Plumbing TI (NorCal Union)

A local-first, Claude-powered **project manager "brain"** for commercial-plumbing
**tenant-improvement (TI)** work run by **union (UA) crews across Northern California**
(SF, East Bay, North Bay, Sacramento, San Jose).

You feed it a job. It builds the plan, tells you the single **next action**, and
**proactively asks for whatever it's missing** — scope, durations, wages, bid inputs —
keeping the whole job in one place: estimating (from **FastPipe**), bidding, scheduling,
submittals/RFIs, change orders, inspections, and a certified-payroll preview.

It's a terminal chat app (the "light UI"), powered by the Anthropic API
(`claude-opus-4-8`), with all state stored as plain JSON files. No web app, no database.

> ⚠️ **Compliance — read this.** All prevailing-wage / CBA figures shipped with this
> tool are **unverified placeholders** flagged `verify: true`. They **must** be confirmed
> against the current CA DIR determination (<https://www.dir.ca.gov/oprl>) and the
> applicable UA-local CBA before any bid, payroll, or contract use. This tool assists a
> qualified PM — it does not replace certified-payroll review, apprentice-ratio
> compliance, or licensed/code judgment.

## Quick start

```bash
cp .env.example .env        # then paste your ANTHROPIC_API_KEY into .env
npm install
npm run dev                 # start the chat REPL
```

In the REPL:

```
/new "Acme Tower 12th-floor TI" region=East Bay
/ingest samples/sample_fastpipe.xlsx
# ...then just talk to it: "public works yes, use 15% overhead and 10% profit, compute the bid"
/status                     # deterministic NEXT ACTION + OPEN QUESTIONS footer
/projects                  # list saved jobs
/exit
```

Free-form chat works too — the slash commands are just shortcuts. The PM brain decides
which tools to call.

## How it works

- **The brain** is a manual Claude agentic loop (`src/agent/loop.ts`): it streams replies,
  calls tools, persists state after every tool call, and asks you for missing info.
- **Tools** (`src/agent/tools.ts`) are the model's entire action surface — create/read/update
  projects, ingest FastPipe Excel or manual estimates, get/override wages, compute labor &
  bid, generate a schedule, log RFIs/submittals/COs/inspections, preview certified payroll,
  and the `list_next_actions` / `request_human_input` / `advance_stage` "what do I need" engine.
- **The math is deterministic code, not the model** (`src/engine/`): bid, labor, wages,
  schedule, gaps, payroll — so money is reproducible and unit-tested.
- **The gap engine** (`src/engine/gaps.ts`) reads each workflow stage's required-info
  checklist (`kb/workflow_stages.json`) and produces the single next action plus the
  blocking questions. Unanswered questions are persisted to the project so the brain never
  forgets what it's waiting on.
- **State** is a JSON file per project under `data/projects/` (atomic writes; gitignored).
- **Knowledge base** lives in `kb/`: NorCal UA locals + seed wage table, workflow stages +
  checklists, plumbing scope catalog with durations, FastPipe column-alias map, bid defaults.

```
src/
  index.ts            REPL + slash commands + deterministic gap footer
  agent/              loop.ts (agentic loop) · tools.ts · systemPrompt.ts
  prompt/domain.md    encoded PM domain knowledge (inlined into the system prompt)
  engine/             bid · labor · wages · schedule · gaps · payroll  (deterministic, tested)
  ingest/fastpipe.ts  SheetJS parser + column-alias mapping
  store/projects.ts   load/save/index JSON with atomic writes
  schema/project.ts   zod schema = storage + tool-contract source of truth
kb/                   ua_locals · workflow_stages · scope_catalog · fastpipe_columns · bid_defaults
samples/              sample_fastpipe.xlsx + walkthrough
```

## Wages & FastPipe

- **Wages:** seeded per local (38 SF/North Bay, 342 East Bay, 393 San Jose, 447 Sacramento),
  every rate flagged `verify: true`. Use `set_wage_override` (just tell the brain the confirmed
  CBA numbers) to replace a rate — that clears the verify flag and records who/when. Phase 2 adds
  automatic DIR prevailing-wage pull.
- **FastPipe:** `/ingest <file.xlsx>` parses a FastPipe/FastEST export (labor hours, material,
  fixtures, rentals, tax — by section/spec/zone/cost-code/tag). Columns it can't map are reported
  so you can confirm them or add aliases to `kb/fastpipe_columns.json`. Manual entry is also
  supported when there's no export.

## Scripts & tests

```bash
npm run demo        # guided, narrated walkthrough of a full job — no API key, throwaway data dir
npm test            # unit tests for the deterministic engine + ingest (no API calls)
npm run e2e         # full tool→engine→store loop end-to-end, deterministic (no API key needed)
npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
npx tsx scripts/make_sample.ts   # regenerate samples/sample_fastpipe.xlsx
```

## Roadmap

- **v1 (this):** the AI PM brain — ingest → plan → next action → ask for missing info →
  compute bid & labor; FastPipe import + manual entry; wage override; persistence.
- **Phase 2:** full schedule dependency/manpower engine; registers wired into contract value;
  **DIR prevailing-wage auto-pull**; certified payroll → DIR/eMars **XML export** + apprentice-ratio
  enforcement.
- **Phase 3:** optional web chat UI (same agent core) or Anthropic Managed Agents; Procore /
  MS Project / QuickBooks integrations; multi-project portfolio + proactive notifications.
