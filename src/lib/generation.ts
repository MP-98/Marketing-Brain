import { supabaseAdmin } from "./supabase";
import { llmJson, webSearch } from "./llm";
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
  resourcesSchema,
  resourcesPrompt,
  contentAnglesSchema,
  contentAnglesPrompt,
  introTakeawaySchema,
  introTakeawayPrompt,
} from "./prompts";
import type {
  BriefingPayload,
  Concept,
  TrendingItem,
  AuthorityItem,
  ResourceItem,
  ContentAngleItem,
  BriefingJob,
  JobSections,
} from "./types";

// Heavy models to try in order. If the configured model (e.g. gpt-5) isn't
// available on the key, fall back to gpt-4o so a briefing still generates —
// the per-section usage log shows which model actually served each section.
const HEAVY = () => {
  const h = env.modelHeavy();
  return h === "gpt-4o" ? [h] : [h, "gpt-4o"];
};

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
  status: SectionStatusValue,
): Promise<JobSections> {
  const next = { ...sections, [key]: status };
  await patchJob(id, { sections: next });
  return next;
}
type SectionStatusValue = JobSections[keyof JobSections];

// dev-only signal that a section came back thinner than the spec target
function warnShort(label: string, text: string, minWords: number): void {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words < minWords) console.warn(`[briefing] ${label} short: ${words}w < ${minWords}w target`);
}

function trim(s: string, max = 3500): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function wordCount(o: unknown): number {
  return JSON.stringify(o).split(/\s+/).filter(Boolean).length;
}

// Model-agnostic length guarantee: if a section came back under target, do ONE
// expansion pass. Free on a model that already writes long (never triggers);
// rescues length on terse models like gpt-4o. Keeps every fact, adds detail.
async function expandIfShort<T>(
  label: string,
  draft: T,
  schema: Record<string, unknown>,
  targets: string,
  minWords: number,
): Promise<T> {
  const words = wordCount(draft);
  if (words >= minWords) return draft;
  console.log(`[briefing] expanding ${label} (${words}w < ${minWords}w)`);
  try {
    return await llmJson<T>(
      `This draft is too short and thin. Expand EVERY field to meet the length targets below, keeping every existing fact, name, number, brand, citation and URL. Add more specific detail: named Indian brands, ₹ price points, campaign names, the named academic origin. Do NOT delete anything and do NOT invent facts. Return the exact same JSON shape.\n\nLENGTH TARGETS:\n${targets}\n\nDRAFT TO EXPAND:\n${JSON.stringify(draft)}`,
      {
        system: BRAIN_SYSTEM,
        models: HEAVY(),
        schema,
        maxTokens: 16000,
        label: `${label}-expand`,
        verbosity: "high",
      },
    );
  } catch {
    return draft; // expansion is best-effort; keep the original on failure
  }
}

// ── Banned-language enforcement (briefing-quality-spec §2 / §8.5) ─────────
// The ban list lives in BRAIN_SYSTEM, but gpt-4o ignores it (verified: the
// 14-7 output titled its concept "Unlocking…" and used leverage/landscape/
// seamless throughout). So enforce in code: scan, and only when violations
// exist, run ONE targeted rewrite that fixes those sentences and nothing else.
const BANNED_WORDS = [
  "leverage", "elevate", "showcase", "unlock", "harness", "seamless",
  "transformative", "tapestry", "delve", "robust", "holistic", "synergy",
];
const BANNED_PATTERNS: RegExp[] = [
  /\blandscape\b/gi, // separate: "landscapes" etc. via \w* below is too greedy for this word list
  /\b(isn'?t|not)\s+just\b[^.?!"]{0,60}?\b(it'?s|but)\b/gi,
  /raises? important questions/gi,
  /in today'?s fast-paced/gi,
  /brands should consider/gi,
  /the possibilities are endless/gi,
];

function findBanned(text: string): string[] {
  const hits = new Set<string>();
  for (const w of BANNED_WORDS) {
    const m = text.match(new RegExp(`\\b${w}\\w*`, "gi"));
    if (m) hits.add(m[0]);
  }
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) hits.add(m[0].slice(0, 50));
  }
  return [...hits];
}

