import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { runBriefingJob, getTodayBriefing } from "@/lib/generation";
import { todayISO, nowISO } from "@/lib/utils";
import type { BriefingPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "true";
  const date = todayISO();
  const supabase = supabaseAdmin();

  // Cache hit (unless forced): return a synthetic "done" job immediately.
  if (!force) {
    const cached = await getTodayBriefing(date);
    if (cached) {
      const { data } = await supabase
        .from("briefing_jobs")
        .insert({
          status: "done",
          stage: "done",
          from_cache: true,
          briefing_date: date,
          sections: {
            concept: "done",
            trending: "done",
            authorities: "done",
            resources: "done",
            angles: "done",
            closing: "done",
          },
          result: cached as BriefingPayload,
          finished_at: nowISO(),
        })
        .select("id")
        .single();
      return NextResponse.json({ job_id: data?.id, from_cache: true });
    }
  }

  // Create a pending job, then run generation after the response is sent.
  const { data, error } = await supabase
    .from("briefing_jobs")
    .insert({ status: "pending", stage: "queued", briefing_date: date })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "job create failed" }, { status: 500 });
  }

  const jobId = data.id as string;
  after(async () => {
    await runBriefingJob(jobId, date);
  });

  return NextResponse.json({ job_id: jobId, from_cache: false });
}
