import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { indexNotes } from "@/lib/vault";
import { nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quick capture: store in `captures` AND embed as a `capture-...-....md` note.
export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data } = await supabase.from("captures").insert({ text }).select("id").single();

  const stamp = nowISO().replace(/[:.]/g, "-").slice(0, 19);
  await indexNotes([{ filename: `capture-${stamp}.md`, content: text }], "capture");

  return NextResponse.json({ ok: true, id: data?.id });
}
