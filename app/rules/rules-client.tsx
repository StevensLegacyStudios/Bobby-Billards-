"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Crosshair, Sparkles } from "lucide-react";

import BilliardCanvasLazy from "@/components/billiards/billiard-canvas-lazy";
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

const PRESETS: {
  name: string;
  cue: TablePoint;
  target: TablePoint;
  pocket: keyof typeof POCKETS | "best";
  bank?: Cushion;
}[] = [
  { name: "Straight in", cue: [56, 90], target: [120, 50], pocket: "top_right" },
  { name: "Thin cut, corner", cue: [50, 80], target: [150, 30], pocket: "top_right" },
  { name: "Side pocket cut", cue: [30, 30], target: [95, 60], pocket: "bottom_mid" },
  { name: "One-rail bank", cue: [150, 20], target: [110, 60], pocket: "top_left", bank: "bottom" },
  { name: "Solver's choice", cue: [25, 75], target: [170, 25], pocket: "best" },
];

const POCKET_LABELS: Record<string, string> = {
  top_left: "Top left",
  top_mid: "Top side",
  top_right: "Top right",
  bottom_left: "Bottom left",
  bottom_mid: "Bottom side",
  bottom_right: "Bottom right",
};

export function RulesClient() {
  const [presetIdx, setPresetIdx] = useState(0);
  const [aiResult, setAiResult] = useState<{
    detections: CvDetection[];
    trajectory: TrajectoryPayload;
    usage: { uploadsThisMonth: number; monthlyLimit: number | null };
  } | null>(null);
  const [aiError, setAiError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const preset = PRESETS[presetIdx];
  const solved = useMemo(() => {
    if (preset.bank) {
      return solveBankShot(preset.cue, preset.target, POCKETS[preset.pocket as string], preset.bank);
    }
    if (preset.pocket === "best") return solveBestShot(preset.cue, preset.target);
    return solveDirectShot(preset.cue, preset.target, POCKETS[preset.pocket]);
  }, [preset]);

  // When the AI engine has produced a result, render its table read instead.
  const activeCue = aiResult
    ? aiResult.detections.find((d) => d.label === "cue_ball")?.tablePoint ?? preset.cue
    : preset.cue;
  const activeObjects = aiResult
    ? aiResult.detections.filter((d) => d.label === "object_ball").map((d) => d.tablePoint!)
    : [preset.target];
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
          <Crosshair className="h-6 w-6 text-primary" /> 3D Practice &amp; AI Shot Engine
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The trajectory solver computes ghost-ball contacts and mirror-law bank reflections
          on a tournament 2:1 slate. Feed it a preset — or a camera frame.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={p.name}
            onClick={() => {
              setPresetIdx(i);
              setAiResult(null);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              i === presetIdx && !aiResult
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

      <Card className="overflow-hidden">
        <BilliardCanvasLazy
          cue={activeCue}
          objects={activeObjects}
          trajectory={activeTrajectory}
        />
      </Card>

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
              YOLOv8 detections projected through the homography layer onto the 200×100 canvas.
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
                No frame analyzed yet. Free tier includes 3 AI shot uploads per month —{" "}
                {POCKET_LABELS.top_right ? "then" : ""} Premium unlocks unlimited analysis and
                the pro camera module.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
