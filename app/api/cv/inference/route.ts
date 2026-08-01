import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { solveBestShot, solveDirectShot, POCKETS, TABLE } from "@/lib/engine/trajectory";
import { TIER_COOKIE, UPLOAD_COUNT_COOKIE, TIER_LIMITS, parseTier } from "@/lib/tier";
import type { CvDetection, TablePoint } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI table read: the user photographs their real table, Claude vision locates
 * the balls, and the trajectory engine solves the best shot from the detected
 * layout. Requires ANTHROPIC_API_KEY — the endpoint reports plainly when the
 * key is missing instead of faking detections.
 */

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

/** Ball positions normalized to the playing surface: x along the long rail (0-1), y along the short rail (0-1). */
const TABLE_READ_SCHEMA = {
  type: "object" as const,
  properties: {
    table_found: {
      type: "boolean" as const,
      description: "True only if a pool/billiards table with visible balls is in the photo.",
    },
    cue_ball: {
      anyOf: [
        {
          type: "object" as const,
          properties: {
            x: { type: "number" as const, description: "0-1 along the LONG side of the playing surface" },
            y: { type: "number" as const, description: "0-1 along the SHORT side of the playing surface" },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
        { type: "null" as const },
      ],
      description: "The white cue ball, or null if not visible.",
    },
    object_balls: {
      type: "array" as const,
      description: "Every non-cue ball visible on the playing surface, nearest to the cue ball first.",
      items: {
        type: "object" as const,
        properties: {
          x: { type: "number" as const },
          y: { type: "number" as const },
          label: { type: "string" as const, description: "Short description, e.g. '9 ball', 'red stripe'" },
        },
        required: ["x", "y", "label"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "string" as const,
      description: "One sentence on read quality: occlusions, glare, uncertain positions.",
    },
  },
  required: ["table_found", "cue_ball", "object_balls", "notes"],
  additionalProperties: false,
};

interface TableRead {
  table_found: boolean;
  cue_ball: { x: number; y: number } | null;
  object_balls: { x: number; y: number; label: string }[];
  notes: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "AI photo analysis isn't switched on yet — the server needs an Anthropic API key (ANTHROPIC_API_KEY). The Shot Lab solver, drills, and kick systems all work without it.",
      },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  const tier = parseTier(cookieStore.get(TIER_COOKIE)?.value);

  // Free-tier metering: limited AI photo reads per calendar month.
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
        message: `Free tier allows ${limit} AI photo reads per month. Upgrade to Premium for unlimited analysis.`,
        upgradeUrl: "/upgrade",
      },
      { status: 402 }
    );
  }

  let body: { image?: string; mimeType?: string; targetPocket?: keyof typeof POCKETS };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.image || typeof body.image !== "string") {
    return NextResponse.json(
      { error: "missing_image", message: "Expected a base64-encoded photo in `image`." },
      { status: 400 }
    );
  }
  const mediaType = (body.mimeType ?? "image/jpeg") as AllowedMedia;
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return NextResponse.json(
      { error: "unsupported_media", message: "Photos must be JPEG, PNG, or WebP." },
      { status: 415 }
    );
  }

  const client = new Anthropic();

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: "claude-opus-5",
      max_tokens: 2048,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: TABLE_READ_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: body.image } },
            {
              type: "text",
              text: "This is a photo of a pool table. Locate the cue ball and every object ball on the playing surface. Report positions normalized to the cloth: x runs 0→1 along the LONG rails, y runs 0→1 along the SHORT rails, measured from the same corner. Account for the camera's perspective — positions are on the cloth plane, not in the image plane. If there's no table or no visible balls, say so via table_found.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? err.message : "Vision inference failed.";
    return NextResponse.json({ error: "inference_failed", message }, { status: 502 });
  }

  if (response.stop_reason === "refusal") {
    return NextResponse.json(
      { error: "inference_declined", message: "The vision model declined to analyze this photo. Try a clearer shot of just the table." },
      { status: 422 }
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  let read: TableRead;
  try {
    read = JSON.parse(textBlock?.type === "text" ? textBlock.text : "");
  } catch {
    return NextResponse.json(
      { error: "inference_failed", message: "Could not parse the table read. Try again." },
      { status: 502 }
    );
  }

  if (!read.table_found || !read.cue_ball || read.object_balls.length === 0) {
    return NextResponse.json(
      {
        error: "no_table_detected",
        message: read.notes || "No pool table with visible balls found in that photo. Shoot from above the table with the cue and object balls in frame.",
      },
      { status: 422 }
    );
  }

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const toTablePoint = (p: { x: number; y: number }): TablePoint => [
    clamp01(p.x) * TABLE.width,
    clamp01(p.y) * TABLE.height,
  ];

  const cuePoint = toTablePoint(read.cue_ball);
  const detections: CvDetection[] = [
    { label: "cue_ball", confidence: 1, bbox: [0, 0, 0, 0], tablePoint: cuePoint },
    ...read.object_balls.slice(0, 8).map((b) => ({
      label: "object_ball" as const,
      confidence: 1,
      bbox: [0, 0, 0, 0] as [number, number, number, number],
      tablePoint: toTablePoint(b),
    })),
  ];

  const primaryTarget = detections[1].tablePoint!;
  const trajectory =
    body.targetPocket && POCKETS[body.targetPocket]
      ? solveDirectShot(cuePoint, primaryTarget, POCKETS[body.targetPocket])
      : solveBestShot(cuePoint, primaryTarget);

  uploads.count += 1;
  const res = NextResponse.json({
    model: response.model,
    notes: read.notes,
    labels: read.object_balls.slice(0, 8).map((b) => b.label),
    detections,
    trajectory,
    usage: {
      tier,
      uploadsThisMonth: uploads.count,
      monthlyLimit: Number.isFinite(limit) ? limit : null,
    },
  });
  res.cookies.set(UPLOAD_COUNT_COOKIE, JSON.stringify(uploads), {
    path: "/",
    maxAge: 60 * 60 * 24 * 45,
  });
  return res;
}
