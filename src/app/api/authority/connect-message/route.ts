import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { llmJson } from "@/lib/llm";
import { env } from "@/lib/env";
import { BRAIN_SYSTEM, connectMessageSchema } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, current_role, known_for, recent_piece, briefing_date, authority_index } = body ?? {};
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const out = await llmJson<{ message: string }>(
    `Draft a LinkedIn connection request under 280 characters to ${name} (${current_role ?? ""}). ` +
      `Reference something specific and real: ${known_for ?? ""}. Recent: ${recent_piece ?? ""}. ` +
      `Warm, direct, no flattery, no "big fan". This is a DRAFT for a human to review before sending. ` +
      `Return JSON { message }.`,
    {
      system: BRAIN_SYSTEM,
      models: [env.modelLight()],
      schema: connectMessageSchema,
      maxTokens: 500,
    },
  );

  const message = (out.message ?? "").slice(0, 300);

  // Backfill into the cached briefing so it doesn't cost anything to view again.
  if (briefing_date && typeof authority_index === "number") {
    const supabase = supabaseAdmin();
    const { data } = await supabase
      .from("briefings")
      .select("payload")
      .eq("date", briefing_date)
      .maybeSingle();
    if (data?.payload?.authorities?.[authority_index]) {
      const payload = data.payload;
      payload.authorities[authority_index].linkedin_message = message;
      await supabase.from("briefings").update({ payload }).eq("date", briefing_date);
    }
  }

  return NextResponse.json({ message });
}
