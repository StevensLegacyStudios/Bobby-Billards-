# Rydeshare — Operator's Manual

A plain-English guide to running the AI Project Manager for commercial-plumbing
tenant-improvement (TI) work. This is the *how do I actually use it* doc. For the
architecture and code map, see [`README.md`](./README.md).

---

## 1. What this thing is (in one breath)

It's a **terminal chat app** that acts as your project manager's brain. You tell it
about a plumbing TI job; it builds the plan, tracks every stage, tells you the single
**next action**, and **asks you for whatever it's missing**. The money math (labor,
wages, bid) is done by deterministic, unit-tested code — not guessed by the AI — so the
numbers are reproducible.

Everything is stored as plain JSON files on your machine. No web app, no database, no
cloud account beyond your Anthropic API key.

> ⚠️ **Compliance first.** Every wage rate shipped with the tool is an **unverified
> placeholder**. Confirm against the current CA DIR determination
> (<https://www.dir.ca.gov/oprl>) and the applicable UA-local CBA before any bid,
> payroll, or contract use. The tool assists a qualified PM — it does not replace
> certified-payroll review, apprentice-ratio compliance, or licensed/code judgment.

---

## 2. One-time setup

You need **Node.js 22 or newer** and an **Anthropic API key**.

```bash
cp .env.example .env        # then open .env and paste your ANTHROPIC_API_KEY
npm install
```

Get an API key at <https://console.anthropic.com> → *API Keys*. The key lives only in
your local `.env` file, which is gitignored and never committed.

Check it works without spending anything on the API:

```bash
npm run e2e        # runs the whole job loop deterministically, no key needed
npm test           # unit tests for the money math
```

---

## 2b. See it work in 60 seconds (no API key)

Before you wire up a key, watch the whole job play out:

```bash
npm run demo            # press Enter to step through each stage
npm run demo -- --auto  # hands-off — plays straight through
```

It drives the **real** engine through a full Acme Tower job — create → ingest → answer
questions → compute labor → bid → confirm a CBA wage → advance — narrating what's
happening and why at each step. It needs no API key and writes to a throwaway temp
directory, so your real jobs under `data/` are never touched. This is the fastest way to
understand the loop before you run it for real.

---

## 3. Starting it up

```bash
npm run dev        # development mode (runs the TypeScript directly)
```

You'll see the banner and a `you ›` prompt. If your API key isn't set, it warns you and
the chat won't be able to reply (but commands still parse).

To quit: type `/exit` (or `Ctrl-C`).

---

## 4. The two ways to talk to it

**1. Slash commands** — shortcuts for the common moves:

| Command | What it does |
| --- | --- |
| `/new "<name>" region=<region>` | Create a job. Region is one of `SF`, `East Bay`, `North Bay`, `Sacramento`, `San Jose`. It resolves the UA local and seeds placeholder wages. |
| `/open <projectId>` | Reopen a saved job and get its next action. |
| `/ingest <path-to-xlsx>` | Import a FastPipe export into the active job. |
| `/status` or `/next` | Show the deterministic **NEXT ACTION + OPEN QUESTIONS** for the active job. |
| `/briefing` | The "what's on my plate" snapshot: next action, tasks, emails, RFIs, inspections. |
| `/tasks` | List the job's to-dos (overdue first). |
| `/email` | List logged emails (drafts + awaiting reply). |
| `/closeout` | Closeout-doc progress per material (requested / staged / filed). |
| `/projects` | List every saved job with its stage and open-question count. |
| `/help` | Reprint the banner. |
| `/exit` | Quit. |

**2. Just talk to it** — free-form English. The commands are only shortcuts; the brain
decides which tools to call. Examples that work verbatim:

- *"Public works yes. Crew is 1 foreman, 3 journeymen, 1 step-3 apprentice. Use 15% overhead and 10% profit, compute the bid."*
- *"Confirmed journeyman base is $95/hr per the Local 342 CBA. Re-run the bid."*
- *"Log an RFI: routing conflict over grid line C, waiting on the architect."*
- *"What do you need from me to move to the bid stage?"*

After every turn the tool prints a footer like:

```
[Acme Tower 12th-floor TI · Bid / Proposal]
NEXT ACTION: ...
OPEN QUESTIONS:
  • ...
```

That footer is computed by code, not the model — it's your source of truth for "what's
next."

---

## 4b. Tasks, email & the daily briefing

The tool doesn't stop at bidding — it runs the job day-to-day.

**Tasks (your action list).** Real to-dos with an **owner, due date, priority, and
status** — separate from the install schedule. Just tell the brain *"add a task: confirm
the foreman CBA rate, high priority, due Friday"* or *"mark the grid-line-C walk done."*
Overdue items always surface first, and they show up in the footer and `/briefing`.

**Email — draft and track, never auto-send.** Ask for *"draft the proposal email to the
GC"* (or an RFI / submittal / change-order / schedule / procurement email) and it
**composes a professional message from the job's own data** and logs it as a draft. You
review it, send it from your real email by copy/paste, and tell the tool *"mark it
sent."* From then on it's tracked as **awaiting reply** until you log the response. This
is deliberate: the tool stays local and never reaches outside your machine.

**Daily briefing.** `/briefing` (or *"what's on my plate?"*) rolls up the entire job in
one view — stage + next action, open/overdue tasks, emails awaiting reply, open
RFIs/submittals, and upcoming inspections.

**Closeout documentation — gathered during the job, not at the end.** The moment you
assemble a submittal and ask the vendor for submittal info, ask for the closeout docs too:
*"request closeout docs from Cal Steam for the Kohler water closet."* The tool
(`request_closeout_docs`) tracks the required set — **As-builts** (from Engineering),
**O&Ms** (vendor; fixtures/equipment only — not valves/piping), **Warranty Letter** (UMI
template), plus cut sheets / install / ADA — and drafts the combined vendor email. As docs
arrive they're staged under `PM Docs/All Closeout Docs/<material>`; once the **GC returns
the submittal approved**, *"file the closeout docs"* moves them into the job's closeout
folder. `/closeout` shows progress per material.

Everything else the tool tracks — RFIs, submittals, change orders, inspections,
procurement, the install schedule, a certified-payroll preview, and closeout — works the
same way: just describe what happened and the brain records it. The `npm run demo`
walkthrough exercises all of it end to end.

## 5. The job lifecycle (stages)

A job moves through these stages. The tool will not let you skip ahead while required
info is still missing — answer the open questions and it advances.

1. **Lease / Scope Review** — confirm the basics (public works? scope?).
2. **Estimate & Takeoff (FastPipe)** — ingest the estimate.
3. **Bid / Proposal** — compute labor + bid waterfall.
4. **Contract / Buyout**
5. **Submittals & RFIs**
6. **Schedule & Manpower**
7. **Procurement**
8. **Install & Inspections**
9. **Certified Payroll**
10. **Change Orders**
11. **Closeout**

---

## 6. A full run, start to finish

```text
$ npm run dev

/new "Acme Tower 12th-floor TI" region=East Bay
  → Creates the job, resolves UA Local 342, seeds placeholder wages.
  NEXT ACTION: Lease / Scope Review — confirm the basics.
  OPEN QUESTIONS:
    • Is this a public works job (> $1,000 of public funds)?

/ingest samples/sample_fastpipe.xlsx
  → Parses the FastPipe export: 5 line items, 338.5 labor hours, $21,420 material.
  → Reports "Notes" as an unmapped column — confirm it or add an alias.

you › Public works yes. Crew is 1 foreman, 3 journeymen, 1 step-3 apprentice.
      Use 15% overhead and 10% profit. Compute the bid.
  → updates the job, computes labor, prints the bid waterfall with every input echoed.
  → flags: "Labor uses UNVERIFIED placeholder wage rates — confirm before quoting."

you › Confirmed journeyman base is $95/hr per the Local 342 CBA. Re-run the bid.
  → overrides the wage (verify flag cleared, who/when recorded), recomputes.
  → New total; the journeyman row is no longer flagged.

/status
  → Deterministic NEXT ACTION + OPEN QUESTIONS for the active job.

/exit
```

Want to see this exact loop run end-to-end without typing or an API key?
`npm run e2e`.

---

## 7. Wages — the part that matters most

- Wages are **seeded per UA local** (38 SF/North Bay, 342 East Bay, 393 San Jose,
  447 Sacramento) and **every rate is flagged `verify: true`** — meaning *do not trust
  this number yet.*
- To replace a rate with a confirmed one, just tell the brain:
  *"Confirmed journeyman base is $95/hr per the Local 342 CBA."* That clears the verify
  flag and records who/when.
- Any bid computed while unverified rates are still in play is **stamped with an
  UNVERIFIED warning** in its assumption flags. That stamp is your reminder not to send
  the number to a customer yet.

---

## 8. FastPipe import

- `/ingest <file.xlsx>` parses a FastPipe / FastEST export — labor hours, material,
  fixtures, rentals, tax, broken down by section/spec/zone/cost-code/tag.
- Columns it can't recognize are **reported back to you** rather than silently dropped.
  Confirm them, or add an alias to `kb/fastpipe_columns.json`.
- No export? You can enter an estimate manually by just describing it to the brain.
- The bundled `samples/sample_fastpipe.xlsx` deliberately has junk title rows and an
  extra **Notes** column so you can watch header-detection and unmapped-column reporting
  work. Regenerate it with `npx tsx scripts/make_sample.ts`.

---

## 9. What it can track (the full tool surface)

Projects (create / list / read / update), FastPipe + manual estimates, wage rates and
overrides, labor cost, bid waterfall, schedule generation, RFIs, submittals, change
orders, inspections, procurement, a certified-payroll preview, and the
"what-do-I-need-next" engine (next actions, open questions, stage advancement).

You never call these by name — you just talk, and the brain picks the right one.

---

## 10. Where your data lives

- One JSON file per job under `data/projects/` (atomic writes; gitignored).
- Knowledge base (locals, wage seeds, workflow stages + checklists, scope catalog with
  durations, FastPipe column aliases, bid defaults) lives in `kb/`.
- To back up or move a job to another machine, copy its JSON file. To wipe a job, delete
  the file.

---

## 11. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `WARNING: ANTHROPIC_API_KEY is not set` | Copy `.env.example` to `.env` and paste your key. |
| Chat doesn't reply / auth error | The key in `.env` is missing or wrong. Regenerate at console.anthropic.com. |
| `Unknown region "..."` | Use exactly one of: `SF`, `East Bay`, `North Bay`, `Sacramento`, `San Jose`. |
| Won't advance a stage | There are still OPEN QUESTIONS — run `/status` and answer them. |
| A bid still says UNVERIFIED | At least one wage rate is still a placeholder. Confirm the CBA numbers. |
| Node version error | You need Node 22+. Check with `node --version`. |

---

## 12. Quick command reference

```bash
npm run dev         # start the chat app
npm run demo        # guided, narrated walkthrough (no API key); add -- --auto for hands-off
npm run e2e         # run the full job loop deterministically (no API key)
npm test            # unit tests for the money math
npm run typecheck   # type-check only
npm run build       # compile to dist/
npm start           # run the compiled build
```

In the app: `/new`, `/open`, `/ingest`, `/status` (`/next`), `/briefing`, `/tasks`,
`/email`, `/closeout`, `/projects`, `/help`, `/exit`.
