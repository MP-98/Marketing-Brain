import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { llmText } from "@/lib/llm";
import { env } from "@/lib/env";
import { searchNotes } from "@/lib/vault";
import { getTodayBriefing } from "@/lib/generation";
import { BRAIN_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { question, briefing_date, use_vault = true } = await req.json();
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });

  // Context: today's / that date's concept.
  let conceptBlock = "";
  const briefing = await getTodayBriefing(briefing_date || undefined);
  if (briefing?.concept) {
    conceptBlock = `Today's concept — ${briefing.concept.title}: ${briefing.concept.what_it_is}\nWhy it matters: ${briefing.concept.why_it_matters}`;
  }

  // Vault grounding.
  let sources: { filename: string; chunk_index: number; text: string; score: number }[] = [];
  let vaultBlock = "";
  if (use_vault) {
    const matches = await searchNotes(question, 3);
    sources = matches.map((m) => ({
      filename: m.filename,
      chunk_index: m.chunk_index,
      text: m.text,
      score: m.score,
    }));
    vaultBlock = matches.map((m) => `• (${m.filename}) ${m.text.slice(0, 600)}`).join("\n");
  }

  const prompt = `Answer this question in the user's own voice — direct, specific, practitioner-to-practitioner. 300-600 words, markdown (headers, lists, bold, links allowed). Build on the context and vault notes where relevant; don't pad.

Question: ${question}

${conceptBlock ? `Context:\n${conceptBlock}\n` : ""}${vaultBlock ? `Vault notes:\n${vaultBlock}` : "(no vault notes)"}`;

  const answer = await llmText(prompt, {
    system: BRAIN_SYSTEM,
    model: env.modelHeavy(),
    maxTokens: 4000,
  });

  const { data } = await supabaseAdmin()
    .from("qa")
    .insert({
      question,
      answer,
      briefing_date: briefing_date || null,
      sources,
    })
    .select("id")
    .single();

  return NextResponse.json({ id: data?.id, question, answer, sources });
}
