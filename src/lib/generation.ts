import { supabaseAdmin } from "./supabase";
import { llmJson } from "./llm";
import { env } from "./env";
import { searchNotes } from "./vault";
import { deriveTags } from "./tags";
import { nowISO, todayISO } from "./utils";
import {
  BRAIN_SYSTEM,
  conceptSchema,
  conceptPrompt,
  trendingSchema,
  trendingPrompt,
  authoritiesSchema,
  authoritiesPrompt,
  phase2Schema,
  phase2Prompt,
} from "./prompts";
import type {
  BriefingPayload,
  Concept,
  TrendingItem,
  AuthorityItem,
  BriefingJob,
  JobSections,
} from "./types";

// ── Job state helpers ────────────────────────────────────────────────────
async function patchJob(id: string, patch: Partial<BriefingJob>): Promise<void> {
  await supabaseAdmin()
    .from("briefing_jobs")
    .update({ ...patch, updated_at: nowISO() })
    .eq("id", id);
}

async function mergeSections(
  id: string,
  sections: JobSections,
  key: keyof JobSections,
  status: JobSections[keyof JobSections],
): Promise<JobSections> {
  const next = { ...sections, [key]: status };
  await patchJob(id, { sections: next });
  return next;
}

// ── Vault grounding block ────────────────────────────────────────────────
async function buildVaultBlock(query: string): Promise<string> {
  try {
    const matches = await searchNotes(query, 4, undefined);
    if (matches.length === 0) return "";
    return matches
      .map((m) => `• (${m.filename}) ${m.text.slice(0, 400)}`)
      .join("\n");
  } catch {
    return ""; // vault grounding is best-effort; never fail the whole briefing on it
  }
}

// ── Phase-1 section generators (each single-purpose) ──────────────────────
async function genConcept(seed: string): Promise<Concept> {
  return llmJson<Concept>(conceptPrompt(seed), {
    system: BRAIN_SYSTEM,
    models: [env.modelHeavy(), env.modelLight()],
    schema: conceptSchema,
    maxTokens: 8000,
  });
}

async function genTrending(): Promise<TrendingItem[]> {
  const out = await llmJson<{ items: TrendingItem[] }>(trendingPrompt(), {
    system: BRAIN_SYSTEM,
    models: [env.modelLight(), env.modelHeavy()],
    schema: trendingSchema,
    maxTokens: 6000,
  });
  return out.items ?? [];
}

async function genAuthorities(seed: string): Promise<AuthorityItem[]> {
  const out = await llmJson<{ items: AuthorityItem[] }>(authoritiesPrompt(seed), {
    system: BRAIN_SYSTEM,
    models: [env.modelLight(), env.modelHeavy()],
    schema: authoritiesSchema,
    maxTokens: 6000,
  });
  return out.items ?? [];
}

interface Phase2Result {
  intro: string;
  resources: BriefingPayload["resources"];
  content_package: BriefingPayload["content_package"];
  quick_takeaway: string;
  vault_connections: string[];
}

async function genPhase2(conceptTitle: string, vaultBlock: string): Promise<Phase2Result> {
  const out = await llmJson<Phase2Result>(phase2Prompt(conceptTitle, vaultBlock), {
    system: BRAIN_SYSTEM,
    models: [env.modelHeavy(), env.modelLight()],
    schema: phase2Schema,
    maxTokens: 8000,
    attemptsPerModel: 2,
  });
  return {
    intro: out.intro ?? "",
    resources: out.resources ?? [],
    content_package: out.content_package ?? [],
    quick_takeaway: out.quick_takeaway ?? "",
    vault_connections: out.vault_connections ?? [],
  };
}

// ── A light topic seed to keep the day's sections coherent ────────────────
async function gatherTopicSeed(): Promise<string> {
  try {
    const out = await llmJson<{ seed: string }>(
      `Pick ONE tight theme for today's marketing briefing that ties together a teachable concept, a reactive cultural moment, and people worth following. Return JSON { seed: "<6-12 words>" }.`,
      {
        system: BRAIN_SYSTEM,
        models: [env.modelLight()],
        schema: {
          type: "object",
          properties: { seed: { type: "string" } },
          required: ["seed"],
          additionalProperties: false,
        },
        maxTokens: 300,
      },
    );
    return out.seed ?? "";
  } catch {
    return "";
  }
}

