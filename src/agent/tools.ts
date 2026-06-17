import { randomUUID } from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { bidDefaults, scopeCatalog, stageById } from "../kb.js";
import { computeBid } from "../engine/bid.js";
import { computeGaps, STAGE_ORDER } from "../engine/gaps.js";
import { computeLabor } from "../engine/labor.js";
import { certifiedPayrollSummary } from "../engine/payroll.js";
import { computeSchedule } from "../engine/schedule.js";
import { findWageRow, loadedRate } from "../engine/wages.js";
import { parseFastpipeExcel, rollupLineItems } from "../ingest/fastpipe.js";
import { createProject } from "../factory.js";
import {
  ClassificationSchema,
  LineItemSchema,
  PhaseSchema,
  RegionSchema,
  type ActivityLogEntry,
  type Project,
  type ScopeItem,
} from "../schema/project.js";
import { listProjects, loadProject, saveProject } from "../store/projects.js";

// ----- helpers -----------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function activity(
  project: Project,
  action: string,
  summary: string,
): void {
  const entry: ActivityLogEntry = {
    ts: new Date().toISOString(),
    actor: "ai",
    action,
    summary,
  };
  project.activityLog.push(entry);
}

function withProject<T>(
  projectId: string,
  fn: (p: Project) => T,
): T | { error: string } {
  const project = loadProject(projectId);
  if (!project) return { error: `No project found with id ${projectId}.` };
  return fn(project);
}

