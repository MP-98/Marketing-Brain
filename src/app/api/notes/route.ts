import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Wipe the uploaded vault (preserves captures + qa).
export async function DELETE() {
  const { error } = await supabaseAdmin().from("note_chunks").delete().eq("source", "vault");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
