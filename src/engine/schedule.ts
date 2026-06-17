import { PHASES, type Phase, type ScopeItem, type Task } from "../schema/project.js";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function phaseOrder(phase: Phase): number {
  const i = PHASES.indexOf(phase);
  return i < 0 ? PHASES.length : i;
}

let counter = 0;
function tid(): string {
  counter += 1;
  return `task_${Date.now().toString(36)}_${counter}`;
}

/**
 * Simple, deterministic manpower-loaded schedule: sort scope items by build
 * phase, chain each after the previous, and lay out calendar dates from the
 * start date. (Phase 2 upgrades this to a real dependency graph.)
 */
export function computeSchedule(
  scopeItems: ScopeItem[],
  startDate: string,
  opts: {
    crewSize?: number;
    durationsOverride?: Record<string, number>;
  } = {},
): Task[] {
  const crewSize = opts.crewSize ?? 0;
  const sorted = [...scopeItems].sort(
    (a, b) => phaseOrder(a.phase) - phaseOrder(b.phase),
  );

  const tasks: Task[] = [];
  let cursor = startDate.slice(0, 10);
  let prevId: string | null = null;

  for (const item of sorted) {
    const duration =
      opts.durationsOverride?.[item.phase] ?? item.typicalDurationDays ?? 0;
    const id = tid();
    const start = cursor;
    const finish = addDays(start, Math.max(0, duration));
    tasks.push({
      id,
      name: `${item.system}${item.zone ? ` — ${item.zone}` : ""}`,
      phase: item.phase,
      dependsOn: prevId ? [prevId] : [],
      durationDays: duration,
      crewSize,
      start,
      finish,
      status: "not_started",
    });
    cursor = finish;
    prevId = id;
  }

  return tasks;
}
