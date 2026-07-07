import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { indexNotes } from "@/lib/vault";
import { nowISO } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Embed a Q&A pair as an `ask-...-....md` note so future Ask / Connect It finds it.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: qa, error } = await supabase
    .from("qa")
    .select("question, answer, saved_to_vault")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!qa) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (qa.saved_to_vault) return NextResponse.json({ ok: true, already: true });

  const stamp = nowISO().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ask-${stamp}.md`;
  const content = `# ${qa.question}\n\n${qa.answer}`;

  await indexNotes([{ filename, content }], "qa");
  await supabase
    .from("qa")
    .update({ saved_to_vault: true, note_filename: filename })
    .eq("id", id);

  return NextResponse.json({ ok: true, note_filename: filename });
}
