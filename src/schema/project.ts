import { z } from "zod";

/**
 * Single source of truth for both persisted Project state and the data shapes
 * the agent's tools read/write. Storage and tool contracts derive from here so
 * they can never drift apart.
 */

export const REGIONS = [
  "SF",
  "East Bay",
  "North Bay",
  "Sacramento",
  "San Jose",
] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

/** UA-local wage classifications. Apprentices are steps 1..10. */
export const CLASSIFICATIONS = [
  "general_foreman",
  "foreman",
  "journeyman",
  "apprentice_step_1",
  "apprentice_step_2",
  "apprentice_step_3",
  "apprentice_step_4",
  "apprentice_step_5",
  "apprentice_step_6",
  "apprentice_step_7",
  "apprentice_step_8",
  "apprentice_step_9",
  "apprentice_step_10",
] as const;
export const ClassificationSchema = z.enum(CLASSIFICATIONS);
export type Classification = z.infer<typeof ClassificationSchema>;

export const PHASES = [
  "underground_rough_in",
  "above_ground_dwv",
  "water_rough_in",
  "top_out",
  "trim_finish",
  "gas",
  "storm_sanitary",
  "medical_gas",
  "backflow",
  "water_heaters",
  "fixtures",
] as const;
export const PhaseSchema = z.enum(PHASES);
export type Phase = z.infer<typeof PhaseSchema>;

export const FringesSchema = z.object({
  hw: z.number().default(0), // health & welfare
  pension: z.number().default(0),
  vacation: z.number().default(0),
  training: z.number().default(0),
  other: z.number().default(0),
});
export type Fringes = z.infer<typeof FringesSchema>;

export const WageRowSchema = z.object({
  local: z.string(),
  classification: ClassificationSchema,
  baseHourly: z.number().default(0),
  fringes: FringesSchema.default({}),
  /** base + Σ fringes; recomputed by the wages engine */
  loaded: z.number().default(0),
  source: z.string().default("seed"),
  effectiveDate: z.string().nullable().default(null),
  /** true => placeholder/last-known, MUST be confirmed before bid/payroll use */
  verify: z.boolean().default(true),
  overriddenBy: z.string().nullable().default(null),
  overriddenAt: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});
export type WageRow = z.infer<typeof WageRowSchema>;

export const LineItemSchema = z.object({
  id: z.string(),
  section: z.string().nullable().default(null),
  spec: z.string().nullable().default(null),
  zone: z.string().nullable().default(null),
  costCode: z.string().nullable().default(null),
  tag: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  laborHours: z.number().default(0),
  laborRate: z.number().default(0),
  materialCost: z.number().default(0),
  fixtures: z.number().default(0),
  rentals: z.number().default(0),
  tax: z.number().default(0),
});
export type LineItem = z.infer<typeof LineItemSchema>;

export const EstimateRollupsSchema = z.object({
  laborHours: z.number().default(0),
  materialCost: z.number().default(0),
  rentals: z.number().default(0),
  tax: z.number().default(0),
  fixtures: z.number().default(0),
});
export type EstimateRollups = z.infer<typeof EstimateRollupsSchema>;

export const EstimateSchema = z.object({
  source: z.enum(["none", "fastpipe", "manual", "mixed"]).default("none"),
  importedFrom: z.string().nullable().default(null),
  lineItems: z.array(LineItemSchema).default([]),
  rollups: EstimateRollupsSchema.default({}),
  /** columns the FastPipe parser could not map — surfaced so the model asks the human */
  unmappedColumns: z.array(z.string()).default([]),
});
export type Estimate = z.infer<typeof EstimateSchema>;

export const ScopeItemSchema = z.object({
  id: z.string(),
  system: z.string(),
  zone: z.string().nullable().default(null),
  phase: PhaseSchema,
  status: z
    .enum(["not_started", "in_progress", "complete"])
    .default("not_started"),
  typicalDurationDays: z.number().default(0),
});
export type ScopeItem = z.infer<typeof ScopeItemSchema>;

export const CrewMemberSchema = z.object({
  classification: ClassificationSchema,
  count: z.number().int().nonnegative().default(0),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;

export const LaborSchema = z.object({
  crew: z.array(CrewMemberSchema).default([]),
  computed: z
    .object({
      totalLaborCost: z.number().default(0),
      totalHours: z.number().default(0),
      byZone: z.record(z.string(), z.number()).default({}),
      usedVerifyRows: z.boolean().default(false),
      computedAt: z.string().nullable().default(null),
    })
    .default({}),
});
export type Labor = z.infer<typeof LaborSchema>;

export const BidSchema = z.object({
  inputs: z
    .object({
      laborBurdenPct: z.number().default(0),
      overheadPct: z.number().default(0),
      profitPct: z.number().default(0),
      contingencyPct: z.number().default(0),
    })
    .default({}),
  waterfall: z
    .object({
      labor: z.number().default(0),
      laborWithBurden: z.number().default(0),
      material: z.number().default(0),
      tax: z.number().default(0),
      rentals: z.number().default(0),
      equipment: z.number().default(0),
      subtotal: z.number().default(0),
      contingency: z.number().default(0),
      overhead: z.number().default(0),
      profit: z.number().default(0),
      total: z.number().default(0),
    })
    .default({}),
  assumptionFlags: z.array(z.string()).default([]),
  computedAt: z.string().nullable().default(null),
});
export type Bid = z.infer<typeof BidSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  phase: PhaseSchema.nullable().default(null),
  dependsOn: z.array(z.string()).default([]),
  durationDays: z.number().default(0),
  crewSize: z.number().default(0),
  start: z.string().nullable().default(null),
  finish: z.string().nullable().default(null),
  status: z
    .enum(["not_started", "in_progress", "complete"])
    .default("not_started"),
});
export type Task = z.infer<typeof TaskSchema>;

