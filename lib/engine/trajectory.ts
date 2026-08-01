/**
 * Vector Trajectory Generator.
 *
 * Pure geometric solver on the canonical 2:1 slate canvas (X ∈ [0, 200],
 * Y ∈ [0, 100]). Direct shots use ghost-ball aiming; bank shots reflect the
 * pocket across a cushion so the incident angle equals the reflection angle
 * (θᵢ = θᵣ) at the rail contact point.
 */

import type { TablePoint, TrajectoryPayload, TrajectorySegment } from "@/lib/types";

export const TABLE = { width: 200, height: 100, ballRadius: 2.85 } as const;

/** The six pockets of the canonical table. */
export const POCKETS: Record<string, TablePoint> = {
  top_left: [0, 0],
  top_mid: [100, 0],
  top_right: [200, 0],
  bottom_left: [0, 100],
  bottom_mid: [100, 100],
  bottom_right: [200, 100],
};

export type Cushion = "top" | "bottom" | "left" | "right";

const sub = (a: TablePoint, b: TablePoint): TablePoint => [a[0] - b[0], a[1] - b[1]];
const len = (v: TablePoint) => Math.hypot(v[0], v[1]);
const norm = (v: TablePoint): TablePoint => {
  const l = len(v);
  return l === 0 ? [0, 0] : [v[0] / l, v[1] / l];
};
const dot = (a: TablePoint, b: TablePoint) => a[0] * b[0] + a[1] * b[1];

/**
 * Ghost-ball aim point: the cue ball center at contact, one ball diameter
 * behind the object ball along the pocket line.
 */
export function ghostBallPoint(target: TablePoint, pocket: TablePoint): TablePoint {
  const toPocket = norm(sub(pocket, target));
  const d = 2 * TABLE.ballRadius;
  return [target[0] - toPocket[0] * d, target[1] - toPocket[1] * d];
}

/**
 * Solve a direct shot: cue ball → ghost-ball contact point, object ball →
 * pocket. Returns the full vector polyline plus cut-angle diagnostics.
 */
export function solveDirectShot(
  cue: TablePoint,
  target: TablePoint,
  pocket: TablePoint
): TrajectoryPayload {
  const notes: string[] = [];
  const ghost = ghostBallPoint(target, pocket);

  const cueToGhost = norm(sub(ghost, cue));
  const targetToPocket = norm(sub(pocket, target));

  // Cut angle between the cue ball's travel line and the object ball's
  // departure line. 0° is dead straight; > 80° is effectively unmakeable.
  const cosCut = Math.max(-1, Math.min(1, dot(cueToGhost, targetToPocket)));
  const cutAngleDeg = (Math.acos(cosCut) * 180) / Math.PI;

  // The cue ball must reach the ghost point from in FRONT of the contact —
  // a cut angle beyond 90° means the cue ball is on the wrong side.
  const feasible = cutAngleDeg < 90 && len(sub(ghost, cue)) > 2 * TABLE.ballRadius;
  if (!feasible) {
    notes.push(
      cutAngleDeg >= 90
        ? "Cue ball is on the wrong side of the object ball for this pocket — consider a bank."
        : "Cue ball is frozen to the object ball."
    );
  }

  let difficulty: TrajectoryPayload["difficulty"] = "easy";
  if (cutAngleDeg > 30) difficulty = "moderate";
  if (cutAngleDeg > 55) difficulty = "hard";
  if (cutAngleDeg > 75) difficulty = "very_hard";
  if (cutAngleDeg > 55) notes.push("Thin cut — favor outside english and a firm stroke.");

  const segments: TrajectorySegment[] = [
    { from: cue, to: ghost, kind: "cue_travel" },
    { from: ghost, to: target, kind: "ghost_aim" },
    { from: target, to: pocket, kind: "object_travel" },
  ];

  return { segments, cutAngleDeg: round2(cutAngleDeg), feasible, difficulty, notes };
}

/** Mirror a point across a cushion line (the ball-center rail line, inset by one radius). */
export function reflectAcrossCushion(point: TablePoint, cushion: Cushion): TablePoint {
  const r = TABLE.ballRadius;
  switch (cushion) {
    case "top":
      return [point[0], 2 * r - point[1]];
    case "bottom":
      return [point[0], 2 * (TABLE.height - r) - point[1]];
    case "left":
      return [2 * r - point[0], point[1]];
    case "right":
      return [2 * (TABLE.width - r) - point[0], point[1]];
  }
}

/**
 * Solve a one-rail bank: the object ball travels target → cushion contact →
 * pocket. The contact point is found by mirroring the pocket across the
 * cushion, which guarantees the incident angle equals the reflection angle.
 */
