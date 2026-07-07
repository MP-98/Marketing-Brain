import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = supabaseAdmin();

  // Distinct filenames + chunk counts by source.
  const { data, error } = await supabase.from("note_chunks").select("filename, source");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const vaultFiles = new Set<string>();
  const captureFiles = new Set<string>();
  const allFiles = new Set<string>();
  for (const r of rows) {
    allFiles.add(r.filename);
    if (r.source === "vault") vaultFiles.add(r.filename);
    if (r.source === "capture") captureFiles.add(r.filename);
  }

  return NextResponse.json({
    notes_loaded: allFiles.size,
    chunks_indexed: rows.length,
    vault_notes: vaultFiles.size,
    capture_notes: captureFiles.size,
  });
}
