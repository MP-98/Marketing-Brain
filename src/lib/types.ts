// ── Briefing payload shape (System A) ────────────────────────────────────
// Mirrors the original schema, with the v1 change from context.md §3.4:
// `content_angles` (finished-feeling drafts) → `content_package` (raw material).

export interface ConceptFailureMode {
  title: string;
  body: string;
}
export interface ConceptCaseStudy {
  brand: string;
  story: string;
  takeaway: string;
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
  recent_piece: string;
  what_to_track: string;
  linkedin_message: string; // DRAFT ONLY, <280 chars, never auto-sent (§3.3)
  where_to_follow: { platform: string; handle_or_url: string }[];
}

// v1: content package — a brief a writer would want, not a draft they'd publish.
export interface ContentPackageItem {
  core_point: string; // the one point worth making
  angle_type: "take" | "case study" | "lesson";
  facts_to_preserve: string[]; // specific names / numbers / facts to keep
  why_postable: string; // what makes it worth posting now
  platform_fit: string; // e.g. "LinkedIn personal", "X personal"
}

export interface BriefingPayload {
  intro: string;
  concept: Concept;
  trending: TrendingItem[];
  resources: ResourceItem[];
  authorities: AuthorityItem[];
  content_package: ContentPackageItem[];
  quick_takeaway: string;
  vault_connections?: string[]; // §3.2 — ties today's topics back to the vault
  generated_at: string;
  date: string;
}

// ── Job state ────────────────────────────────────────────────────────────
export type SectionStatus = "pending" | "done" | "error";
export interface JobSections {
  concept: SectionStatus;
  trending: SectionStatus;
  authorities: SectionStatus;
  phase2: SectionStatus;
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