async function fixBannedIfNeeded<T>(
  label: string,
  draft: T,
  schema: Record<string, unknown>,
): Promise<T> {
  const hits = findBanned(JSON.stringify(draft));
  if (hits.length === 0) return draft;
  console.log(`[briefing] de-slopping ${label}: ${hits.join(" · ")}`);
  try {
    return await llmJson<T>(
      `This JSON violates the house style. Banned words/constructions found: ${hits.join(
        ", ",
      )}. Rewrite ONLY the sentences containing them — replace each with sharper, concrete language ("leverage"→"use", "landscape"→"market", "unlock"→a specific verb, "not just X, it's Y"→a direct statement). Everything else stays IDENTICAL: every fact, name, number, ₹ figure, URL, date, and every field without a violation. Return the exact same JSON shape.\n\nJSON:\n${JSON.stringify(draft)}`,
      {
        system: BRAIN_SYSTEM,
        models: HEAVY(),
        schema,
        maxTokens: 16000,
        label: `${label}-deslop`,
      },
    );
  } catch {
    return draft; // best-effort; never fail the briefing over style
  }
}

// ── Vault grounding block ────────────────────────────────────────────────
async function buildVaultBlock(query: string): Promise<string> {
  try {
    const matches = await searchNotes(query, 4, undefined);
    if (matches.length === 0) return "";
    return matches.map((m) => `• (${m.filename}) ${m.text.slice(0, 400)}`).join("\n");
  } catch {
    return "";
  }
}

// ── Cross-day repeat prevention ──────────────────────────────────────────
// Concept had an avoid-list from day one; trending had none, which is why the
// same stories resurfaced every morning. One query now feeds both.
const TRENDING_LOOKBACK_DAYS = 3;

export interface RecentContext {
  conceptTitles: string[];
  /** Titles of trending items shipped in the last TRENDING_LOOKBACK_DAYS days. */
  trendingTitles: string[];
  /** Token sets of those titles, for fuzzy matching in dropRepeats. */
  trendingTokens: Set<string>[];
  /** Normalised source URLs already used, for exact matching. */
  trendingUrls: Set<string>;
}

const EMPTY_RECENT: RecentContext = {
  conceptTitles: [],
  trendingTitles: [],
  trendingTokens: [],
  trendingUrls: new Set(),
};

// Headlines for the same story rarely match verbatim ("Zepto raises $450M" vs
// "Zepto closes $450 million round"), so compare significant-word overlap.
const TITLE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "after", "over", "into",
  "says", "amid", "its", "new", "more", "than", "what", "will", "have", "been",
  "has", "out", "per", "not", "now",
]);

// Scale suffixes/words are stripped so "$450M" and "$450 million" both reduce to
// the token "450" — the figure is the strongest same-story signal in a headline.
const SCALE_WORDS = new Set(["million", "billion", "crore", "lakh", "cr", "bn", "mn"]);

function titleTokens(s: string): Set<string> {
  const words = s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (TITLE_STOPWORDS.has(w) || SCALE_WORDS.has(w)) continue;
    // "450m" / "450bn" → "450"; leaves pure words untouched.
    const normalised = /^\d/.test(w) ? w.replace(/[^0-9]/g, "") : w;
    if (normalised.length >= 2) out.add(normalised);
  }
  return out;
}

