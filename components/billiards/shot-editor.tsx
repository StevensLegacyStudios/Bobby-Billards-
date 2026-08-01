"use client";

import { useCallback, useRef, useState } from "react";

import { POCKETS } from "@/lib/engine/trajectory";
import type { TablePoint, TrajectoryPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Top-down drag-and-drop shot editor on the canonical 2:1 slate canvas
 * (X ∈ [0,200], Y ∈ [0,100]). Drag the cue and object balls to mirror your
 * real table; the parent solves and renders the trajectory.
 */

export interface ShotLayout {
  cue: TablePoint;
  target: TablePoint;
  pocket: keyof typeof POCKETS | "best";
}

const VIEW_W = 200;
const VIEW_H = 100;
const BALL_R = 2.85;
const MARGIN = 8;

const POCKET_KEYS = Object.keys(POCKETS) as (keyof typeof POCKETS)[];

function clampPoint([x, y]: TablePoint): TablePoint {
  return [
    Math.min(VIEW_W - BALL_R, Math.max(BALL_R, x)),
    Math.min(VIEW_H - BALL_R, Math.max(BALL_R, y)),
  ];
}

const SEGMENT_COLORS: Record<string, string> = {
  cue_travel: "#facc15",
  ghost_aim: "#94a3b8",
  object_travel: "#fb923c",
  bank_reflection: "#22d3ee",
};

export function ShotEditor({
  layout,
  trajectory,
  onChange,
  pocketsSelectable = true,
}: {
  layout: ShotLayout;
  trajectory: TrajectoryPayload | null;
  onChange: (next: ShotLayout) => void;
  pocketsSelectable?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"cue" | "target" | null>(null);

  const toTablePoint = useCallback((clientX: number, clientY: number): TablePoint => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * (VIEW_W + MARGIN * 2) - MARGIN;
    const y = ((clientY - rect.top) / rect.height) * (VIEW_H + MARGIN * 2) - MARGIN;
    return clampPoint([x, y]);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const point = toTablePoint(e.clientX, e.clientY);
      onChange(
        dragging === "cue" ? { ...layout, cue: point } : { ...layout, target: point }
      );
    },
    [dragging, layout, onChange, toTablePoint]
  );

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        viewBox={`${-MARGIN} ${-MARGIN} ${VIEW_W + MARGIN * 2} ${VIEW_H + MARGIN * 2}`}
        className="w-full touch-none select-none rounded-lg"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        {/* rails + slate */}
        <rect x={-MARGIN} y={-MARGIN} width={VIEW_W + MARGIN * 2} height={VIEW_H + MARGIN * 2} rx={4} fill="#78350f" />
        <rect x={-2} y={-2} width={VIEW_W + 4} height={VIEW_H + 4} fill="#14532d" />
        <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#166534" />
        {/* head string */}
        <line x1={50} y1={0} x2={50} y2={VIEW_H} stroke="#15803d" strokeWidth={0.6} />

        {/* pockets */}
        {POCKET_KEYS.map((key) => {
          const [px, py] = POCKETS[key];
          const selected = pocketsSelectable && layout.pocket === key;
          return (
            <circle
              key={key}
              cx={px}
              cy={py}
              r={selected ? 6.5 : 5}
              fill={selected ? "#0a0a0a" : "#111827"}
              stroke={selected ? "#facc15" : "transparent"}
              strokeWidth={1.5}
              className={pocketsSelectable ? "cursor-pointer" : undefined}
              onClick={pocketsSelectable ? () => onChange({ ...layout, pocket: key }) : undefined}
            />
          );
        })}

        {/* trajectory */}
        {trajectory?.segments.map((seg, i) => (
          <line
            key={i}
            x1={seg.from[0]}
            y1={seg.from[1]}
            x2={seg.to[0]}
            y2={seg.to[1]}
            stroke={SEGMENT_COLORS[seg.kind] ?? "#fff"}
            strokeWidth={1.1}
            strokeDasharray={seg.kind === "ghost_aim" ? "2 2" : undefined}
            strokeLinecap="round"
          />
        ))}

        {/* balls */}
        <circle
          cx={layout.target[0]}
          cy={layout.target[1]}
          r={BALL_R + 1.2}
          fill="#dc2626"
          stroke="#7f1d1d"
          strokeWidth={0.5}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging("target");
          }}
        />
        <circle
          cx={layout.cue[0]}
          cy={layout.cue[1]}
          r={BALL_R + 1.2}
          fill="#fafafa"
          stroke="#a1a1aa"
          strokeWidth={0.5}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setDragging("cue");
          }}
        />
      </svg>

      {pocketsSelectable && (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Pocket:</span>
        <button
          type="button"
          onClick={() => onChange({ ...layout, pocket: "best" })}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium",
            layout.pocket === "best"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          Auto (best)
        </button>
        {POCKET_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...layout, pocket: key })}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              layout.pocket === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {key.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      )}
      <p className="text-xs text-muted-foreground">
        {pocketsSelectable
          ? "Drag the white cue ball and red object ball to match your table, then pick a pocket (or let the solver choose)."
          : "Drag the balls to match your table — the solver finds the kick path off the chosen rail."}
      </p>
    </div>
  );
}
