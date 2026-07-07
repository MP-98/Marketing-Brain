import { NextResponse } from "next/server";
import { getTodayBriefing } from "@/lib/generation";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await getTodayBriefing(todayISO());
  if (!payload) return NextResponse.json({ exists: false });
  return NextResponse.json({ exists: true, payload });
}
