import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ABANDON_MS = 3 * 60 * 1000; // >3 min with no update ⇒ backend likely died

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from("briefing_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Surface abandonment so the frontend can auto-recover.
  let status = data.status as string;
  if (status === "pending") {
    const age = Date.now() - new Date(data.updated_at).getTime();
    if (age > ABANDON_MS) status = "abandoned";
  }

  return NextResponse.json({
    status,
    stage: data.stage,
    sections: data.sections,
    result: data.result,
    errors: data.errors,
    from_cache: data.from_cache,
  });
}
