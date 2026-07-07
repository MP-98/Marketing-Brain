import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/briefing/archive?q=...   (plain text, or `tag:d2c`)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const supabase = supabaseAdmin();

  let query = supabase
    .from("briefings")
    .select("date, created_at, tags, payload")
    .order("date", { ascending: false })
    .limit(120);

  if (q.startsWith("tag:")) {
    const tag = q.slice(4).trim().toLowerCase();
    if (tag) query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data ?? []).map((r) => ({
    date: r.date as string,
    created_at: r.created_at as string,
    tags: (r.tags ?? []) as string[],
    title: (r.payload?.concept?.title ?? "Briefing") as string,
    theme: (r.payload?.concept?.theme ?? "") as string,
    quick_takeaway: (r.payload?.quick_takeaway ?? "") as string,
  }));

  // Plain-text search across title / theme / takeaway / tags.
  if (q && !q.startsWith("tag:")) {
    const needle = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.theme.toLowerCase().includes(needle) ||
        r.quick_takeaway.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.includes(needle)),
    );
  }

  return NextResponse.json({ entries: rows });
}