export const ScheduleSchema = z.object({
  startDate: z.string().nullable().default(null),
  tasks: z.array(TaskSchema).default([]),
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const RfiSchema = z.object({
  id: z.string(),
  subject: z.string(),
  question: z.string(),
  status: z.enum(["open", "answered", "closed"]).default("open"),
  dateOpened: z.string(),
  answer: z.string().nullable().default(null),
});
export type Rfi = z.infer<typeof RfiSchema>;

export const SubmittalSchema = z.object({
  id: z.string(),
  spec: z.string(),
  description: z.string().nullable().default(null),
  status: z
    .enum(["pending", "submitted", "approved", "revise_resubmit", "rejected"])
    .default("pending"),
  date: z.string(),
});
export type Submittal = z.infer<typeof SubmittalSchema>;

export const ChangeOrderSchema = z.object({
  id: z.string(),
  description: z.string(),
  costDelta: z.number().default(0),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  date: z.string(),
});
export type ChangeOrder = z.infer<typeof ChangeOrderSchema>;

export const InspectionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "underground",
    "rough_in",
    "top_out",
    "gas",
    "backflow",
    "final",
  ]),
  result: z.enum(["scheduled", "pass", "fail"]).default("scheduled"),
  date: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});
export type Inspection = z.infer<typeof InspectionSchema>;

export const ProcurementSchema = z.object({
  id: z.string(),
  item: z.string(),
  vendor: z.string().nullable().default(null),
  status: z
    .enum(["needed", "quoted", "ordered", "delivered"])
    .default("needed"),
  needBy: z.string().nullable().default(null),
});
export type Procurement = z.infer<typeof ProcurementSchema>;

export const PayrollWeekSchema = z.object({
  weekEnding: z.string(),
  entries: z.array(
    z.object({
      worker: z.string(),
      classification: ClassificationSchema,
      hours: z.number().default(0),
      grossComputed: z.number().default(0),
    }),
  ),
  ratioCheck: z
    .object({
      ok: z.boolean().default(true),
      detail: z.string().nullable().default(null),
    })
    .default({}),
});
export type PayrollWeek = z.infer<typeof PayrollWeekSchema>;

/**
 * A tracked to-do on the job — distinct from the schedule's install Tasks. Has an
 * owner, due date, priority and status so the PM can run a real action list.
 */
export const TaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().nullable().default(null),
  assignee: z.string().nullable().default(null),
  due: z.string().nullable().default(null),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["open", "in_progress", "blocked", "done"]).default("open"),
  stage: z.string().nullable().default(null),
  /** where it came from, e.g. "rfi:<id>", "email:<id>", "manual" */
  source: z.string().nullable().default(null),
  createdAt: z.string(),
  completedAt: z.string().nullable().default(null),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

/**
 * An email tied to the job. Draft-and-track only: the tool composes the message
 * and logs it; sending is done by the human (copy/paste). No external send.
 */
export const EmailSchema = z.object({
  id: z.string(),
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  /** recipient (outbound) or sender (inbound) */
  party: z.string(),
  subject: z.string(),
  body: z.string().default(""),
  kind: z
    .enum([
      "general",
      "rfi",
      "submittal",
      "bid",
      "change_order",
      "schedule",
      "inspection",
      "procurement",
      "closeout_request",
      "vendor_quote",
      "po_request",
      "foreman_alert",
    ])
    .default("general"),
  /** id of the linked record (rfi/submittal/etc.), if any */
  relatedId: z.string().nullable().default(null),
  status: z
    .enum(["draft", "sent", "received", "replied", "archived"])
    .default("draft"),
  createdAt: z.string(),
  updatedAt: z.string(),
  sentAt: z.string().nullable().default(null),
});
export type Email = z.infer<typeof EmailSchema>;

/**
 * Closeout documentation, tracked per material from request → received (staged in
 * "PM Docs/All Closeout Docs/<material>") → filed (moved into the job's closeout
 * folder once the GC approves the submittal). Mirrors UMI's closeout process:
 * plumbing closeout = As-builts (Engineering) + O&Ms (vendor, fixtures/equipment
 * only) + Warranty Letter (UMI template), plus cut sheets / install / ADA / test
 * reports / Title 24 as the spec or GC requires.
 */
