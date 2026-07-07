import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Top tags across the archive, with counts (drives the chip shortcuts).
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("briefings")
    .select("tags")
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    for (const t of (row.tags ?? []) as string[]) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return NextResponse.json({ tags });
}
