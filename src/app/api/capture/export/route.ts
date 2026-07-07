import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Download all captures as a single .md grouped by day.
export async function GET() {
  const { data } = await supabaseAdmin()
    .from("captures")
    .select("text, created_at")
    .order("created_at", { ascending: true });

  const byDay = new Map<string, string[]>();
  for (const c of data ?? []) {
    const day = (c.created_at as string).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(c.text as string);
  }

  let md = "# Quick Captures\n\n";
  for (const [day, items] of byDay) {
    md += `## ${day}\n\n`;
    for (const t of items) md += `- ${t.replace(/\n/g, " ")}\n`;
    md += "\n";
  }

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="captures.md"',
    },
  });
}
