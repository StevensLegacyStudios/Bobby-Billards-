import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

/**
 * The "always learning" layer. Every time you confirm or correct the system, we
 * record it here and feed it back into the next extraction as few-shot context, so
 * the brain gets better at YOUR jobs, vendors, and categories over time. Plain JSON
 * on disk (or wherever UMI_MEMORY_PATH points) — no database needed.
 */

export const JobAliasSchema = z.object({
  job: z.string(),
  jobNumber: z.string().nullable().default(null),
  aliases: z.array(z.string()).default([]),
});

export const CorrectionSchema = z.object({
  subjectHint: z.string(),
  fromEmail: z.string().nullable().default(null),
  wrong: z.string(),
  right: z.string(),
  ts: z.string(),
});

export const LearnedContactSchema = z.object({
  name: z.string(),
  company: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  role: z.string().nullable().default(null),
});

export const MemorySchema = z.object({
  jobAliases: z.array(JobAliasSchema).default([]),
  corrections: z.array(CorrectionSchema).default([]),
  contacts: z.array(LearnedContactSchema).default([]),
});
export type Memory = z.infer<typeof MemorySchema>;
export type JobAlias = z.infer<typeof JobAliasSchema>;

export function emptyMemory(): Memory {
  return { jobAliases: [], corrections: [], contacts: [] };
}

function memoryPath(): string {
  return process.env.UMI_MEMORY_PATH ?? resolve(process.cwd(), ".umi", "memory.json");
}

export function loadMemory(path = memoryPath()): Memory {
  if (!existsSync(path)) return emptyMemory();
  try {
    return MemorySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(mem: Memory, path = memoryPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(MemorySchema.parse(mem), null, 2));
}

/** Record a category correction (you fixed what the AI guessed). Pure — returns new memory. */
export function recordCorrection(
  mem: Memory,
  c: { subjectHint: string; fromEmail?: string | null; wrong: string; right: string },
): Memory {
  return {
    ...mem,
    corrections: [
      ...mem.corrections,
      {
        subjectHint: c.subjectHint.slice(0, 120),
        fromEmail: c.fromEmail ?? null,
        wrong: c.wrong,
        right: c.right,
        ts: new Date().toISOString(),
      },
    ].slice(-200),
  };
}

/** Teach the system that these names/addresses all mean one job. Pure. */
export function recordJobAlias(
  mem: Memory,
  job: string,
  aliases: string[],
  jobNumber?: string | null,
): Memory {
  const existing = mem.jobAliases.find((j) => j.job === job);
  const merged = existing
    ? mem.jobAliases.map((j) =>
        j.job === job
          ? { ...j, jobNumber: jobNumber ?? j.jobNumber, aliases: dedupe([...j.aliases, ...aliases]) }
          : j,
      )
    : [...mem.jobAliases, { job, jobNumber: jobNumber ?? null, aliases: dedupe(aliases) }];
  return { ...mem, jobAliases: merged };
}

export function recordContact(mem: Memory, contact: z.infer<typeof LearnedContactSchema>): Memory {
  const key = (contact.email ?? contact.name).toLowerCase();
  const without = mem.contacts.filter((c) => (c.email ?? c.name).toLowerCase() !== key);
  return { ...mem, contacts: [...without, contact] };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

/**
 * Render the learned context as a compact block for the extraction prompt. We cap
 * it so the prompt stays small even after months of corrections.
 */
export function learnedContext(mem: Memory): string {
  const lines: string[] = [];
  if (mem.jobAliases.length) {
    lines.push("KNOWN JOBS (match any alias to the job):");
    for (const j of mem.jobAliases.slice(-40)) {
      lines.push(`- ${j.job}${j.jobNumber ? ` (${j.jobNumber})` : ""}: ${j.aliases.join(", ")}`);
    }
  }
  const recent = mem.corrections.slice(-15);
  if (recent.length) {
    lines.push("PAST CORRECTIONS (the PM fixed these — don't repeat the mistake):");
    for (const c of recent) {
      lines.push(`- "${c.subjectHint}" → category is ${c.right}, NOT ${c.wrong}.`);
    }
  }
  return lines.join("\n");
}
