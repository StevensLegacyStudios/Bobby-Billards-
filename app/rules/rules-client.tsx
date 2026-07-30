"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Check, Crosshair, Link2, Sparkles } from "lucide-react";

import BilliardCanvasLazy from "@/components/billiards/billiard-canvas-lazy";
import { ShotEditor, type ShotLayout } from "@/components/billiards/shot-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  POCKETS,
  solveBankShot,
  solveBestShot,
  solveDirectShot,
  type Cushion,
} from "@/lib/engine/trajectory";
import { cn } from "@/lib/utils";
import type { CvDetection, TablePoint, TrajectoryPayload } from "@/lib/types";

type EditorState = ShotLayout & { bank?: Cushion };

const PRESETS: { name: string; state: EditorState }[] = [
  { name: "Straight in", state: { cue: [56, 90], target: [120, 50], pocket: "top_right" } },
  { name: "Thin cut, corner", state: { cue: [50, 80], target: [150, 30], pocket: "top_right" } },
  { name: "Side pocket cut", state: { cue: [30, 30], target: [95, 60], pocket: "bottom_mid" } },
  {
    name: "One-rail bank",
    state: { cue: [150, 20], target: [110, 60], pocket: "top_left", bank: "bottom" },
  },
  { name: "Solver's choice", state: { cue: [25, 75], target: [170, 25], pocket: "best" } },
];

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

function RulesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editor, setEditor] = useState<EditorState>(PRESETS[0].state);
  const [activePreset, setActivePreset] = useState<number | null>(0);
  const [copied, setCopied] = useState(false);
  const [aiResult, setAiResult] = useState<{
    detections: CvDetection[];
    trajectory: TrajectoryPayload;
    usage: { uploadsThisMonth: number; monthlyLimit: number | null };
  } | null>(null);
  const [aiError, setAiError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
    if (editor.bank) {
      return solveBankShot(editor.cue, editor.target, POCKETS[editor.pocket as string], editor.bank);
    }
    if (editor.pocket === "best") return solveBestShot(editor.cue, editor.target);
    return solveDirectShot(editor.cue, editor.target, POCKETS[editor.pocket]);
  }, [editor]);

  const updateEditor = useCallback((next: ShotLayout) => {
    setEditor((prev) => ({ ...next, bank: prev.bank && next.pocket === prev.pocket ? prev.bank : undefined }));
    setActivePreset(null);
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

  // When the AI engine has produced a result, render its table read instead.
  const activeCue = aiResult
    ? aiResult.detections.find((d) => d.label === "cue_ball")?.tablePoint ?? editor.cue
    : editor.cue;
  const activeObjects = aiResult
    ? aiResult.detections.filter((d) => d.label === "object_ball").map((d) => d.tablePoint!)
    : [editor.target];
  const activeTrajectory = aiResult ? aiResult.trajectory : solved;

  /**
   * Capture a mock camera frame: draws a table-like scene onto an offscreen
   * canvas, compresses it to 640x640 WebP, and ships it to the inference
   * worker — the exact payload shape the native camera module produces.
   */
  const analyzeFrame = useCallback(async () => {
    setAnalyzing(true);
    setAiError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, 640, 640);
      ctx.fillStyle = "#15803d";
      ctx.beginPath();
      ctx.moveTo(110 + Math.random() * 20, 180);
      ctx.lineTo(530 - Math.random() * 20, 180);
      ctx.lineTo(600, 500);
      ctx.lineTo(40, 500);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ["#fafafa", "#dc2626", "#2563eb", "#facc15"][i];
        ctx.beginPath();
        ctx.arc(160 + Math.random() * 320, 240 + Math.random() * 220, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      const dataUrl = canvas.toDataURL("image/webp", 0.8);
      const frame = dataUrl.split(",")[1];

      const res = await fetch("/api/cv/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame, mimeType: "image/webp", width: 640, height: 640 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError({
          message: data.message ?? "Inference failed.",
          upgrade: res.status === 402,
        });
        return;
      }
      setAiResult(data);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Crosshair className="h-6 w-6 text-primary" /> Shot Lab
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up any layout — drag the balls to match your real table — and the solver
          computes the make: ghost-ball contact, cut angle, banks. Share a shot and ask
          your league how they&apos;d play it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => {
              setEditor(p.state);
              setActivePreset(i);
              setAiResult(null);
            }}
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
        <Button size="sm" variant="outline" onClick={analyzeFrame} disabled={analyzing}>
          <Camera /> {analyzing ? "Analyzing…" : "Analyze camera frame (AI)"}
        </Button>
        <Button size="sm" variant="outline" onClick={shareShot}>
          {copied ? <Check /> : <Link2 />} {copied ? "Link copied!" : "Share this shot"}
        </Button>
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
            <CardDescription>Top-down view — drag balls, tap a pocket.</CardDescription>
          </CardHeader>
          <CardContent>
            <ShotEditor layout={editor} trajectory={solved} onChange={updateEditor} />
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
            <CardTitle className="text-base">Trajectory payload</CardTitle>
            <CardDescription>Vector line coordinates returned by the solver.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={activeTrajectory.feasible ? "default" : "destructive"}>
                {activeTrajectory.feasible ? "Feasible" : "Not feasible"}
              </Badge>
              <Badge variant="secondary">cut angle {activeTrajectory.cutAngleDeg}°</Badge>
              <Badge variant="outline">{activeTrajectory.difficulty.replaceAll("_", " ")}</Badge>
            </div>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              {activeTrajectory.segments.map((seg, i) => (
                <li key={i}>
                  {seg.kind}: [{seg.from[0].toFixed(1)}, {seg.from[1].toFixed(1)}] → [
                  {seg.to[0].toFixed(1)}, {seg.to[1].toFixed(1)}]
                </li>
              ))}
            </ul>
            {activeTrajectory.notes.map((note, i) => (
              <p key={i} className="text-xs text-muted-foreground">
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
              Detections projected through the homography layer onto the 200×100 canvas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiResult ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Detections</Label>
                  <ul className="space-y-1 font-mono text-xs text-muted-foreground">
                    {aiResult.detections.map((d, i) => (
                      <li key={i}>
                        {d.label} ({(d.confidence * 100).toFixed(0)}%)
                        {d.tablePoint &&
                          ` → table [${d.tablePoint[0].toFixed(1)}, ${d.tablePoint[1].toFixed(1)}]`}
                      </li>
                    ))}
                  </ul>
                </div>
                <Badge variant="secondary">
                  {aiResult.usage.uploadsThisMonth}
                  {aiResult.usage.monthlyLimit ? `/${aiResult.usage.monthlyLimit}` : ""} uploads
                  this month
                </Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No frame analyzed yet. Free tier includes 3 AI shot uploads per month —
                Premium unlocks unlimited analysis and the pro camera module.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function RulesClient() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Racking…</div>}>
      <RulesInner />
    </Suspense>
  );
}
