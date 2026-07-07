import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const { data, error } = await supabaseAdmin()
    .from("briefings")
    .select("date, tags, payload")
    .eq("date", date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ exists: false }, { status: 404 });
  return NextResponse.json({ exists: true, date: data.date, tags: data.tags, payload: data.payload });
}
