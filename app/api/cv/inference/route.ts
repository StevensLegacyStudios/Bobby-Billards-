import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  clampToSlate,
  projectPoint,
  solveHomography,
  SLATE_CORNERS,
  type PixelPoint,
} from "@/lib/engine/homography";
import { solveBestShot, solveDirectShot, POCKETS } from "@/lib/engine/trajectory";
import { TIER_COOKIE, UPLOAD_COUNT_COOKIE, TIER_LIMITS, parseTier } from "@/lib/tier";
import type { CvDetection, TablePoint } from "@/lib/types";

export const runtime = "nodejs";

const FRAME_SIZE = 640;

/**
 * Multi-Modal AI Shot Engine inference endpoint.
 *
 * Mimics the payload contract of the serverless YOLOv8 worker: accepts a
 * compressed 640x640 WebP frame from the browser camera, runs (mock) ball
 * detection, projects detections through the homography layer onto the 2:1
 * slate canvas, and returns the optimal trajectory vector payload.
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const tier = parseTier(cookieStore.get(TIER_COOKIE)?.value);

  // Free-tier metering: 3 AI shot uploads per calendar month.
  const month = new Date().toISOString().slice(0, 7);
  let uploads = { month, count: 0 };
  try {
    const raw = cookieStore.get(UPLOAD_COUNT_COOKIE)?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.month === month) uploads = parsed;
    }
  } catch {
    // Malformed cookie — reset the counter.
  }

  const limit = TIER_LIMITS[tier].aiShotUploadsPerMonth;
  if (uploads.count >= limit) {
    return NextResponse.json(
      {
        error: "free_tier_limit_reached",
        message: `Free tier allows ${limit} AI shot uploads per month. Upgrade to Premium for unlimited analysis.`,
        upgradeUrl: "/upgrade",
      },
      { status: 402 }
    );
  }

  let body: {
    frame?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    corners?: PixelPoint[];
    targetPocket?: keyof typeof POCKETS;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.frame || typeof body.frame !== "string") {
    return NextResponse.json(
      { error: "missing_frame", message: "Expected a base64-encoded WebP frame in `frame`." },
      { status: 400 }
    );
  }
  if (body.mimeType && body.mimeType !== "image/webp") {
    return NextResponse.json(
      { error: "unsupported_media", message: "Frames must be compressed WebP (image/webp)." },
      { status: 415 }
    );
  }
  if ((body.width ?? FRAME_SIZE) !== FRAME_SIZE || (body.height ?? FRAME_SIZE) !== FRAME_SIZE) {
    return NextResponse.json(
      { error: "bad_dimensions", message: `Frames must be normalized to ${FRAME_SIZE}x${FRAME_SIZE}px.` },
      { status: 400 }
    );
  }

  // --- Mock YOLOv8 detection pass -----------------------------------------
  // Deterministic pseudo-detections seeded from the frame bytes so the same
  // upload always yields the same table read.
  const seed = fnv1a(body.frame);
  const rand = mulberry32(seed);

  // Table corners in the angled camera frame: either provided by the client's
  // corner-tap calibration or defaulted to a plausible perspective trapezoid.
  const corners: PixelPoint[] =
    body.corners && body.corners.length === 4
      ? body.corners
      : [
          [96 + rand() * 24, 160 + rand() * 30],
          [544 - rand() * 24, 160 + rand() * 30],
          [608 - rand() * 16, 480 + rand() * 40],
          [32 + rand() * 16, 480 + rand() * 40],
        ];

  const H = solveHomography(corners, SLATE_CORNERS);

  const detections: CvDetection[] = corners.map((c) => ({
    label: "table_corner",
    confidence: 0.97 + rand() * 0.02,
    bbox: [c[0] - 6, c[1] - 6, 12, 12],
  }));

  const samplePixelInsideTable = (): PixelPoint => {
    // Bilinear sample inside the corner quad.
    const u = 0.12 + rand() * 0.76;
    const v = 0.12 + rand() * 0.76;
    const top: PixelPoint = [
      corners[0][0] + (corners[1][0] - corners[0][0]) * u,
      corners[0][1] + (corners[1][1] - corners[0][1]) * u,
    ];
    const bottom: PixelPoint = [
      corners[3][0] + (corners[2][0] - corners[3][0]) * u,
      corners[3][1] + (corners[2][1] - corners[3][1]) * u,
    ];
    return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
  };

  const cuePixel = samplePixelInsideTable();
  const cuePoint = clampToSlate(projectPoint(H, cuePixel));
  detections.push({
    label: "cue_ball",
    confidence: 0.9 + rand() * 0.09,
    bbox: [cuePixel[0] - 11, cuePixel[1] - 11, 22, 22],
    tablePoint: cuePoint,
  });

  const objectCount = 1 + Math.floor(rand() * 3);
  const objectPoints: TablePoint[] = [];
  for (let i = 0; i < objectCount; i++) {
    const px = samplePixelInsideTable();
    const tp = clampToSlate(projectPoint(H, px));
    objectPoints.push(tp);
    detections.push({
      label: "object_ball",
      confidence: 0.85 + rand() * 0.13,
      bbox: [px[0] - 11, px[1] - 11, 22, 22],
      tablePoint: tp,
    });
  }

  // --- Trajectory solve -----------------------------------------------------
  const primaryTarget = objectPoints[0];
  const trajectory =
    body.targetPocket && POCKETS[body.targetPocket]
      ? solveDirectShot(cuePoint, primaryTarget, POCKETS[body.targetPocket])
      : solveBestShot(cuePoint, primaryTarget);

  uploads.count += 1;
  const response = NextResponse.json({
    model: "bobby-billiards-yolov8n-table/2.1.0",
    frame: { width: FRAME_SIZE, height: FRAME_SIZE, format: "webp" },
    homography: H,
    detections,
    trajectory,
    usage: {
      tier,
      uploadsThisMonth: uploads.count,
      monthlyLimit: Number.isFinite(limit) ? limit : null,
    },
  });
  response.cookies.set(UPLOAD_COUNT_COOKIE, JSON.stringify(uploads), {
    path: "/",
    maxAge: 60 * 60 * 24 * 45,
  });
  return response;
}

/** FNV-1a 32-bit hash for deterministic mock seeding. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  const step = Math.max(1, Math.floor(input.length / 2048));
  for (let i = 0; i < input.length; i += step) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