export const CLOSEOUT_DOC_TYPES = [
  "as_built",
  "o_and_m",
  "warranty_letter",
  "cut_sheet",
  "installation",
  "ada_cert",
  "test_report",
  "title_24",
  "other",
] as const;
export const CloseoutDocTypeSchema = z.enum(CLOSEOUT_DOC_TYPES);
export type CloseoutDocType = z.infer<typeof CloseoutDocTypeSchema>;

export const CloseoutDocSchema = z.object({
  id: z.string(),
  /** the submittal this doc supports (closeout is requested alongside submittals) */
  submittalId: z.string().nullable().default(null),
  /** the fixture/equipment, e.g. "Kohler K-30810 Water Closet" */
  material: z.string(),
  docType: CloseoutDocTypeSchema,
  /** where it comes from: vendor (O&M/cut sheet), engineering (as-built), internal (warranty letter), gc */
  source: z
    .enum(["vendor", "engineering", "internal", "gc", "other"])
    .default("vendor"),
  status: z
    .enum(["needed", "requested", "received", "filed", "waived"])
    .default("needed"),
  requestedFrom: z.string().nullable().default(null),
  requestedAt: z.string().nullable().default(null),
  receivedAt: z.string().nullable().default(null),
  filedAt: z.string().nullable().default(null),
  /** staging location under PM Docs/All Closeout Docs/<material>/ */
  stagingPath: z.string().nullable().default(null),
  /** final location under <job>/Closeout/<material>/ after submittal approval */
  jobPath: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
});
export type CloseoutDoc = z.infer<typeof CloseoutDocSchema>;

export const OpenQuestionSchema = z.object({
  id: z.string(),
  stage: z.string(),
  question: z.string(),
  blocking: z.boolean().default(true),
  askedAt: z.string(),
  answeredAt: z.string().nullable().default(null),
  answer: z.string().nullable().default(null),
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const ActivityLogEntrySchema = z.object({
  ts: z.string(),
  actor: z.enum(["ai", "human"]),
  action: z.string(),
  summary: z.string(),
});
export type ActivityLogEntry = z.infer<typeof ActivityLogEntrySchema>;

export const STAGE_IDS = [
  "lease_scope_review",
  "estimate_takeoff",
  "bid_proposal",
  "contract_buyout",
  "submittals_rfis",
  "schedule_manpower",
  "procurement",
  "install_inspections",
  "certified_payroll",
  "change_orders",
  "closeout",
] as const;
export const StageIdSchema = z.enum(STAGE_IDS);
export type StageId = z.infer<typeof StageIdSchema>;

export const StageStateSchema = z.object({
  status: z
    .enum(["not_started", "in_progress", "blocked", "complete"])
    .default("not_started"),
  completedAt: z.string().nullable().default(null),
  blockingCount: z.number().default(0),
});

export const WorkflowStatusSchema = z.object({
  currentStage: StageIdSchema.default("lease_scope_review"),
  stages: z.record(StageIdSchema, StageStateSchema).default({}),
});
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  owner: z.string().nullable().default(null),
  client: z
    .object({
      gc: z.string().nullable().default(null),
      contact: z.string().nullable().default(null),
      phone: z.string().nullable().default(null),
    })
    .default({}),
  location: z.object({
    region: RegionSchema,
    jurisdiction: z.string().nullable().default(null),
    address: z.string().nullable().default(null),
  }),
  /** > $1,000 public works => prevailing wage + certified payroll apply. null = undecided. */
  publicWorks: z.boolean().nullable().default(null),
  uaLocal: z.string(),
  /** UMI division — closeout requirements differ by trade. */
  division: z.enum(["Plumbing", "HVAC", "Both"]).default("Plumbing"),
  /** UMI internal job number, format XXXXX-XX (e.g. 11836-15). */
  jobNumber: z.string().nullable().default(null),
  scopeSummary: z.string().nullable().default(null),

  workflowStatus: WorkflowStatusSchema.default({}),
  scopeItems: z.array(ScopeItemSchema).default([]),
  estimate: EstimateSchema.default({}),
  wageAssumptions: z
    .object({
      asOfDeterminationId: z.string().nullable().default(null),
      rows: z.array(WageRowSchema).default([]),
    })
    .default({}),
  labor: LaborSchema.default({}),
  bid: BidSchema.default({}),
  schedule: ScheduleSchema.default({}),
  rfis: z.array(RfiSchema).default([]),
  submittals: z.array(SubmittalSchema).default([]),
  changeOrders: z.array(ChangeOrderSchema).default([]),
  inspections: z.array(InspectionSchema).default([]),
  procurement: z.array(ProcurementSchema).default([]),
  payroll: z.array(PayrollWeekSchema).default([]),
  tasks: z.array(TaskItemSchema).default([]),
  emails: z.array(EmailSchema).default([]),
  closeoutDocs: z.array(CloseoutDocSchema).default([]),
  openQuestions: z.array(OpenQuestionSchema).default([]),
  activityLog: z.array(ActivityLogEntrySchema).default([]),
});
export type Project = z.infer<typeof ProjectSchema>;
