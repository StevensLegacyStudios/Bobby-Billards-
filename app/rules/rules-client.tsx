"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Camera,
  Check,
  Crosshair,
  Dumbbell,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";

import BilliardCanvasLazy from "@/components/billiards/billiard-canvas-lazy";
import { ShotEditor, type ShotLayout } from "@/components/billiards/shot-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { deleteScore, getScores, logScore, type DrillScore } from "@/lib/drill-scores";
import { DRILLS, SYSTEMS, type Drill } from "@/lib/drills";
import {
  POCKETS,
  solveBankShot,
  solveBestKick,
  solveBestShot,
  solveDirectShot,
  solveKickShot,
  type Cushion,
} from "@/lib/engine/trajectory";
import { cn } from "@/lib/utils";
import type { CvDetection, TablePoint, TrajectoryPayload } from "@/lib/types";

type ShotMode = "pocket" | "kick";
type EditorState = ShotLayout & { bank?: Cushion };

const PRESETS: { name: string; state: EditorState; mode?: ShotMode; kickRail?: Cushion | "best" }[] = [
  { name: "Straight in", state: { cue: [56, 90], target: [120, 50], pocket: "top_right" } },
  { name: "Thin cut, corner", state: { cue: [50, 80], target: [150, 30], pocket: "top_right" } },
  { name: "Side pocket cut", state: { cue: [30, 30], target: [95, 60], pocket: "bottom_mid" } },
  {
    name: "One-rail bank",
    state: { cue: [150, 20], target: [110, 60], pocket: "top_left", bank: "bottom" },
  },
  {
    name: "Kick at the 8",
    state: { cue: [40, 80], target: [160, 75], pocket: "best" },
    mode: "kick",
    kickRail: "best",
  },
  { name: "Solver's choice", state: { cue: [25, 75], target: [170, 25], pocket: "best" } },
];

const CUSHIONS: (Cushion | "best")[] = ["best", "top", "bottom", "left", "right"];

function encodeShot(state: EditorState): string {
  const payload = JSON.stringify([
    Math.round(state.cue[0] * 10) / 10,
    Math.round(state.cue[1] * 10) / 10,
    Math.round(state.target[0] * 10) / 10,
    Math.round(state.target[1] * 10) / 10,
    state.pocket,
  ]);
  return btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShot(encoded: string): EditorState | null {
  try {
    const [cx, cy, tx, ty, pocket] = JSON.parse(
      atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (typeof cx !== "number" || typeof tx !== "number") return null;
    return {
      cue: [cx, cy] as TablePoint,
      target: [tx, ty] as TablePoint,
      pocket: pocket === "best" || pocket in POCKETS ? pocket : "best",
    };
  } catch {
    return null;
  }
}

/** Downscale a photo to ≤1280px long edge and return base64 JPEG. */
async function preparePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

interface AiResult {
  detections: CvDetection[];
  trajectory: TrajectoryPayload;
  notes?: string;
  labels?: string[];
  usage: { uploadsThisMonth: number; monthlyLimit: number | null };
}

/** Compact relative timestamp: "just now", "5m ago", "3d ago"… */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Inline trendline of the last 10 scores — no chart library, just a polyline. */
function Sparkline({ scores }: { scores: DrillScore[] }) {
  // scores arrive newest-first; plot the last 10 in chronological order.
  const values = scores
    .slice(0, 10)
    .map((s) => s.score)
    .reverse();
  if (values.length < 2) return null;

  const w = 300;
  const h = 44;
  const padX = 6;
  const padY = 7;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = padX + (i / (values.length - 1)) * (w - 2 * padX);
    const y = h - padY - ((v - min) / span) * (h - 2 * padY);
    return [x, y] as const;
  });
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-11 w-full"
      role="img"
      aria-label={`Trendline of your last ${values.length} scores`}
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r={3} fill="var(--primary)" />
    </svg>
  );
}

/**
 * "Track it" card — quick score logging + personal history for one drill.
 * Render with key={drill.key} so switching drills resets the form state.
 */
