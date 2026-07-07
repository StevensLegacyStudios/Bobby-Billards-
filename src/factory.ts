import { randomUUID } from "node:crypto";
import { localForRegion } from "./kb.js";
import { seedWageRows } from "./engine/wages.js";
import {
  ProjectSchema,
  type Project,
  type Region,
} from "./schema/project.js";

export interface CreateProjectArgs {
  name: string;
  region: Region;
  owner?: string | null;
  client?: { gc?: string | null; contact?: string | null; phone?: string | null };
  jurisdiction?: string | null;
  scopeSummary?: string | null;
  uaLocal?: string;
}

export function createProject(args: CreateProjectArgs): Project {
  const now = new Date().toISOString();
  const uaLocal = args.uaLocal ?? localForRegion(args.region);
  const rows = seedWageRows(uaLocal);

  return ProjectSchema.parse({
    id: randomUUID(),
    name: args.name,
    createdAt: now,
    updatedAt: now,
    owner: args.owner ?? null,
    client: args.client ?? {},
    location: {
      region: args.region,
      jurisdiction: args.jurisdiction ?? null,
      address: null,
    },
    publicWorks: null,
    uaLocal,
    scopeSummary: args.scopeSummary ?? null,
    workflowStatus: {
      currentStage: "lease_scope_review",
      stages: { lease_scope_review: { status: "in_progress" } },
    },
    wageAssumptions: { asOfDeterminationId: null, rows },
    activityLog: [
      { ts: now, actor: "ai", action: "create_project", summary: `Created project "${args.name}" in ${args.region} (UA Local ${uaLocal}).` },
    ],
  });
}
