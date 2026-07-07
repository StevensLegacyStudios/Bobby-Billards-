import { describe, expect, it } from "vitest";
import { isOverdue, sortTasks, taskBuckets } from "./tasks.js";
import { createProject } from "../factory.js";
import type { TaskItem } from "../schema/project.js";

const TODAY = "2026-06-17";

function task(p: Partial<TaskItem>): TaskItem {
  return {
    id: p.id ?? "t",
    title: p.title ?? "x",
    detail: null,
    assignee: null,
    due: p.due ?? null,
    priority: p.priority ?? "normal",
    status: p.status ?? "open",
    stage: null,
    source: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
  };
}

describe("tasks engine", () => {
  it("flags only active, past-due tasks as overdue", () => {
    expect(isOverdue(task({ due: "2026-06-10" }), TODAY)).toBe(true);
    expect(isOverdue(task({ due: "2026-06-20" }), TODAY)).toBe(false);
    expect(isOverdue(task({ due: "2026-06-10", status: "done" }), TODAY)).toBe(false);
    expect(isOverdue(task({ due: null }), TODAY)).toBe(false);
  });

  it("orders overdue first, then by priority", () => {
    const sorted = sortTasks(
      [
        task({ id: "low", priority: "low" }),
        task({ id: "overdue", priority: "normal", due: "2026-06-01" }),
        task({ id: "urgent", priority: "urgent" }),
      ],
      TODAY,
    );
    expect(sorted.map((t) => t.id)).toEqual(["overdue", "urgent", "low"]);
  });

  it("buckets open/overdue/done from a project", () => {
    const p = createProject({ name: "T", region: "East Bay" });
    p.tasks = [
      task({ id: "a", due: "2026-06-01" }),
      task({ id: "b", due: "2026-06-30" }),
      task({ id: "c", status: "done" }),
    ];
    const b = taskBuckets(p, TODAY);
    expect(b.open.length).toBe(2);
    expect(b.overdue.map((t) => t.id)).toEqual(["a"]);
    expect(b.done.length).toBe(1);
  });
});