function normUrl(u: string): string {
  return u
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// Vocabulary that recurs across this beat every single day. Two headlines
// matching ONLY on these are two different stories in the same category
// ("Zepto hits 1000 dark stores" vs "Instamart adds 200 dark stores"), so an
// overlap made purely of these words doesn't count as a repeat.
const DOMAIN_COMMON = new Set([
  "store", "stores", "dark", "brand", "brands", "launch", "launches", "launched",
  "spend", "spends", "ads", "advertising", "campaign", "campaigns", "marketing",
  "india", "indian", "sales", "revenue", "growth", "users", "market", "price",
  "prices", "pricing", "company", "quick", "commerce", "platform", "consumer",
  "report", "million", "funding", "round", "service", "services",
  // generic product-news filler — two brands can ship unrelated "ready-to-X
  // ranges" on the same day and those are not the same story
  "range", "ranges", "ready", "line", "lineup", "portfolio", "offering",
  "offerings", "expands", "expansion", "adds", "hits", "first", "biggest",
]);

// Three guards, all required: at least 2 shared tokens (one coincidental word
// between two unrelated Nykaa stories shouldn't trip it), 0.4 overlap (rewritten
// headlines keep the entity and figure but swap most verbs), and at least one
// shared token that actually identifies the story.
function tooSimilar(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  const shared: string[] = [];
  for (const t of a) if (b.has(t)) shared.push(t);
  if (shared.length < 2) return false;
  if (shared.length / Math.min(a.size, b.size) < 0.4) return false;
  return shared.some((t) => !DOMAIN_COMMON.has(t));
}

async function getRecentContext(conceptLimit = 12): Promise<RecentContext> {
  try {
    const { data } = await supabaseAdmin()
      .from("briefings")
      .select("date, payload")
      .order("date", { ascending: false })
      .limit(conceptLimit);
    const rows = data ?? [];

    const conceptTitles = rows
      .map((r) => (r.payload as BriefingPayload | undefined)?.concept?.title)
      .filter((t): t is string => Boolean(t));

    const cutoff = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 86400 * 1000)
      .toISOString()
      .slice(0, 10);
    const trendingTitles: string[] = [];
    const trendingTokens: Set<string>[] = [];
    const trendingUrls = new Set<string>();

    for (const r of rows) {
      if (String(r.date) < cutoff) continue;
      for (const t of (r.payload as BriefingPayload | undefined)?.trending ?? []) {
        if (t.title) {
          trendingTitles.push(t.title);
          trendingTokens.push(titleTokens(t.title));
        }
        if (t.source?.url) trendingUrls.add(normUrl(t.source.url));
      }
    }
    return { conceptTitles, trendingTitles, trendingTokens, trendingUrls };
  } catch {
    return EMPTY_RECENT;
  }
}

// Code-level backstop: the prompt gets an avoid-list, but the model doesn't
// always honour it. This one is not negotiable.
function dropRepeats(items: TrendingItem[], recent: RecentContext): TrendingItem[] {
  const kept: TrendingItem[] = [];
  const seenTokens: Set<string>[] = [...recent.trendingTokens];
  const seenUrls = new Set(recent.trendingUrls);

  for (const item of items) {
    const url = item.source?.url ? normUrl(item.source.url) : "";
    if (url && seenUrls.has(url)) {
      console.warn(`[briefing] dropped repeat trending item (url): ${item.title}`);
      continue;
    }
    const tokens = titleTokens(item.title ?? "");
    if (seenTokens.some((prev) => tooSimilar(tokens, prev))) {
      console.warn(`[briefing] dropped repeat trending item (title): ${item.title}`);
      continue;
    }
    if (url) seenUrls.add(url);
    seenTokens.push(tokens);
    kept.push(item);
  }
  return kept;
}

// ── Section generators (all heavy model except seed/search) ───────────────
async function genConcept(seed: string, avoid: string[]): Promise<Concept> {
  // 16000 stays under gpt-4o's 16,384 output cap so the call never 400s;
  // it's plenty for a ~1,600-word concept on gpt-5 too.
  let c = await llmJson<Concept>(conceptPrompt(seed, avoid), {
    system: BRAIN_SYSTEM,
    models: HEAVY(),
    schema: conceptSchema,
    maxTokens: 16000,
    label: "concept",
    verbosity: "high",
  });
  c = await expandIfShort(
    "concept",
    c,
    conceptSchema as Record<string, unknown>,
    "intro_problem ~110w; what_it_is ~150w (with the named academic origin + year); why_it_matters ~150w (India 2026, ₹ figures, named platforms); each of 3 failure_modes 60-90w with a named brand; mechanism ~260w, procedural, ends with a test; each of 3 common_misuse 55-75w; each of 3 case_studies 90-110w (≥2 Indian brands, parent company, ₹ price points); every steal_this a 25-35w verb-first imperative. Total 1,400-1,600 words.",
    1300,
  );
  c = await fixBannedIfNeeded("concept", c, conceptSchema as Record<string, unknown>);
  warnShort("concept", JSON.stringify(c), 1300);
  return c;
}

