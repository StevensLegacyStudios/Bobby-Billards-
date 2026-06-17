import type { Email, Project, TaskItem } from "../schema/project.js";
import { closeoutProgress } from "./closeout.js";
import { computeGaps } from "./gaps.js";

const PRIORITY_RANK: Record<TaskItem["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const isActive = (t: TaskItem): boolean => t.status !== "done";

/** A task is overdue when it has a due date in the past and isn't done. */
export function isOverdue(t: TaskItem, today: string): boolean {
  if (!isActive(t) || !t.due) return false;
  return t.due < today;
}

/** Sort active tasks: overdue first, then priority, then due date. */
export function sortTasks(tasks: TaskItem[], today: string): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const ao = isOverdue(a, today) ? 0 : 1;
    const bo = isOverdue(b, today) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return (a.due ?? "9999").localeCompare(b.due ?? "9999");
  });
}

export interface TaskBuckets {
  open: TaskItem[];
  overdue: TaskItem[];
  dueToday: TaskItem[];
  done: TaskItem[];
}

export function taskBuckets(project: Project, today: string): TaskBuckets {
  const active = sortTasks(project.tasks.filter(isActive), today);
  return {
    open: active,
    overdue: active.filter((t) => isOverdue(t, today)),
    dueToday: active.filter((t) => t.due === today),
    done: project.tasks.filter((t) => t.status === "done"),
  };
}

/** Outbound emails that were sent but haven't been marked replied. */
export function awaitingReplies(project: Project): Email[] {
  return project.emails.filter(
    (e) => e.direction === "outbound" && e.status === "sent",
  );
}

export interface Briefing {
  stage: string;
  nextAction: string;
  blockingQuestions: string[];
  tasks: { open: number; overdue: number; dueToday: number; top: TaskItem[] };
  email: { drafts: number; awaitingReplies: number };
  rfis: { open: number };
  submittals: { pending: number };
  inspections: { upcoming: number };
  closeout: { outstanding: number; readyToFile: number };
}

/** A single "what's on my plate" snapshot across the whole job. */
export function buildBriefing(project: Project, today: string): Briefing {
  const gaps = computeGaps(project);
  const b = taskBuckets(project, today);
  const co = closeoutProgress(project);
  return {
    stage: gaps.currentStageLabel,
    nextAction: gaps.nextAction,
    blockingQuestions: gaps.blockingQuestions,
    tasks: {
      open: b.open.length,
      overdue: b.overdue.length,
      dueToday: b.dueToday.length,
      top: b.open.slice(0, 5),
    },
    email: {
      drafts: project.emails.filter((e) => e.status === "draft").length,
      awaitingReplies: awaitingReplies(project).length,
    },
    rfis: { open: project.rfis.filter((r) => r.status === "open").length },
    submittals: {
      pending: project.submittals.filter(
        (s) => s.status === "pending" || s.status === "submitted",
      ).length,
    },
    inspections: {
      upcoming: project.inspections.filter((i) => i.result === "scheduled").length,
    },
    closeout: { outstanding: co.totals.outstanding, readyToFile: co.readyToFile.length },
  };
}
