import { NextResponse } from "next/server";
import { buildPrivateSellerLinks } from "@/lib/privateLinks";
import type { Profile } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { profile } = (await req.json()) as { profile: Profile };
    if (!profile?.zip) throw new Error("missing profile");
    return NextResponse.json({ links: buildPrivateSellerLinks(profile) });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