// ── The orchestrator ──────────────────────────────────────────────────────
// Runs fire-and-forget from the /generate route; persists state at every stage
// so the frontend can poll and recover.
export async function runBriefingJob(jobId: string, date: string): Promise<void> {
  let sections: JobSections = {
    concept: "pending",
    trending: "pending",
    authorities: "pending",
    phase2: "pending",
  };
  const errors: Record<string, string> = {};
  const partial: Partial<BriefingPayload> = {};

  try {
    await patchJob(jobId, { status: "pending", stage: "gathering_topics" });
    const seed = await gatherTopicSeed();

    // ── Phase 1: concept, trending, authorities in parallel ──────────────
    await patchJob(jobId, { stage: "generating_phase1" });
    const results = await Promise.allSettled([
      genConcept(seed),
      genTrending(),
      genAuthorities(seed),
    ]);

    if (results[0].status === "fulfilled") {
      partial.concept = results[0].value;
      sections = await mergeSections(jobId, sections, "concept", "done");
    } else {
      errors.concept = String(results[0].reason);
      sections = await mergeSections(jobId, sections, "concept", "error");
    }
    if (results[1].status === "fulfilled") {
      partial.trending = results[1].value;
      sections = await mergeSections(jobId, sections, "trending", "done");
    } else {
      errors.trending = String(results[1].reason);
      sections = await mergeSections(jobId, sections, "trending", "error");
    }
    if (results[2].status === "fulfilled") {
      partial.authorities = results[2].value;
      sections = await mergeSections(jobId, sections, "authorities", "done");
    } else {
      errors.authorities = String(results[2].reason);
      sections = await mergeSections(jobId, sections, "authorities", "error");
    }
    await patchJob(jobId, { result: partial, errors });

    // ── Recovery pass for any still-errored phase-1 section (heavy model) ─
    await runRecovery(jobId, sections, partial, errors, seed);

    // Concept is required for phase 2. If we still don't have it, hard fail.
    if (!partial.concept) throw new Error("concept generation failed after recovery");

    // ── Phase 2: resources + content package + intro + takeaway ──────────
    await patchJob(jobId, { stage: "generating_phase2" });
    const vaultBlock = await buildVaultBlock(
      `${partial.concept.title} ${partial.concept.theme}`,
    );
    let phase2: Phase2Result | null = null;
    try {
      phase2 = await genPhase2(partial.concept.title, vaultBlock);
    } catch (e) {
      // last-ditch retry after a short pause
      await new Promise((r) => setTimeout(r, 3000));
      try {
        phase2 = await genPhase2(partial.concept.title, vaultBlock);
      } catch (e2) {
        errors.phase2 = String(e2);
      }
    }
    if (phase2) {
      partial.intro = phase2.intro;
      partial.resources = phase2.resources;
      partial.content_package = phase2.content_package;
      partial.quick_takeaway = phase2.quick_takeaway;
      partial.vault_connections = phase2.vault_connections;
      sections = await mergeSections(jobId, sections, "phase2", "done");
    } else {
      sections = await mergeSections(jobId, sections, "phase2", "error");
    }

    // ── Assemble + persist the briefing ──────────────────────────────────
    const payload = assemblePayload(partial, date);
    await saveBriefing(date, payload);

    await patchJob(jobId, {
      status: "done",
      stage: "done",
      result: payload,
      errors,
      briefing_date: date,
      finished_at: nowISO(),
    });
  } catch (err) {
    await patchJob(jobId, {
      status: "error",
      stage: "error",
      errors: { ...errors, fatal: String(err) },
      finished_at: nowISO(),
    });
  }
}

async function runRecovery(
  jobId: string,
  sections: JobSections,
  partial: Partial<BriefingPayload>,
  errors: Record<string, string>,
  seed: string,
): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (sections.concept === "error") {
    jobs.push(
      genConcept(seed).then(
        (c) => {
          partial.concept = c;
          delete errors.concept;
          sections.concept = "done";
        },
        () => {},
      ),
    );
  }
  if (sections.trending === "error") {
    jobs.push(
      genTrending().then(
        (t) => {
          partial.trending = t;
          delete errors.trending;
          sections.trending = "done";
        },
        () => {},
      ),
    );
  }
  if (sections.authorities === "error") {
    jobs.push(
      genAuthorities(seed).then(
        (a) => {
          partial.authorities = a;
          delete errors.authorities;
          sections.authorities = "done";
        },
        () => {},
      ),
    );
  }
  if (jobs.length) {
    await patchJob(jobId, { stage: "recovering_phase1" });
    await Promise.all(jobs);
    await patchJob(jobId, { sections, result: partial, errors });
  }
}

function assemblePayload(partial: Partial<BriefingPayload>, date: string): BriefingPayload {
  return {
    intro: partial.intro ?? "",
    concept: partial.concept as Concept,
    trending: partial.trending ?? [],
    resources: partial.resources ?? [],
    authorities: partial.authorities ?? [],
    content_package: partial.content_package ?? [],
    quick_takeaway: partial.quick_takeaway ?? "",
    vault_connections: partial.vault_connections ?? [],
    generated_at: nowISO(),
    date,
  };
}

async function saveBriefing(date: string, payload: BriefingPayload): Promise<void> {
  const tags = deriveTags(payload);
  const { error } = await supabaseAdmin()
    .from("briefings")
    .upsert({ date, tags, payload, created_at: nowISO() }, { onConflict: "date" });
  if (error) throw new Error(`briefing upsert failed: ${error.message}`);
}

// ── Public helpers used by routes ─────────────────────────────────────────
export async function getTodayBriefing(date = todayISO()) {
  const { data } = await supabaseAdmin()
    .from("briefings")
    .select("payload")
    .eq("date", date)
    .maybeSingle();
  return data?.payload as BriefingPayload | undefined;
}
