import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { estimateApr } from "@/lib/finance/apr";
import { refiProjection } from "@/lib/finance/refi";
import { tierFromScore, tierLabel, type Profile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.CARMAN_ADVISOR_MODEL || "claude-opus-4-8";

interface AdvisorRequest {
  profile: Profile;
  question: string;
  context?: string; // optional summary of current results
}

function profileSummary(p: Profile): string {
  const tier = tierFromScore(p.creditScore);
  return [
    `Credit score: ${p.creditScore} (${tierLabel(tier)})`,
    `Down payment available: $${p.downPayment}`,
    `Lender loan cap: ${p.loanCap ? `$${p.loanCap}` : "unknown"}`,
    `Max comfortable monthly payment: $${p.maxMonthlyPayment}`,
    `Location: ${p.zip} (within ${p.radiusMiles} mi)`,
    `Wants: ${p.fuelTypes.join(", ") || "any fuel"}; ${p.bodyStyles.join(", ") || "any body"}; ${p.minSeats}+ seats`,
    `Estimated used-car APR at this tier: ~${estimateApr(tier, "used")}%`,
    p.useCase ? `Use case: ${p.useCase}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM = `You are CarMan, a blunt, honest car-buying and auto-finance advisor for people with thin or damaged credit.
You give specific, practical, numbers-first advice. You never sugarcoat, never upsell, and you flag rip-offs (dealer rate markup, marked-up GAP/warranties, buy-here-pay-here lots).
You understand subprime auto lending: lenders cap how much they finance, rates are high, and the winning play is to buy modestly now and refinance in ~9-12 months once the score recovers.
Keep answers tight and skimmable. Lead with the answer. Use short paragraphs or bullets. Do not include your reasoning process or meta-commentary — give only the final advice.`;

/** Deterministic fallback used when no ANTHROPIC_API_KEY is configured. */
function templatedAnswer(body: AdvisorRequest): string {
  const p = body.profile;
  const tier = tierFromScore(p.creditScore);
  const refi = refiProjection(p.loanCap ?? 13500, p);
  return [
    `Here's my read for your situation (CarMan running in offline mode — add an ANTHROPIC_API_KEY for live answers):`,
    ``,
    `• Your credit tier is **${tierLabel(tier)}**, so expect a used-car APR around **${estimateApr(tier, "used")}%**. That rate, not the car, is your real cost.`,
    `• With ~$${p.downPayment} down${p.loanCap ? ` and a ~$${p.loanCap} loan cap` : ""}, target a car you can actually get approved on rather than the nicest one you can find.`,
    `• Biggest win: make every payment on time, then **refinance in ~${refi.monthsUntilRefi} months** — your score could reach ~${refi.projectedScore}, cutting your rate to ~${refi.projectedApr}% and saving roughly **$${Math.round(refi.interestSaved).toLocaleString()}** in interest.`,
    `• Always get pre-approved before the dealer, refuse add-ons except cheap GAP, and use any money-back return window to get the car inspected.`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: AdvisorRequest;
  try {
    body = (await req.json()) as AdvisorRequest;
    if (!body?.profile?.zip || !body?.question) throw new Error("bad body");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: templatedAnswer(body), source: "template" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const userContent = [
      `My situation:\n${profileSummary(body.profile)}`,
      body.context ? `\nCars I'm currently looking at:\n${body.context}` : "",
      `\nMy question: ${body.question}`,
    ].join("\n");

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const answer = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ answer: answer || "(no answer)", source: "ai", model: MODEL });
  } catch (err) {
    // Fall back to the templated answer rather than failing the request.
    return NextResponse.json({
      answer: templatedAnswer(body),
      source: "template",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