export function solveBankShot(
  cue: TablePoint,
  target: TablePoint,
  pocket: TablePoint,
  cushion: Cushion
): TrajectoryPayload {
  const mirrored = reflectAcrossCushion(pocket, cushion);
  const dir = sub(mirrored, target);

  // Intersect the target→mirrored-pocket line with the cushion contact line.
  const r = TABLE.ballRadius;
  let t: number;
  if (cushion === "top" || cushion === "bottom") {
    const railY = cushion === "top" ? r : TABLE.height - r;
    t = dir[1] === 0 ? -1 : (railY - target[1]) / dir[1];
  } else {
    const railX = cushion === "left" ? r : TABLE.width - r;
    t = dir[0] === 0 ? -1 : (railX - target[0]) / dir[0];
  }

  if (t <= 0 || t >= 1) {
    return {
      segments: [],
      cutAngleDeg: 0,
      feasible: false,
      difficulty: "very_hard",
      notes: [`No valid ${cushion}-rail reflection path from this layout.`],
    };
  }

  const contact: TablePoint = [target[0] + dir[0] * t, target[1] + dir[1] * t];
  const ghost = ghostBallPoint(target, contact);
  const cueToGhost = norm(sub(ghost, cue));
  const targetToContact = norm(sub(contact, target));
  const cosCut = Math.max(-1, Math.min(1, dot(cueToGhost, targetToContact)));
  const cutAngleDeg = (Math.acos(cosCut) * 180) / Math.PI;
  const feasible = cutAngleDeg < 90;

  const segments: TrajectorySegment[] = [
    { from: cue, to: ghost, kind: "cue_travel" },
    { from: ghost, to: target, kind: "ghost_aim" },
    { from: target, to: contact, kind: "object_travel" },
    { from: contact, to: pocket, kind: "bank_reflection" },
  ];

  return {
    segments,
    cutAngleDeg: round2(cutAngleDeg),
    feasible,
    difficulty: cutAngleDeg > 40 ? "very_hard" : "hard",
    notes: [
      `One-rail bank off the ${cushion} cushion; incident angle mirrors reflection angle at [${round2(contact[0])}, ${round2(contact[1])}].`,
      ...(feasible ? [] : ["Cue ball cannot reach the required contact from its current position."]),
    ],
  };
}

/**
 * Solve a one-rail kick: the CUE ball travels cue → cushion → object ball.
 * Uses the mirror (equal-distance) system — reflect the target across the
 * cushion's ball-center line and shoot straight at the reflection, which
 * guarantees θᵢ = θᵣ at the rail. Most accurate with a rolling center-ball
 * hit at medium speed; sidespin breaks the system.
 */
export function solveKickShot(
  cue: TablePoint,
  target: TablePoint,
  cushion: Cushion
): TrajectoryPayload {
  const mirrored = reflectAcrossCushion(target, cushion);
  const dir = sub(mirrored, cue);

  const r = TABLE.ballRadius;
  let t: number;
  if (cushion === "top" || cushion === "bottom") {
    const railY = cushion === "top" ? r : TABLE.height - r;
    t = dir[1] === 0 ? -1 : (railY - cue[1]) / dir[1];
  } else {
    const railX = cushion === "left" ? r : TABLE.width - r;
    t = dir[0] === 0 ? -1 : (railX - cue[0]) / dir[0];
  }

  if (t <= 0 || t >= 1) {
    return {
      segments: [],
      cutAngleDeg: 0,
      feasible: false,
      difficulty: "very_hard",
      notes: [`No valid ${cushion}-rail kick path from this layout.`],
    };
  }

  const contact: TablePoint = [cue[0] + dir[0] * t, cue[1] + dir[1] * t];
  const travel = len(sub(contact, cue)) + len(sub(target, contact));
  const difficulty: TrajectoryPayload["difficulty"] =
    travel < 120 ? "moderate" : travel < 220 ? "hard" : "very_hard";

  return {
    segments: [
      { from: cue, to: contact, kind: "cue_travel" },
      { from: contact, to: target, kind: "bank_reflection" },
    ],
    cutAngleDeg: 0,
    feasible: true,
    difficulty,
    notes: [
      `Mirror-system kick off the ${cushion} rail — aim at the target's reflection; contact at [${round2(contact[0])}, ${round2(contact[1])}].`,
      "Use a rolling cue ball, center hit, medium speed. Firm speed shortens the rebound angle; sidespin breaks the mirror.",
    ],
  };
}

/** Try all four cushions and return the shortest feasible kick path. */
export function solveBestKick(cue: TablePoint, target: TablePoint): TrajectoryPayload {
  let best: TrajectoryPayload | null = null;
  let bestLen = Number.POSITIVE_INFINITY;
  for (const cushion of ["top", "bottom", "left", "right"] as Cushion[]) {
    const shot = solveKickShot(cue, target, cushion);
    if (!shot.feasible) continue;
    const pathLen = shot.segments.reduce((sum, s) => sum + len(sub(s.to, s.from)), 0);
    if (pathLen < bestLen) {
      best = shot;
      bestLen = pathLen;
    }
  }
  return (
    best ?? {
      segments: [],
      cutAngleDeg: 0,
      feasible: false,
      difficulty: "very_hard",
      notes: ["No one-rail kick reaches the target from here."],
    }
  );
}

/**
 * Pick the best pocket for a layout: try every direct pocket, fall back to
 * one-rail banks, and return the lowest-difficulty feasible trajectory.
 */
export function solveBestShot(cue: TablePoint, target: TablePoint): TrajectoryPayload {
  const rank = { easy: 0, moderate: 1, hard: 2, very_hard: 3 };
  let best: TrajectoryPayload | null = null;

  for (const pocket of Object.values(POCKETS)) {
    const shot = solveDirectShot(cue, target, pocket);
    if (shot.feasible && (!best || rank[shot.difficulty] < rank[best.difficulty])) {
      best = shot;
    }
  }
  if (best) return best;

  for (const pocket of Object.values(POCKETS)) {
    for (const cushion of ["top", "bottom", "left", "right"] as Cushion[]) {
      const shot = solveBankShot(cue, target, pocket, cushion);
      if (shot.feasible && (!best || shot.cutAngleDeg < best.cutAngleDeg)) {
        best = shot;
      }
    }
  }

  return (
    best ?? {
      segments: [],
      cutAngleDeg: 0,
      feasible: false,
      difficulty: "very_hard",
      notes: ["No feasible direct or one-rail trajectory found — play safe."],
    }
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
