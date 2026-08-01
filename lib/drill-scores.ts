import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Drill score store for the Shot Lab.
 *
 * Signed out (or Supabase unconfigured): scores live in localStorage so the
 * trendline works on this device with zero friction. Signed in: scores live in
 * the drill_scores table, and any device-local history is merged up once on
 * first use, then cleared locally.
 */

export interface DrillScore {
  id: string;
  drillKey: string;
  score: number;
  maxScore?: number;
  note?: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface DrillScoreInput {
  drillKey: string;
  score: number;
  maxScore?: number;
  note?: string;
}

const STORAGE_KEY = "bb-drill-scores";

interface DrillScoreRow {
  id: string;
  drill_key: string;
  score: number;
  max_score: number | null;
  note: string | null;
  created_at: string;
}

function rowToScore(row: DrillScoreRow): DrillScore {
  return {
    id: row.id,
    drillKey: row.drill_key,
    score: row.score,
    maxScore: row.max_score ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function readLocal(): DrillScore[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DrillScore => {
      if (typeof entry !== "object" || entry === null) return false;
      const e = entry as Partial<DrillScore>;
      return (
        typeof e.id === "string" &&
        typeof e.drillKey === "string" &&
        typeof e.score === "number" &&
        typeof e.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeLocal(scores: DrillScore[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Storage full or blocked — nothing sensible to do.
  }
}

async function getSignedInContext(): Promise<{
  supabase: SupabaseClient;
  userId: string;
} | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    return userId ? { supabase, userId } : null;
  } catch {
    return null;
  }
}

let mergeInFlight: Promise<void> | null = null;

/**
 * One-time merge: fold any device-local history into the user's table, then
 * clear localStorage. Safe to call repeatedly — once local storage is empty
 * (or a merge is already running) it's a no-op.
 */
function mergeLocalIntoRemote(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!mergeInFlight) {
    mergeInFlight = (async () => {
      const local = readLocal();
      if (local.length === 0) return;
      const { error } = await supabase.from("drill_scores").insert(
        local.map((s) => ({
          user_id: userId,
          drill_key: s.drillKey,
          score: s.score,
          max_score: s.maxScore ?? null,
          note: s.note ?? null,
          created_at: s.createdAt,
        }))
      );
      // Only clear local history once it's safely in the table.
      if (!error && typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    })().finally(() => {
      mergeInFlight = null;
    });
  }
  return mergeInFlight;
}

/** Log a score. Returns the stored entry (with its final id and timestamp). */
export async function logScore(entry: DrillScoreInput): Promise<DrillScore> {
  const ctx = await getSignedInContext();
  if (ctx) {
    await mergeLocalIntoRemote(ctx.supabase, ctx.userId);
    const { data, error } = await ctx.supabase
      .from("drill_scores")
      .insert({
        user_id: ctx.userId,
        drill_key: entry.drillKey,
        score: entry.score,
        max_score: entry.maxScore ?? null,
        note: entry.note ?? null,
      })
      .select("id, drill_key, score, max_score, note, created_at")
      .single();
    if (error) throw new Error(error.message);
    return rowToScore(data as DrillScoreRow);
  }

  const score: DrillScore = {
    id: crypto.randomUUID(),
    drillKey: entry.drillKey,
    score: entry.score,
    maxScore: entry.maxScore,
    note: entry.note,
    createdAt: new Date().toISOString(),
  };
  writeLocal([score, ...readLocal()]);
  return score;
}

/** All scores (optionally for one drill), newest first. */
export async function getScores(drillKey?: string): Promise<DrillScore[]> {
  const ctx = await getSignedInContext();
  if (ctx) {
    await mergeLocalIntoRemote(ctx.supabase, ctx.userId);
    let query = ctx.supabase
      .from("drill_scores")
      .select("id, drill_key, score, max_score, note, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });
    if (drillKey) query = query.eq("drill_key", drillKey);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data ?? []) as DrillScoreRow[]).map(rowToScore);
  }

  return readLocal()
    .filter((s) => !drillKey || s.drillKey === drillKey)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Delete one entry by id. */
export async function deleteScore(id: string): Promise<void> {
  const ctx = await getSignedInContext();
  if (ctx) {
    const { error } = await ctx.supabase
      .from("drill_scores")
      .delete()
      .eq("id", id)
      .eq("user_id", ctx.userId);
    if (error) throw new Error(error.message);
    return;
  }
  writeLocal(readLocal().filter((s) => s.id !== id));
}
