import { NextResponse } from "next/server";
import { runAudit, PLATFORMS, type Platform } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { draft, platform } = await req.json();
  if (!draft?.trim()) {
    return NextResponse.json({ error: "draft is required" }, { status: 400 });
  }
  const target: Platform = PLATFORMS.includes(platform) ? platform : "LinkedIn personal";

  try {
    const result = await runAudit(draft, target);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