async function genTrending(
  freshNews: string,
  recent: RecentContext = EMPTY_RECENT,
): Promise<TrendingItem[]> {
  let out = await llmJson<{ items: TrendingItem[] }>(
    trendingPrompt(freshNews, todayISO(), recent.trendingTitles),
    {
      system: BRAIN_SYSTEM,
      models: HEAVY(),
      schema: trendingSchema,
      maxTokens: 16000,
      label: "trending",
      verbosity: "high",
    },
  );
  out = await expandIfShort(
    "trending",
    out,
    trendingSchema as Record<string, unknown>,
    "5 items, each ~280 words: what_happened ~45w (neutral, date+actor+action), why_interesting ~125w (opinionated, takes a side), what_to_do ~110w (second-person imperative, segmented 'If you work with D2C brands: … For agencies: …'). Keep the real source URLs and event_date values unchanged.",
    1000,
  );
  let items = out.items ?? [];

  // Hard stale gate. event_date is now REQUIRED: the old gate passed anything
  // undated (`Number.isNaN(d) ||`), which is exactly how an item with no
  // verifiable date — the ones most likely invented from model memory — got
  // through. Window is SEARCH_WINDOW_DAYS + 2 days of slack.
  const cutoff = Date.now() - (SEARCH_WINDOW_DAYS + 2) * 86400 * 1000;
  const before = items.length;
  items = items.filter((t) => {
    const d = t.event_date ? Date.parse(t.event_date) : NaN;
    if (Number.isNaN(d)) {
      console.warn(`[briefing] dropped undated trending item: ${t.title}`);
      return false;
    }
    return d >= cutoff;
  });
  if (items.length < before) {
    console.warn(`[briefing] dropped ${before - items.length} stale/undated trending item(s)`);
  }

  // Cross-day dedup — the fix for "same news again every morning".
  items = dropRepeats(items, recent);
  if (items.length < 3) {
    console.warn(
      `[briefing] only ${items.length} trending item(s) survived filtering — ` +
        `content angles need 3 distinct items; consider widening SEARCH_WINDOW_DAYS`,
    );
  }

  out = await fixBannedIfNeeded("trending", { items }, trendingSchema as Record<string, unknown>);
  items = out.items ?? items;

  items.slice(0, 1).forEach((t) =>
    warnShort("trending[0]", `${t.what_happened} ${t.why_interesting} ${t.what_to_do}`, 250),
  );
  return items;
}

async function genAuthorities(seed: string, freshPeople: string): Promise<AuthorityItem[]> {
  let out = await llmJson<{ items: AuthorityItem[] }>(authoritiesPrompt(seed, freshPeople), {
    system: BRAIN_SYSTEM,
    models: HEAVY(),
    schema: authoritiesSchema,
    maxTokens: 10000,
    label: "authorities",
    verbosity: "high",
  });
  out = await fixBannedIfNeeded("authorities", out, authoritiesSchema as Record<string, unknown>);
  return out.items ?? [];
}

async function genResources(
  conceptTitle: string,
  freshDigest: string,
  trendingTitles: string[],
): Promise<ResourceItem[]> {
  let out = await llmJson<{ items: ResourceItem[] }>(
    resourcesPrompt(conceptTitle, freshDigest, trendingTitles),
    { system: BRAIN_SYSTEM, models: HEAVY(), schema: resourcesSchema, maxTokens: 8000, label: "resources", verbosity: "high" },
  );
  out = await fixBannedIfNeeded("resources", out, resourcesSchema as Record<string, unknown>);
  return out.items ?? [];
}

