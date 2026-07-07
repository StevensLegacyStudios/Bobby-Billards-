import { stageById, workflowStages } from "../kb.js";
import type { Project, StageId } from "../schema/project.js";

export interface Gap {
  path: string;
  question: string;
  blocking: boolean;
}

export interface StageStatus {
  id: string;
  label: string;
  status: "complete" | "in_progress" | "blocked" | "not_started";
  blockingGaps: Gap[];
  nonBlockingGaps: Gap[];
}

export interface GapsResult {
  currentStage: string;
  currentStageLabel: string;
  nextAction: string;
  blockingQuestions: string[];
  nonBlockingQuestions: string[];
  canAdvance: boolean;
  stageStatus: StageStatus[];
}

function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/** A required field is "satisfied" when present and non-placeholder. */
function isSatisfied(project: Project, path: string): boolean {
  // publicWorks is a tri-state: null means "undecided" => a gap.
  if (path === "publicWorks") {
    return project.publicWorks !== null && project.publicWorks !== undefined;
  }
  const value = getByPath(project, path);
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function gapsForStage(project: Project, stageId: string): {
  blocking: Gap[];
  nonBlocking: Gap[];
} {
  const stage = stageById(stageId);
  const blocking: Gap[] = [];
  const nonBlocking: Gap[] = [];
  if (!stage) return { blocking, nonBlocking };
  for (const req of stage.requiredInfo) {
    if (isSatisfied(project, req.path)) continue;
    const gap: Gap = {
      path: req.path,
      question: req.question,
      blocking: req.blocking,
    };
    (req.blocking ? blocking : nonBlocking).push(gap);
  }
  return { blocking, nonBlocking };
}

const STAGE_ORDER: StageId[] = workflowStages.stages.map(
  (s) => s.id as StageId,
);

export function computeGaps(project: Project): GapsResult {
  const current = project.workflowStatus.currentStage;
  const currentIdx = STAGE_ORDER.indexOf(current);
  const currentStageDef = stageById(current);

  const stageStatus: StageStatus[] = workflowStages.stages.map((s, idx) => {
    const { blocking, nonBlocking } = gapsForStage(project, s.id);
    let status: StageStatus["status"];
    if (idx < currentIdx) status = "complete";
    else if (idx > currentIdx) status = "not_started";
    else if (blocking.length > 0) status = "blocked";
    else if (nonBlocking.length > 0) status = "in_progress";
    else status = "in_progress";
    return {
      id: s.id,
      label: s.label,
      status,
      blockingGaps: blocking,
      nonBlockingGaps: nonBlocking,
    };
  });

  const { blocking, nonBlocking } = gapsForStage(project, current);
  const canAdvance = blocking.length === 0;

  // Surface unanswered persisted questions too (the brain's memory of asks).
  const persisted = project.openQuestions.filter((q) => !q.answeredAt);
  const persistedBlocking = persisted
    .filter((q) => q.blocking)
    .map((q) => q.question);

  const blockingQuestions = dedupe([
    ...blocking.map((g) => g.question),
    ...persistedBlocking,
  ]);

  let nextAction: string;
  if (blocking.length > 0) {
    nextAction = `${currentStageDef?.label ?? current}: ${currentStageDef?.summary ?? ""} (resolve the blocking items below to proceed)`;
  } else if (currentIdx < STAGE_ORDER.length - 1) {
    nextAction = `${currentStageDef?.label ?? current} is unblocked — confirm with the user, then advance_stage to "${stageById(STAGE_ORDER[currentIdx + 1]!)?.label}".`;
  } else {
    nextAction = `${currentStageDef?.label ?? current} — final stage. Wrap up closeout items.`;
  }

  return {
    currentStage: current,
    currentStageLabel: currentStageDef?.label ?? current,
    nextAction,
    blockingQuestions,
    nonBlockingQuestions: dedupe(nonBlocking.map((g) => g.question)),
    canAdvance,
    stageStatus,
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

export { STAGE_ORDER };
