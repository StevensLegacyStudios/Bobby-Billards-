import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "../kb.js";
import { ProjectSchema, type Project } from "../schema/project.js";

const DATA_DIR = resolve(
  REPO_ROOT,
  process.env.RYDESHARE_DATA_DIR ?? "./data",
);
const PROJECTS_DIR = resolve(DATA_DIR, "projects");

function ensureDirs(): void {
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

function projectPath(id: string): string {
  return resolve(PROJECTS_DIR, `${id}.json`);
}

/** Atomic write: temp file + rename, so a crash can't leave half a file. */
function atomicWrite(path: string, contents: string): void {
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, contents, "utf8");
  renameSync(tmp, path);
}

export function saveProject(project: Project): Project {
  ensureDirs();
  const next: Project = { ...project, updatedAt: new Date().toISOString() };
  const parsed = ProjectSchema.parse(next);
  atomicWrite(projectPath(parsed.id), JSON.stringify(parsed, null, 2));
  return parsed;
}

export function loadProject(id: string): Project | null {
  const path = projectPath(id);
  if (!existsSync(path)) return null;
  return ProjectSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export interface ProjectIndexEntry {
  id: string;
  name: string;
  region: string;
  currentStage: string;
  updatedAt: string;
  openQuestionCount: number;
}

export function listProjects(): ProjectIndexEntry[] {
  ensureDirs();
  const files = readdirSync(PROJECTS_DIR).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".tmp"),
  );
  const entries: ProjectIndexEntry[] = [];
  for (const f of files) {
    try {
      const p = ProjectSchema.parse(
        JSON.parse(readFileSync(resolve(PROJECTS_DIR, f), "utf8")),
      );
      entries.push({
        id: p.id,
        name: p.name,
        region: p.location.region,
        currentStage: p.workflowStatus.currentStage,
        updatedAt: p.updatedAt,
        openQuestionCount: p.openQuestions.filter((q) => !q.answeredAt).length,
      });
    } catch {
      // skip unreadable/legacy files
    }
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { DATA_DIR, PROJECTS_DIR };