function deepMerge(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(
        out[k] as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ----- tool definitions --------------------------------------------------

interface ToolDef<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  input: S;
  handler: (input: z.infer<S>) => unknown;
}

function def<S extends z.ZodTypeAny>(d: ToolDef<S>): ToolDef<z.ZodTypeAny> {
  return d as unknown as ToolDef<z.ZodTypeAny>;
}

const tools: ToolDef<z.ZodTypeAny>[] = [
  def({
    name: "create_project",
    description:
      "Create a new plumbing-TI project. Region sets the UA local + seeded wage table. Returns the project id and initial gap analysis.",
    input: z.object({
      name: z.string(),
      region: RegionSchema,
      owner: z.string().nullish(),
      gc: z.string().nullish(),
      contact: z.string().nullish(),
      jurisdiction: z.string().nullish(),
      scopeSummary: z.string().nullish(),
    }),
    handler: (i) => {
      const project = createProject({
        name: i.name,
        region: i.region,
        owner: i.owner ?? null,
        client: { gc: i.gc ?? null, contact: i.contact ?? null },
        jurisdiction: i.jurisdiction ?? null,
        scopeSummary: i.scopeSummary ?? null,
      });
      const saved = saveProject(project);
      return {
        projectId: saved.id,
        uaLocal: saved.uaLocal,
        gaps: computeGaps(saved),
      };
    },
  }),

  def({
    name: "list_projects",
    description: "List all saved projects (id, name, region, stage, open question count).",
    input: z.object({}),
    handler: () => ({ projects: listProjects() }),
  }),

  def({
    name: "get_project_state",
    description:
      "Read the full current state of a project. Call this at the start of working on a project so you reason over fresh data, never stale prose.",
    input: z.object({ projectId: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => ({ project: p })),
  }),

  def({
    name: "update_project",
    description:
      "Apply a partial patch to a project (deep-merged, then schema-validated). Use for facts like publicWorks, scopeSummary, client info, location.jurisdiction, labor.crew, bid.inputs, scopeItems. Do NOT hand-edit computed fields (labor.computed, bid.waterfall) — use the compute tools.",
    input: z.object({
      projectId: z.string(),
      patch: z.record(z.any()),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const { id, createdAt, ...rest } = i.patch as Record<string, unknown>;
        void id;
        void createdAt;
        const merged = deepMerge(p as unknown as Record<string, unknown>, rest);
        const next = merged as unknown as Project;
        activity(next, "update_project", `Patched: ${Object.keys(rest).join(", ")}`);
        const saved = saveProject(next);
        return { ok: true, gaps: computeGaps(saved) };
      }),
  }),

  def({
    name: "parse_fastpipe_excel",
    description:
      "Parse a FastPipe / FastEST Excel export into estimate line items and roll up totals. Returns any columns it could not map — confirm those with the human.",
    input: z.object({ projectId: z.string(), filePath: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        let parsed;
        try {
          parsed = parseFastpipeExcel(i.filePath);
        } catch (e) {
          return { error: (e as Error).message };
        }
        p.estimate.source = p.estimate.source === "manual" ? "mixed" : "fastpipe";
        p.estimate.importedFrom = i.filePath;
        p.estimate.lineItems = parsed.lineItems;
        p.estimate.rollups = parsed.rollups;
        p.estimate.unmappedColumns = parsed.unmappedColumns;
        activity(
          p,
          "parse_fastpipe_excel",
          `Imported ${parsed.lineItems.length} line items from ${i.filePath} (${parsed.rollups.laborHours} hrs, $${parsed.rollups.materialCost} material).`,
        );
        saveProject(p);
        return {
          lineItemCount: parsed.lineItems.length,
          rollups: parsed.rollups,
          unmappedColumns: parsed.unmappedColumns,
          note:
            parsed.unmappedColumns.length > 0
              ? "Some columns were not mapped — ask the user to confirm mapping or add aliases to kb/fastpipe_columns.json."
              : "All columns mapped.",
        };
      }),
  }),

  def({
    name: "record_manual_estimate",
    description:
      "Record estimate line items entered manually (when there is no FastPipe export). Replaces the current line items and re-rolls totals.",
    input: z.object({
      projectId: z.string(),
      lineItems: z.array(
        LineItemSchema.partial().extend({
          laborHours: z.number().optional(),
          materialCost: z.number().optional(),
        }),
      ),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const items = i.lineItems.map((li) =>
          LineItemSchema.parse({ id: li.id ?? `li_${randomUUID()}`, ...li }),
        );
        p.estimate.source = p.estimate.source === "fastpipe" ? "mixed" : "manual";
        p.estimate.lineItems = items;
        p.estimate.rollups = rollupLineItems(items);
        activity(p, "record_manual_estimate", `Recorded ${items.length} manual line items.`);
        saveProject(p);
        return { lineItemCount: items.length, rollups: p.estimate.rollups };
      }),
  }),

  def({
    name: "get_estimate_summary",
    description: "Return estimate rollups plus by-zone and by-cost-code breakdowns.",
    input: z.object({ projectId: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const byZone: Record<string, number> = {};
        const byCostCode: Record<string, number> = {};
        for (const li of p.estimate.lineItems) {
          const z1 = li.zone ?? "(unassigned)";
          const c1 = li.costCode ?? "(none)";
          byZone[z1] = round2((byZone[z1] ?? 0) + li.laborHours);
          byCostCode[c1] = round2((byCostCode[c1] ?? 0) + li.materialCost);
        }
        return {
          source: p.estimate.source,
          rollups: p.estimate.rollups,
          laborHoursByZone: byZone,
          materialByCostCode: byCostCode,
          unmappedColumns: p.estimate.unmappedColumns,
        };
      }),
  }),

  def({
    name: "get_wage_rates",
    description:
      "Get the project's wage rows, optionally filtered by classification/local. Each row has verify=true if it is an unverified placeholder.",
    input: z.object({
      projectId: z.string(),
      classification: ClassificationSchema.nullish(),
      local: z.string().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        let rows = p.wageAssumptions.rows;
        if (i.local) rows = rows.filter((r) => r.local === i.local);
        if (i.classification)
          rows = rows.filter((r) => r.classification === i.classification);
        return {
          rows,
          anyUnverified: rows.some((r) => r.verify),
        };
      }),
  }),

  def({
    name: "set_wage_override",
    description:
      "Manually override a wage row (base hourly and/or fringes) for a classification. Clears the verify flag and records who/when. Use when the user gives you confirmed CBA / prevailing-wage numbers.",
    input: z.object({
      projectId: z.string(),
      classification: ClassificationSchema,
      local: z.string().nullish(),
      baseHourly: z.number().nullish(),
      fringes: z
        .object({
          hw: z.number().optional(),
          pension: z.number().optional(),
          vacation: z.number().optional(),
          training: z.number().optional(),
          other: z.number().optional(),
        })
        .nullish(),
      note: z.string().nullish(),
      overriddenBy: z.string().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const local = i.local ?? p.uaLocal;
        const row = findWageRow(p.wageAssumptions.rows, i.classification, local);
        if (!row)
          return {
            error: `No wage row for ${i.classification} (local ${local}).`,
          };
        if (typeof i.baseHourly === "number") row.baseHourly = i.baseHourly;
        if (i.fringes) row.fringes = { ...row.fringes, ...i.fringes };
        row.loaded = loadedRate(row);
        row.verify = false;
        row.overriddenBy = i.overriddenBy ?? p.owner ?? "user";
        row.overriddenAt = new Date().toISOString();
        row.note = i.note ?? row.note;
        activity(
          p,
          "set_wage_override",
          `Override ${i.classification} (local ${local}) → base $${row.baseHourly}, loaded $${row.loaded}.`,
        );
        saveProject(p);
        return { row };
      }),
  }),

  def({
    name: "compute_labor_cost",
    description:
      "Compute total labor cost = estimate hours × blended loaded crew rate. Uses the crew mix in labor.crew (falls back to journeyman if no crew set). Persists labor.computed.",
    input: z.object({ projectId: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const result = computeLabor(
          p.wageAssumptions.rows,
          p.labor.crew,
          p.estimate,
        );
        p.labor.computed = result.computed;
        activity(
          p,
          "compute_labor_cost",
          `Labor = ${result.computed.totalHours} hrs × $${result.blendedLoadedRate}/hr = $${result.computed.totalLaborCost}.`,
        );
        saveProject(p);
        return {
          totalLaborCost: result.computed.totalLaborCost,
          totalHours: result.computed.totalHours,
          blendedLoadedRate: result.blendedLoadedRate,
          breakdown: result.breakdown,
          usedVerifyRows: result.computed.usedVerifyRows,
          byZone: result.computed.byZone,
        };
      }),
  }),

  def({
    name: "compute_bid",
    description:
      "Compute the bid waterfall (labor + material + tax + rentals → burden/contingency/overhead/profit → total). Missing percentages fall back to kb/bid_defaults.json and are flagged. Persists bid.",
    input: z.object({
      projectId: z.string(),
      laborBurdenPct: z.number().nullish(),
      overheadPct: z.number().nullish(),
      profitPct: z.number().nullish(),
      contingencyPct: z.number().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const defaulted: string[] = [];
        const pick = (
          arg: number | null | undefined,
          existing: number,
          fallback: number,
          label: string,
        ): number => {
          if (typeof arg === "number") return arg;
          if (existing > 0) return existing;
          if (fallback > 0) {
            defaulted.push(`${label} (${fallback}%)`);
            return fallback;
          }
          return 0;
        };
        const inputs = {
          laborBurdenPct: pick(i.laborBurdenPct, p.bid.inputs.laborBurdenPct, bidDefaults.laborBurdenPct, "laborBurdenPct"),
          overheadPct: pick(i.overheadPct, p.bid.inputs.overheadPct, bidDefaults.overheadPct, "overheadPct"),
          profitPct: pick(i.profitPct, p.bid.inputs.profitPct, bidDefaults.profitPct, "profitPct"),
          contingencyPct: pick(i.contingencyPct, p.bid.inputs.contingencyPct, bidDefaults.contingencyPct, "contingencyPct"),
        };
        const bid = computeBid(p.estimate, p.labor.computed, inputs, {
          defaultedFields: defaulted,
        });
        p.bid = bid;
        activity(p, "compute_bid", `Bid total $${bid.waterfall.total} (overhead ${inputs.overheadPct}%, profit ${inputs.profitPct}%).`);
        saveProject(p);
        return bid;
      }),
  }),

  def({
    name: "generate_schedule",
    description:
      "Generate an install schedule (rough-in → top-out → trim sequence) from the project's scope items, or from the standard scope catalog if none are set. Persists schedule.",
    input: z.object({
      projectId: z.string(),
      startDate: z.string(),
      durationsOverride: z.record(z.number()).nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        let scope: ScopeItem[] = p.scopeItems;
        if (scope.length === 0) {
          scope = scopeCatalog.items.map((it) => ({
            id: `scope_${randomUUID()}`,
            system: it.system,
            zone: null,
            phase: PhaseSchema.parse(it.phase),
            status: "not_started" as const,
            typicalDurationDays: it.typicalDurationDays,
          }));
        }
        const crewSize = p.labor.crew.reduce((s, c) => s + c.count, 0);
        const tasks = computeSchedule(scope, i.startDate, {
          crewSize,
          durationsOverride: i.durationsOverride ?? undefined,
        });
        p.schedule.startDate = i.startDate;
        p.schedule.tasks = tasks;
        activity(p, "generate_schedule", `Generated ${tasks.length} tasks from ${i.startDate}.`);
        saveProject(p);
        return {
          startDate: i.startDate,
          taskCount: tasks.length,
          finish: tasks.at(-1)?.finish ?? i.startDate,
          tasks,
        };
      }),
  }),

  def({
    name: "log_rfi",
    description: "Log an RFI on the project.",
    input: z.object({
      projectId: z.string(),
      subject: z.string(),
      question: z.string(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const rfi = {
          id: `rfi_${randomUUID()}`,
          subject: i.subject,
          question: i.question,
          status: "open" as const,
          dateOpened: new Date().toISOString(),
          answer: null,
        };
        p.rfis.push(rfi);
        activity(p, "log_rfi", `RFI: ${i.subject}`);
        saveProject(p);
        return { rfi };
      }),
  }),

  def({
    name: "log_submittal",
    description: "Log a submittal on the project.",
    input: z.object({
      projectId: z.string(),
      spec: z.string(),
      description: z.string().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const sub = {
          id: `sub_${randomUUID()}`,
          spec: i.spec,
          description: i.description ?? null,
          status: "pending" as const,
          date: new Date().toISOString(),
        };
        p.submittals.push(sub);
        activity(p, "log_submittal", `Submittal: ${i.spec}`);
        saveProject(p);
        return { submittal: sub };
      }),
  }),

  def({
    name: "log_change_order",
    description: "Log a change order (costDelta feeds contract value).",
    input: z.object({
      projectId: z.string(),
      description: z.string(),
      costDelta: z.number(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const co = {
          id: `co_${randomUUID()}`,
          description: i.description,
          costDelta: i.costDelta,
          status: "pending" as const,
          date: new Date().toISOString(),
        };
        p.changeOrders.push(co);
        activity(p, "log_change_order", `CO: ${i.description} ($${i.costDelta})`);
        saveProject(p);
        return { changeOrder: co };
      }),
  }),

  def({
    name: "log_inspection",
    description: "Log an inspection (underground|rough_in|top_out|gas|backflow|final) and its result.",
    input: z.object({
      projectId: z.string(),
      type: z.enum(["underground", "rough_in", "top_out", "gas", "backflow", "final"]),
      result: z.enum(["scheduled", "pass", "fail"]).default("scheduled"),
      date: z.string().nullish(),
      note: z.string().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const insp = {
          id: `insp_${randomUUID()}`,
          type: i.type,
          result: i.result,
          date: i.date ?? null,
          note: i.note ?? null,
        };
        p.inspections.push(insp);
        activity(p, "log_inspection", `Inspection ${i.type}: ${i.result}`);
        saveProject(p);
        return { inspection: insp };
      }),
  }),

  def({
    name: "record_procurement",
    description: "Record a procurement / material item and its status.",
    input: z.object({
      projectId: z.string(),
      item: z.string(),
      vendor: z.string().nullish(),
      status: z.enum(["needed", "quoted", "ordered", "delivered"]).default("needed"),
      needBy: z.string().nullish(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const proc = {
          id: `proc_${randomUUID()}`,
          item: i.item,
          vendor: i.vendor ?? null,
          status: i.status,
          needBy: i.needBy ?? null,
        };
        p.procurement.push(proc);
        activity(p, "record_procurement", `Procurement: ${i.item} (${i.status})`);
        saveProject(p);
        return { procurement: proc };
      }),
  }),

  def({
    name: "certified_payroll_summary",
    description:
      "Produce a certified-payroll PREVIEW for a given week (gross at prevailing/base rate + apprentice-ratio check). Not a DIR-compliant CPR — XML export is a later phase.",
    input: z.object({ projectId: z.string(), weekEnding: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => certifiedPayrollSummary(p, i.weekEnding)),
  }),

  def({
    name: "list_next_actions",
    description:
      "Run the gap engine: returns the current stage, the single next action, blocking questions you must ask the human, and per-stage status. Call this whenever you need to decide what to do or what to ask.",
    input: z.object({ projectId: z.string() }),
    handler: (i) => withProject(i.projectId, (p) => computeGaps(p)),
  }),

  def({
    name: "request_human_input",
    description:
      "Record questions you need the human to answer. Persists them to openQuestions so they are remembered across sessions. De-duplicates by text.",
    input: z.object({
      projectId: z.string(),
      stage: z.string(),
      questions: z.array(
        z.object({ question: z.string(), blocking: z.boolean().default(true) }),
      ),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const openTexts = new Set(
          p.openQuestions.filter((q) => !q.answeredAt).map((q) => q.question),
        );
        const added: string[] = [];
        for (const q of i.questions) {
          if (openTexts.has(q.question)) continue;
          p.openQuestions.push({
            id: `q_${randomUUID()}`,
            stage: i.stage,
            question: q.question,
            blocking: q.blocking,
            askedAt: new Date().toISOString(),
            answeredAt: null,
            answer: null,
          });
          added.push(q.question);
        }
        if (added.length) {
          activity(p, "request_human_input", `Asked ${added.length} question(s).`);
          saveProject(p);
        }
        return {
          openQuestions: p.openQuestions.filter((q) => !q.answeredAt),
        };
      }),
  }),

  def({
    name: "resolve_question",
    description:
      "Mark a persisted open question answered once the human has answered it. Also call update_project to store the actual value.",
    input: z.object({
      projectId: z.string(),
      questionId: z.string(),
      answer: z.string(),
    }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const q = p.openQuestions.find((x) => x.id === i.questionId);
        if (!q) return { error: `No open question ${i.questionId}.` };
        q.answeredAt = new Date().toISOString();
        q.answer = i.answer;
        activity(p, "resolve_question", `Answered: ${q.question}`);
        saveProject(p);
        return { ok: true, remaining: p.openQuestions.filter((x) => !x.answeredAt).length };
      }),
  }),

  def({
    name: "advance_stage",
    description:
      "Advance the project to the next workflow stage. Refuses (returns the blocking gaps) if required info for the current stage is missing.",
    input: z.object({ projectId: z.string() }),
    handler: (i) =>
      withProject(i.projectId, (p) => {
        const gaps = computeGaps(p);
        if (!gaps.canAdvance) {
          return {
            advanced: false,
            reason: "Blocking information is missing for the current stage.",
            blockingQuestions: gaps.blockingQuestions,
          };
        }
        const idx = STAGE_ORDER.indexOf(p.workflowStatus.currentStage);
        if (idx >= STAGE_ORDER.length - 1) {
          return { advanced: false, reason: "Already at the final stage." };
        }
        const nextStage = STAGE_ORDER[idx + 1]!;
        p.workflowStatus.stages[p.workflowStatus.currentStage] = {
          status: "complete",
          completedAt: new Date().toISOString(),
          blockingCount: 0,
        };
        p.workflowStatus.currentStage = nextStage;
        p.workflowStatus.stages[nextStage] = {
          status: "in_progress",
          completedAt: null,
          blockingCount: 0,
        };
        activity(p, "advance_stage", `Advanced to ${stageById(nextStage)?.label ?? nextStage}.`);
        saveProject(p);
        return { advanced: true, currentStage: nextStage, gaps: computeGaps(p) };
      }),
  }),
];

// ----- exports -----------------------------------------------------------

function toInputSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<
    string,
    unknown
  >;
  delete json["$schema"];
  return json;
}

export const anthropicTools = tools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: toInputSchema(t.input) as {
    type: "object";
    properties?: Record<string, unknown>;
  },
}));

const byName = new Map(tools.map((t) => [t.name, t]));

export function executeTool(name: string, rawInput: unknown): unknown {
  const tool = byName.get(name);
  if (!tool) return { error: `Unknown tool: ${name}` };
  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { error: "Invalid tool input", detail: parsed.error.flatten() };
  }
  try {
    return tool.handler(parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export const toolNames = tools.map((t) => t.name);
