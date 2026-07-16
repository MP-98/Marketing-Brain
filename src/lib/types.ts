// ── Briefing payload shape (System A) ────────────────────────────────────
// Depth + structure tuned to docs/briefing-quality-spec.md (matches mar-br-2).
// Content Package was removed; one rich `content_angles` section survives.

export interface ConceptFailureMode {
  title: string;
  body: string;
}
export interface ConceptCaseStudy {
  brand: string;
  story: string;
  steal_this: string; // was `takeaway`; now a 25-35 word imperative instruction
}
export interface Concept {
  title: string;
  theme: string;
  intro_problem: string;
  what_it_is: string;
  why_it_matters: string;
  failure_modes: ConceptFailureMode[];
  mechanism: string;
  common_misuse: ConceptFailureMode[];
  case_studies: ConceptCaseStudy[];
}

export interface TrendingItem {
  title: string;
  event_date?: string; // YYYY-MM-DD; optional so pre-change archived rows still render
  what_happened: string;
  why_interesting: string;
  what_to_do: string; // the reactive marketing angle (D2C/FMCG lens)
  source: { publication: string; url: string };
}

export interface ResourceItem {
  title: string;
  description: string;
  author: string;
  format: "essay" | "thread" | "podcast" | "video" | "book" | "report" | "post";
  url: string | null;
}

export interface AuthorityItem {
  name: string;
  current_role: string;
  origin: "India" | "Global";
  career: string;
  known_for: string;
  recent_piece: string; // must state the ARGUMENT, not just that it exists
  what_to_track: string;
  why_reachable: string; // one line: why this person would plausibly reply (§5)
  linkedin_message: string; // DRAFT ONLY, 150-230 chars, never auto-sent (§3.3)
  where_to_follow: { platform: string; handle_or_url: string }[];
}

// Content angles — 5 ready-to-ship post ideas on 5 DIFFERENT topics, each
// written for that platform's ranking mechanics.
export interface ContentAngleItem {
  platform: string; // LinkedIn carousel | Instagram Reel | Twitter/X | Substack | ...
  topic_source?: string; // which trending item / concept it draws from (optional: old rows)
  title: string;
  hook: string; // literal opening copy, in quotes — not a description of a hook
  angle: string; // slide-by-slide / beat-by-beat shot list
  payoff: string; // ~25 words: what the reader walks away able to do
  why_now: string; // ~30 words, tied to the item named in topic_source
}

export interface BriefingPayload {
  intro: string;
  concept: Concept;
  trending: TrendingItem[];
  resources: ResourceItem[];
  authorities: AuthorityItem[];
  content_angles: ContentAngleItem[];
  quick_takeaway: string;
  vault_connections?: string[]; // ties today's topics back to the vault
  generated_at: string;
  date: string;
}

// ── Job state ────────────────────────────────────────────────────────────
// Stages match the 3-phase pipeline (briefing-quality-spec §6.2).
export type SectionStatus = "pending" | "done" | "error";
export interface JobSections {
  concept: SectionStatus;
  trending: SectionStatus;
  authorities: SectionStatus;
  resources: SectionStatus;
  angles: SectionStatus;
  closing: SectionStatus; // intro + quick_takeaway (generated last, sees all)
}
export type JobStatus = "pending" | "done" | "error" | "abandoned";

export interface BriefingJob {
  id: string;
  status: JobStatus;
  stage: string | null;
  sections: JobSections;
  result: Partial<BriefingPayload>;
  errors: Record<string, string>;
  from_cache: boolean;
  briefing_date: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

// ── Vault search ─────────────────────────────────────────────────────────
export interface NoteMatch {
  id: string;
  filename: string;
  chunk_index: number;
  text: string;
  source: "vault" | "capture" | "qa";
  score: number;
}