async function genContentAngles(
  conceptTitle: string,
  trendingSummary: string,
): Promise<ContentAngleItem[]> {
  let out = await llmJson<{ items: ContentAngleItem[] }>(
    contentAnglesPrompt(conceptTitle, trendingSummary),
    { system: BRAIN_SYSTEM, models: HEAVY(), schema: contentAnglesSchema, maxTokens: 16000, label: "angles", verbosity: "high" },
  );
  out = await expandIfShort(
    "angles",
    out,
    contentAnglesSchema as Record<string, unknown>,
    "5 angles, each ~290 words, KEEPING each angle's existing topic_source and platform (do not collapse them onto one topic). hook = the full literal opening copy in quotes, platform-native. angle = a 6-8 beat slide-by-slide shot list, each beat a full sentence naming a real Indian brand and a ₹ figure. payoff ~25w. why_now ~30w tied to the topic_source item.",
    1000,
  );
  out = await fixBannedIfNeeded("angles", out, contentAnglesSchema as Record<string, unknown>);
  const items = out.items ?? [];
  items.slice(0, 1).forEach((a) => warnShort("angles[0]", `${a.hook} ${a.angle}`, 200));
  return items;
}

interface Closing {
  intro: string;
  quick_takeaway: string;
  vault_connections: string[];
}
async function genIntroTakeaway(
  conceptTitle: string,
  fullContext: string,
  vaultBlock: string,
): Promise<Closing> {
  let out = await llmJson<Closing>(
    introTakeawayPrompt(conceptTitle, fullContext, vaultBlock),
    { system: BRAIN_SYSTEM, models: HEAVY(), schema: introTakeawaySchema, maxTokens: 5000, label: "closing", verbosity: "high" },
  );
  // quick_takeaway landed 40-42w (target 60-90w) in consecutive logged runs —
  // the base prompt alone doesn't get a terse model there, so expand if short.
  out = await expandIfShort(
    "closing",
    out,
    introTakeawaySchema as Record<string, unknown>,
    "intro 110-140 words, one paragraph, naming 2-3 real items from today's news by brand and number. quick_takeaway 60-90 words, 2-3 sentences, ending on an imperative or a hard line.",
    170,
  );
  out = await fixBannedIfNeeded("closing", out, introTakeawaySchema as Record<string, unknown>);
  warnShort("quick_takeaway", out.quick_takeaway ?? "", 55);
  return {
    intro: out.intro ?? "",
    quick_takeaway: out.quick_takeaway ?? "",
    vault_connections: out.vault_connections ?? [],
  };
}