function DrillTracker({ drill }: { drill: Drill }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [scores, setScores] = useState<DrillScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreInput, setScoreInput] = useState("");
  const [outOfInput, setOutOfInput] = useState(drill.maxScore?.toString() ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    getScores(drill.key)
      .then((rows) => {
        if (!cancelled) setScores(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your score history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drill.key]);

  // Load history for the selected drill (and reload once auth state settles).
  useEffect(() => refresh(), [refresh, userId]);

  const submit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const score = Number(scoreInput);
      if (!Number.isFinite(score)) return;
      const outOf = Number(outOfInput);
      const entry = {
        drillKey: drill.key,
        score,
        maxScore: outOfInput.trim() !== "" && Number.isFinite(outOf) ? outOf : undefined,
        note: note.trim() || undefined,
      };

      // Optimistic: show the entry immediately, reconcile once it's stored.
      const temp: DrillScore = {
        id: `pending-${Date.now()}`,
        drillKey: entry.drillKey,
        score: entry.score,
        maxScore: entry.maxScore,
        note: entry.note,
        createdAt: new Date().toISOString(),
      };
      setScores((prev) => [temp, ...prev]);
      setScoreInput("");
      setNote("");
      setSaving(true);
      setError(null);
      try {
        const saved = await logScore(entry);
        setScores((prev) => prev.map((s) => (s.id === temp.id ? saved : s)));
      } catch {
        setScores((prev) => prev.filter((s) => s.id !== temp.id));
        setError("Couldn't save that score — try again.");
      } finally {
        setSaving(false);
      }
    },
    [drill.key, scoreInput, outOfInput, note]
  );

  const remove = useCallback(
    async (id: string) => {
      setScores((prev) => prev.filter((s) => s.id !== id));
      try {
        await deleteScore(id);
      } catch {
        setError("Couldn't delete that entry.");
        refresh();
      }
    },
    [refresh]
  );

  const best = scores.reduce<number | null>(
    (m, s) => (m === null || s.score > m ? s.score : m),
    null
  );
  const lastFive = scores.slice(0, 5);
  const lastFiveAvg =
    lastFive.length > 0
      ? lastFive.reduce((sum, s) => sum + s.score, 0) / lastFive.length
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" /> Track it
        </CardTitle>
        <CardDescription>
          Log a score every time you run this drill and watch your trendline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="drill-score">Score</Label>
            <Input
              id="drill-score"
              type="number"
              inputMode="numeric"
              required
              min={0}
              step={1}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder={drill.maxScore ? `0–${drill.maxScore}` : "0"}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drill-out-of" className="text-muted-foreground">
              Out of
            </Label>
            <Input
              id="drill-out-of"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={outOfInput}
              onChange={(e) => setOutOfInput(e.target.value)}
              placeholder="—"
              className="w-20"
            />
          </div>
          <div className="min-w-44 flex-1 space-y-1.5">
            <Label htmlFor="drill-note" className="text-muted-foreground">
              Note
            </Label>
            <Input
              id="drill-note"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. draw shots leaking left"
            />
          </div>
          <Button type="submit" disabled={saving || scoreInput.trim() === ""}>
            {saving && <Loader2 className="animate-spin" />} Log
          </Button>
        </form>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your history…</p>
        ) : scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            First time running this drill? Log a score and start your trendline.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {best !== null && (
                <Badge>
                  Personal best {best}
                  {drill.maxScore ? ` / ${drill.maxScore}` : ""}
                </Badge>
              )}
              {lastFiveAvg !== null && (
                <Badge variant="secondary">
                  Last {lastFive.length} avg {lastFiveAvg.toFixed(1)}
                </Badge>
              )}
              <Badge variant="outline">
                {scores.length} {scores.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>

            <Sparkline scores={scores} />

            <ul className="divide-y divide-border/60">
              {scores.slice(0, 8).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-14 shrink-0 font-semibold tabular-nums">
                    {s.score}
                    {s.maxScore != null && (
                      <span className="font-normal text-muted-foreground">/{s.maxScore}</span>
                    )}
                  </span>
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {timeAgo(s.createdAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.note}</span>
                  <button
                    onClick={() => void remove(s.id)}
                    aria-label="Delete this entry"
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!user && (
          <p className="text-xs text-muted-foreground">
            Scores save to this device —{" "}
            <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
              sign in
            </Link>{" "}
            to keep them everywhere.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ShotLabInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<"editor" | "drills" | "systems">("editor");
  const [mode, setMode] = useState<ShotMode>("pocket");
  const [kickRail, setKickRail] = useState<Cushion | "best">("best");
  const [editor, setEditor] = useState<EditorState>(PRESETS[0].state);
  const [activePreset, setActivePreset] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [drillKey, setDrillKey] = useState(DRILLS[0].key);

  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiError, setAiError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load a shared shot from ?shot= (state adjustment during render).
  const shotParam = searchParams.get("shot");
  const [loadedShot, setLoadedShot] = useState<string | null>(null);
  if (shotParam && shotParam !== loadedShot) {
    setLoadedShot(shotParam);
    const shared = decodeShot(shotParam);
    if (shared) {
      setEditor(shared);
      setActivePreset(null);
    }
  }

  const solved = useMemo(() => {
    if (mode === "kick") {
      return kickRail === "best"
        ? solveBestKick(editor.cue, editor.target)
        : solveKickShot(editor.cue, editor.target, kickRail);
    }
    if (editor.bank) {
      return solveBankShot(editor.cue, editor.target, POCKETS[editor.pocket as string], editor.bank);
    }
    if (editor.pocket === "best") return solveBestShot(editor.cue, editor.target);
    return solveDirectShot(editor.cue, editor.target, POCKETS[editor.pocket]);
  }, [editor, mode, kickRail]);

  const updateEditor = useCallback((next: ShotLayout) => {
    setEditor((prev) => ({ ...next, bank: prev.bank && next.pocket === prev.pocket ? prev.bank : undefined }));
    setActivePreset(null);
    setAiResult(null);
  }, []);

  const applyPreset = useCallback((i: number) => {
    const p = PRESETS[i];
    setEditor(p.state);
    setMode(p.mode ?? "pocket");
    if (p.kickRail) setKickRail(p.kickRail);
    setActivePreset(i);
    setAiResult(null);
  }, []);

  const shareShot = useCallback(async () => {
    const id = encodeShot(editor);
    const url = `${window.location.origin}/rules?shot=${id}`;
    router.replace(`/rules?shot=${id}`, { scroll: false });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — the URL is in the address bar.
    }
  }, [editor, router]);

  const analyzePhoto = useCallback(async (file: File) => {
    setAnalyzing(true);
    setAiError(null);
    try {
      const image = await preparePhoto(file);
      const res = await fetch("/api/cv/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError({ message: data.message ?? "Analysis failed.", upgrade: res.status === 402 });
        return;
      }
      setAiResult(data);
    } catch {
      setAiError({ message: "Couldn't process that photo — try a different one." });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // When the AI has produced a table read, render it instead of the editor layout.
  const activeCue = aiResult
    ? aiResult.detections.find((d) => d.label === "cue_ball")?.tablePoint ?? editor.cue
    : editor.cue;
  const activeObjects = aiResult
    ? aiResult.detections.filter((d) => d.label === "object_ball").map((d) => d.tablePoint!)
    : [editor.target];
  const activeTrajectory = aiResult ? aiResult.trajectory : solved;

  const drill = DRILLS.find((d) => d.key === drillKey) ?? DRILLS[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Crosshair className="h-7 w-7 text-primary" /> Shot Lab
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          A geometric shot solver, the drills the pros actually run, and the kicking
          systems — ghost-ball aim, banks, and mirror-system kicks on a table you can drag.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { key: "editor", label: "Shot editor", icon: Crosshair },
            { key: "drills", label: "Drills", icon: Dumbbell },
            { key: "systems", label: "Kicking systems", icon: BookOpen },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "editor" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => applyPreset(i)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  i === activePreset && !aiResult
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {p.name}
              </button>
            ))}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void analyzePhoto(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              {analyzing ? <Loader2 className="animate-spin" /> : <Camera />}
              {analyzing ? "Reading table…" : "Photo → table read (AI)"}
            </Button>
            <Button size="sm" variant="outline" onClick={shareShot}>
              {copied ? <Check /> : <Link2 />} {copied ? "Link copied!" : "Share this shot"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Shot type:</span>
            {(["pocket", "kick"] as ShotMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setActivePreset(null);
                  setAiResult(null);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  mode === m
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {m === "pocket" ? "Pocket the ball" : "Kick (cue → rail → ball)"}
              </button>
            ))}
            {mode === "kick" && (
              <>
                <span className="ml-2 text-xs text-muted-foreground">Rail:</span>
                {CUSHIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setKickRail(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium",
                      kickRail === c
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {c === "best" ? "auto" : c}
                  </button>
                ))}
              </>
            )}
          </div>

          {aiError && (
            <Card className="border-destructive/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-destructive">{aiError.message}</p>
                {aiError.upgrade && (
                  <Button asChild size="sm">
                    <Link href="/upgrade">Upgrade to Premium</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shot editor</CardTitle>
                <CardDescription>
                  Top-down view — drag balls{mode === "pocket" ? ", tap a pocket" : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShotEditor
                  layout={editor}
                  trajectory={solved}
                  onChange={updateEditor}
                  pocketsSelectable={mode === "pocket"}
                />
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <BilliardCanvasLazy
                cue={activeCue}
                objects={activeObjects}
                trajectory={activeTrajectory}
                className="h-full min-h-[340px] w-full"
              />
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">The solve</CardTitle>
                <CardDescription>What the solver computed for this layout.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={activeTrajectory.feasible ? "default" : "destructive"}>
                    {activeTrajectory.feasible ? "Makeable" : "Not on"}
                  </Badge>
                  {mode === "pocket" && (
                    <Badge variant="secondary">cut angle {activeTrajectory.cutAngleDeg}°</Badge>
                  )}
                  <Badge variant="outline">{activeTrajectory.difficulty.replaceAll("_", " ")}</Badge>
                </div>
                {activeTrajectory.notes.map((note, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {note}
                  </p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" /> AI table read
                </CardTitle>
                <CardDescription>
                  Snap your real table and the vision model maps every ball onto the canvas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiResult ? (
                  <>
                    {aiResult.notes && (
                      <p className="text-sm text-muted-foreground">{aiResult.notes}</p>
                    )}
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {aiResult.detections
                        .filter((d) => d.tablePoint)
                        .map((d, i) => (
                          <li key={i}>
                            {d.label === "cue_ball"
                              ? "cue ball"
                              : aiResult.labels?.[i - 1] ?? "object ball"}{" "}
                            → [{d.tablePoint![0].toFixed(0)}, {d.tablePoint![1].toFixed(0)}]
                          </li>
                        ))}
                    </ul>
                    <Badge variant="secondary">
                      {aiResult.usage.uploadsThisMonth}
                      {aiResult.usage.monthlyLimit ? `/${aiResult.usage.monthlyLimit}` : ""} photo
                      reads this month
                    </Badge>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No photo analyzed yet. Stand over the table, get the cue ball and your
                    problem balls in frame, and hit “Photo → table read.” Free tier includes 3
                    reads a month.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {tab === "drills" && (
        <>
          <div className="flex flex-wrap gap-2">
            {DRILLS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDrillKey(d.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  d.key === drillKey
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {d.name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <BilliardCanvasLazy
                cue={drill.layout.cue}
                objects={drill.layout.objects}
                trajectory={null}
                className="h-full min-h-[340px] w-full"
              />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{drill.name}</CardTitle>
                <CardDescription>{drill.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 font-semibold text-foreground">Setup</p>
                  <p className="text-muted-foreground">{drill.setup}</p>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-foreground">Goal</p>
                  <p className="text-muted-foreground">{drill.goal}</p>
                </div>
                <div>
                  <p className="mb-1 font-semibold text-foreground">Scoring</p>
                  <p className="text-muted-foreground">{drill.scoring}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DrillTracker key={drill.key} drill={drill} />
        </>
      )}

      {tab === "systems" && (
        <div className="grid gap-4">
          {SYSTEMS.map((s) => (
            <Card key={s.key}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">
            Try them live: switch to the Shot editor tab and pick “Kick (cue → rail → ball)” —
            the solver draws the mirror-system path for any layout you drag out.
          </p>
        </div>
      )}
    </div>
  );
}

export function RulesClient() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Racking…</div>}>
      <ShotLabInner />
    </Suspense>
  );
}
