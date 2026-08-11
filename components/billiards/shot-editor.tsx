"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { OBJECT_BALL_COLORS, POCKETS } from "@/lib/engine/trajectory";
import type { TablePoint, TrajectoryPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Top-down drag-and-drop shot editor on the canonical 2:1 slate canvas
 * (X ∈ [0,200], Y ∈ [0,100]). Drag the cue ball and any number of object
 * balls to mirror your real table; tap a ball to make it the one the
 * solver aims at. The parent solves the active ball's trajectory and
 * renders it (2D here, 3D alongside).
 */

export interface ShotLayout {
  cue: TablePoint;
  /** Every object ball on the table — real tables rarely have just one. */
  objects: TablePoint[];
  /** Index into `objects` the solver is currently aiming at. */
  activeBall: number;
  pocket: keyof typeof POCKETS | "best";
}

const VIEW_W = 200;
const VIEW_H = 100;
const BALL_R = 2.85;
const MARGIN = 8;
const MAX_BALLS = 8;

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

type DragTarget = "cue" | number;

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
  const [dragging, setDragging] = useState<DragTarget | null>(null);

  // Raw pointermove fires far faster than the screen can redraw (100+/sec on
  // some phones) — recomputing the trajectory solver and re-rendering the 3D
  // scene on every single event causes visible tearing/flicker while
  // dragging. Coalesce to at most one update per animation frame.
  const draggingRef = useRef(dragging);
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const rafRef = useRef<number | null>(null);
  const pendingPointRef = useRef<TablePoint | null>(null);

  const toTablePoint = useCallback((clientX: number, clientY: number): TablePoint => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * (VIEW_W + MARGIN * 2) - MARGIN;
    const y = ((clientY - rect.top) / rect.height) * (VIEW_H + MARGIN * 2) - MARGIN;
    return clampPoint([x, y]);
  }, []);

  const flushPendingPoint = useCallback(() => {
    rafRef.current = null;
    const point = pendingPointRef.current;
    const drag = draggingRef.current;
    if (!point || drag === null) return;
    const current = layoutRef.current;
    if (drag === "cue") {
      onChange({ ...current, cue: point });
    } else {
      const objects = current.objects.slice();
      objects[drag] = point;
      onChange({ ...current, objects });
    }
  }, [onChange]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingRef.current === null) return;
      pendingPointRef.current = toTablePoint(e.clientX, e.clientY);
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPendingPoint);
      }
    },
    [toTablePoint, flushPendingPoint]
  );

  const stopDragging = useCallback(() => {
    setDragging(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPointRef.current = null;
  }, []);

  const addBall = useCallback(() => {
    if (layout.objects.length >= MAX_BALLS) return;
    // Drop the new ball near the center, offset a bit per existing ball so
    // it doesn't land exactly on top of another one.
    const n = layout.objects.length;
    const point: TablePoint = clampPoint([100 + ((n * 13) % 40) - 20, 50 + ((n * 17) % 30) - 15]);
    onChange({ ...layout, objects: [...layout.objects, point], activeBall: n });
  }, [layout, onChange]);

  const removeBall = useCallback(
    (index: number) => {
      if (layout.objects.length <= 1) return;
      const objects = layout.objects.filter((_, i) => i !== index);
      const activeBall = layout.activeBall >= objects.length ? objects.length - 1 : layout.activeBall === index ? Math.max(0, index - 1) : layout.activeBall > index ? layout.activeBall - 1 : layout.activeBall;
      onChange({ ...layout, objects, activeBall });
    },
    [layout, onChange]
  );

  return (
    <div className="space-y-3">
      <svg
        ref={svgRef}
        viewBox={`${-MARGIN} ${-MARGIN} ${VIEW_W + MARGIN * 2} ${VIEW_H + MARGIN * 2}`}
        className="w-full touch-none select-none rounded-lg"
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerLeave={stopDragging}
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

        {/* object balls */}
        {layout.objects.map((point, i) => {
          const active = i === layout.activeBall;
          return (
            <circle
              key={i}
              cx={point[0]}
              cy={point[1]}
              r={active ? BALL_R + 1.6 : BALL_R + 1.2}
              fill={OBJECT_BALL_COLORS[i % OBJECT_BALL_COLORS.length]}
              stroke={active ? "#facc15" : "#00000055"}
              strokeWidth={active ? 0.8 : 0.5}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDragging(i);
                if (!active) onChange({ ...layout, activeBall: i });
              }}
            />
          );
        })}

        {/* cue ball */}
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Object balls:</span>
        {layout.objects.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange({ ...layout, activeBall: i })}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
              i === layout.activeBall
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: OBJECT_BALL_COLORS[i % OBJECT_BALL_COLORS.length] }}
            />
            {i + 1}
            {layout.objects.length > 1 && (
              <X
                className="h-3 w-3 opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBall(i);
                }}
              />
            )}
          </button>
        ))}
        {layout.objects.length < MAX_BALLS && (
          <button
            type="button"
            onClick={addBall}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add ball
          </button>
        )}
      </div>

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
          ? "Drag the white cue ball and any object ball to match your table. Tap a numbered ball to aim the solver at it, then pick a pocket (or let it choose)."
          : "Drag the balls to match your table — the solver finds the kick path off the chosen rail."}
      </p>
    </div>
  );
}