// ── Topic seed (utility model — cheap, keeps the day coherent) ────────────
async function gatherTopicSeed(): Promise<string> {
  try {
    const out = await llmJson<{ seed: string }>(
      `Pick ONE sharp, non-obvious theme for today's Indian marketing briefing: a rigorous marketing / behavioural-economics / brand-science concept with a real named academic origin (e.g. category entry points, price anchoring, the decoy effect, distinctiveness, the 60/40 split, loss aversion), tied to the Indian D2C/FMCG market. ` +
        `BANNED (do not pick): nostalgia marketing, storytelling, authenticity, emotional connection, brand purpose, community. Prefer a concept a smart operator hasn't seen written up ten times. Return JSON { seed: "<6-12 words>" }.`,
      {
        system: BRAIN_SYSTEM,
        models: [env.modelUtility()],
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

// ── Live web-search grounding (utility model + web_search tool) ───────────
interface FreshContext {
  news: string;
  people: string;
}
// Search window. A 7-day window re-run daily re-requests six of the same seven
// days every morning, so the strongest results — and therefore the briefing —
// were near-identical day over day. 48h keeps each run's corpus mostly new;
// cross-day dedup (getRecentContext + dropRepeats) covers the remaining overlap.
const SEARCH_WINDOW_DAYS = 2;

async function gatherFreshContext(): Promise<FreshContext> {
  const today = todayISO();
  const since = new Date(Date.now() - SEARCH_WINDOW_DAYS * 86400 * 1000)
    .toISOString()
    .slice(0, 10);
  const [news, people] = await Promise.all([
    // Explicit date window + per-item date requirement. A prose "past 7 days"
    // wasn't enforced anywhere and let months-old sports stories through.
    webSearch(
      `Today is ${today}. Find 8-12 specific news items PUBLISHED BETWEEN ${since} AND ${today} — hard requirement, silently EXCLUDE anything published before ${since}, even if prominent (an IPL or FIFA story from months ago is useless). For EVERY item give: publication date (YYYY-MM-DD), the event in one line, the publication name, and the source URL. Skip any item whose date you cannot determine.

TOPIC GATE — every item must be a MARKETING, BRAND, ADVERTISING, RETAIL or CONSUMER-COMMERCE event. Cover: Indian FMCG/D2C brand moves (launches, repositioning, pricing, funding, category entries), quick-commerce (Blinkit/Zepto/Instamart), advertising & ad-spend news, agency and media moves, regulator actions (ASCI, FSSAI), and platform/creator-economy changes.
EXCLUDE — these are the failure mode: general politics, sports results, film/TV releases, celebrity news, crime, weather, macroeconomics, and stock moves. A cultural moment qualifies ONLY if a specific named brand has already run a campaign or reacted commercially to it — in that case lead with the BRAND'S action, not the cultural event. "A brand could react to this" is NOT enough and does not qualify.`,
      { contextSize: "high", label: "search:news" },
    ),
    webSearch(
      `Today is ${today}. INDIAN independent marketing/brand operators, D2C/FMCG founders, strategists and writers who published something between ${since} and ${today} (LinkedIn posts, essays, threads, podcasts). Focus on India-based people who publish their own work. Names, the argument of the recent piece, its date, URLs. Skip C-suite of large listed companies and global celebrity marketers. Exclude anything older than ${since}.`,
      { label: "search:people" },
    ),
  ]);
  return { news: trim(news, 4500), people: trim(people) };
}

// ── Orchestrator — three phases (briefing-quality-spec §6.2) ──────────────
export async function runBriefingJob(jobId: string, date: string): Promise<void> {
  let sections: JobSections = {
    concept: "pending",
    trending: "pending",
    authorities: "pending",
    resources: "pending",
    angles: "pending",
    closing: "pending",
  };
  const errors: Record<string, string> = {};
  const partial: Partial<BriefingPayload> = {};

  try {
    await patchJob(jobId, { status: "pending", stage: "gathering_topics" });
    const [seed, recent] = await Promise.all([gatherTopicSeed(), getRecentContext()]);

    await patchJob(jobId, { stage: "fetching_news" });
    const fresh = await gatherFreshContext();
    const combinedDigest = trim(`${fresh.news}\n\n${fresh.people}`, 4000);

    // ── Phase 1: concept, trending, authorities (parallel) ───────────────
    await patchJob(jobId, { stage: "generating_concept" });
    const p1 = await Promise.allSettled([
      genConcept(seed, recent.conceptTitles),
      genTrending(fresh.news, recent),
      genAuthorities(seed, fresh.people),
    ]);

    if (p1[0].status === "fulfilled") {
      partial.concept = p1[0].value;
      sections = await mergeSections(jobId, sections, "concept", "done");
    } else {
      errors.concept = String(p1[0].reason);
      sections = await mergeSections(jobId, sections, "concept", "error");
    }
    if (p1[1].status === "fulfilled") {
      partial.trending = p1[1].value;
      sections = await mergeSections(jobId, sections, "trending", "done");
    } else {
      errors.trending = String(p1[1].reason);
      sections = await mergeSections(jobId, sections, "trending", "error");
    }
    if (p1[2].status === "fulfilled") {
      partial.authorities = p1[2].value;
      sections = await mergeSections(jobId, sections, "authorities", "done");
    } else {
      errors.authorities = String(p1[2].reason);
      sections = await mergeSections(jobId, sections, "authorities", "error");
    }
    await patchJob(jobId, { result: partial, errors });

    // Recovery for still-errored phase-1 sections.
    await runPhase1Recovery(jobId, sections, partial, errors, seed, fresh, recent);
    if (!partial.concept) throw new Error("concept generation failed after recovery");

    // ── Phase 2: resources + content angles (parallel) ───────────────────
    await patchJob(jobId, { stage: "generating_sections" });
    const conceptTitle = partial.concept.title;
    const trendingSummary = (partial.trending ?? [])
      .map((t) => `- [${t.event_date ?? "recent"}] ${t.title}: ${t.what_happened}`)
      .join("\n");

    const trendingTitles = (partial.trending ?? []).map((t) => t.title);
    const p2 = await Promise.allSettled([
      genResources(conceptTitle, combinedDigest, trendingTitles),
      genContentAngles(conceptTitle, trendingSummary),
    ]);
    if (p2[0].status === "fulfilled") {
      partial.resources = p2[0].value;
      sections = await mergeSections(jobId, sections, "resources", "done");
    } else {
      errors.resources = String(p2[0].reason);
      partial.resources = [];
      sections = await mergeSections(jobId, sections, "resources", "error");
    }
    if (p2[1].status === "fulfilled") {
      partial.content_angles = p2[1].value;
      sections = await mergeSections(jobId, sections, "angles", "done");
    } else {
      errors.angles = String(p2[1].reason);
      partial.content_angles = [];
      sections = await mergeSections(jobId, sections, "angles", "error");
    }
    await patchJob(jobId, { result: partial, errors });

    // ── Phase 3: intro + takeaway (sees everything) ──────────────────────
    await patchJob(jobId, { stage: "framing" });
    const vaultBlock = await buildVaultBlock(`${conceptTitle} ${partial.concept.theme}`);
    const fullContext = buildFullContext(partial);
    try {
      const closing = await genIntroTakeaway(conceptTitle, fullContext, vaultBlock);
      partial.intro = closing.intro;
      partial.quick_takeaway = closing.quick_takeaway;
      partial.vault_connections = closing.vault_connections;
      sections = await mergeSections(jobId, sections, "closing", "done");
    } catch (e) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const closing = await genIntroTakeaway(conceptTitle, fullContext, vaultBlock);
        partial.intro = closing.intro;
        partial.quick_takeaway = closing.quick_takeaway;
        partial.vault_connections = closing.vault_connections;
        sections = await mergeSections(jobId, sections, "closing", "done");
      } catch (e2) {
        errors.closing = String(e2);
        sections = await mergeSections(jobId, sections, "closing", "error");
      }
    }

    // ── Assemble + persist ───────────────────────────────────────────────
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

async function runPhase1Recovery(
  jobId: string,
  sections: JobSections,
  partial: Partial<BriefingPayload>,
  errors: Record<string, string>,
  seed: string,
  fresh: FreshContext,
  recent: RecentContext,
): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (sections.concept === "error") {
    jobs.push(
      genConcept(seed, recent.conceptTitles).then(
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
      genTrending(fresh.news, recent).then(
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
      genAuthorities(seed, fresh.people).then(
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
    await patchJob(jobId, { stage: "recovering" });
    await Promise.all(jobs);
    await patchJob(jobId, { sections, result: partial, errors });
  }
}

// Compact view of the day, for the Phase-3 framing call (keeps input cost down).
function buildFullContext(p: Partial<BriefingPayload>): string {
  const parts: string[] = [];
  if (p.concept) {
    parts.push(
      `CONCEPT: ${p.concept.title}\n${p.concept.why_it_matters}\nCase studies: ${p.concept.case_studies
        .map((c) => c.brand)
        .join(", ")}`,
    );
  }
  if (p.trending?.length) {
    parts.push(
      `TRENDING:\n${p.trending.map((t) => `- ${t.title}: ${t.what_happened}`).join("\n")}`,
    );
  }
  if (p.content_angles?.length) {
    parts.push(`ANGLES:\n${p.content_angles.map((a) => `- ${a.platform}: ${a.title}`).join("\n")}`);
  }
  return trim(parts.join("\n\n"), 4000);
}

function assemblePayload(partial: Partial<BriefingPayload>, date: string): BriefingPayload {
  return {
    intro: partial.intro ?? "",
    concept: partial.concept as Concept,
    trending: partial.trending ?? [],
    resources: partial.resources ?? [],
    authorities: partial.authorities ?? [],
    content_angles: partial.content_angles ?? [],
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
