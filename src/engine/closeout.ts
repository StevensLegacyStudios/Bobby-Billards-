import type {
  CloseoutDoc,
  CloseoutDocType,
  Project,
} from "../schema/project.js";

/** Root where received closeout docs are staged, per the UMI process. */
export const CLOSEOUT_STAGING_ROOT = "PM Docs/All Closeout Docs";

/** Human labels for doc types (used in emails and summaries). */
export const DOC_TYPE_LABEL: Record<CloseoutDocType, string> = {
  as_built: "As-Built drawings",
  o_and_m: "O&M manual",
  warranty_letter: "Warranty letter",
  cut_sheet: "Cut sheets",
  installation: "Installation instructions",
  ada_cert: "ADA compliance certification",
  test_report: "Test report",
  title_24: "Title 24",
  other: "Other documentation",
};

export interface RequiredDoc {
  docType: CloseoutDocType;
  source: CloseoutDoc["source"];
}

/**
 * What closeout docs a given material needs, per UMI's process. Plumbing closeout
 * is As-builts (Engineering) + O&Ms (vendor) + Warranty Letter (UMI internal); we
 * also collect cut sheets / install instructions from the vendor with the
 * submittal, and ADA cert when the spec calls for it. Valves and piping do NOT
 * need O&Ms — only fixtures/equipment do.
 */
export function requiredDocsForMaterial(
  project: Project,
  opts: { isFixtureOrEquipment?: boolean; adaRequired?: boolean } = {},
): RequiredDoc[] {
  const isFE = opts.isFixtureOrEquipment ?? true;
  const docs: RequiredDoc[] = [
    { docType: "cut_sheet", source: "vendor" },
    { docType: "installation", source: "vendor" },
  ];
  if (isFE) docs.push({ docType: "o_and_m", source: "vendor" });
  docs.push({ docType: "warranty_letter", source: "internal" });
  docs.push({ docType: "as_built", source: "engineering" });
  if (opts.adaRequired) docs.push({ docType: "ada_cert", source: "vendor" });
  return docs;
}

/** Docs we request FROM the vendor at submittal time (the rest are internal/eng). */
export function vendorRequestedDocs(required: RequiredDoc[]): CloseoutDocType[] {
  return required.filter((d) => d.source === "vendor").map((d) => d.docType);
}

function slug(material: string): string {
  return material.trim().replace(/[\\/]+/g, "-");
}

export function stagingPath(material: string): string {
  return `${CLOSEOUT_STAGING_ROOT}/${slug(material)}`;
}

/** The job's closeout folder, where approved-material docs are filed. */
export function jobCloseoutPath(project: Project, material: string): string {
  const folder = project.jobNumber
    ? `${project.name} (${project.jobNumber})`
    : project.name;
  return `Jobs/${folder}/Closeout/${slug(material)}`;
}

export interface MaterialCloseoutStatus {
  material: string;
  total: number;
  needed: number;
  requested: number;
  received: number;
  filed: number;
  complete: boolean;
}

export interface CloseoutProgress {
  byMaterial: MaterialCloseoutStatus[];
  totals: { total: number; received: number; filed: number; outstanding: number };
  /** materials whose docs are received and staged, ready to file on approval */
  readyToFile: string[];
}

export function closeoutProgress(project: Project): CloseoutProgress {
  const groups = new Map<string, CloseoutDoc[]>();
  for (const d of project.closeoutDocs) {
    const arr = groups.get(d.material) ?? [];
    arr.push(d);
    groups.set(d.material, arr);
  }
  const byMaterial: MaterialCloseoutStatus[] = [];
  let total = 0;
  let received = 0;
  let filed = 0;
  const readyToFile: string[] = [];
  for (const [material, docs] of groups) {
    const count = (s: CloseoutDoc["status"]) =>
      docs.filter((d) => d.status === s).length;
    const ms: MaterialCloseoutStatus = {
      material,
      total: docs.length,
      needed: count("needed"),
      requested: count("requested"),
      received: count("received"),
      filed: count("filed"),
      complete: docs.every((d) => d.status === "filed" || d.status === "waived"),
    };
    byMaterial.push(ms);
    total += docs.length;
    received += ms.received;
    filed += ms.filed;
    // Ready to file = nothing still outstanding upstream and something staged.
    if (ms.received > 0 && ms.needed === 0 && ms.requested === 0) {
      readyToFile.push(material);
    }
  }
  return {
    byMaterial,
    totals: {
      total,
      received,
      filed,
      outstanding: total - filed,
    },
    readyToFile,
  };
}
