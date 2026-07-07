import { NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";
import { env } from "@/lib/env";
import { searchNotesDeduped } from "@/lib/vault";
import { BRAIN_SYSTEM, connectSchema, connectPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Thought → Connect It
export async function POST(req: Request) {
  const { thought } = await req.json();
  if (!thought?.trim()) return NextResponse.json({ error: "thought is required" }, { status: 400 });

  const notes = await searchNotesDeduped(thought, 3);
  const notesBlock = notes
    .map((n) => `• (${n.filename}) ${n.text.slice(0, 500)}`)
    .join("\n");

  const out = await llmJson<{
    content_angle: string;
    client_application: string;
    my_pov: string;
  }>(connectPrompt(thought, notesBlock), {
    system: BRAIN_SYSTEM,
    models: [env.modelHeavy(), env.modelLight()],
    schema: connectSchema,
    maxTokens: 3000,
  });

  return NextResponse.json({
    ...out,
    connected_notes: notes.map((n) => ({
      filename: n.filename,
      chunk_index: n.chunk_index,
      text: n.text,
      score: n.score,
    })),
  });
}
