import { llmJson } from "./llm";
import { env } from "./env";
import { VOICE_GUIDE } from "./voiceGuide";
import { scanText, publishCheck, type VoiceIssue, type PublishCheck } from "./voice";

export const PLATFORMS = [
  "LinkedIn personal",
  "LinkedIn company",
  "X personal",
  "X company",
  "Instagram",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface AuditFlag {
  category: string; // banned-word | em-dash | rhythm | hedge | triad | transition | semicolon | generic | meta | vague-close | platform | structure | voice
  excerpt: string; // the offending text from the draft
  problem: string; // one sentence: what's wrong + what it needs (Pass 1 + Pass 2)
}

export interface AuditResult {
  flags: AuditFlag[];
  rewrite: string;
  changes: string[];
  platform_note: string;
  scan: VoiceIssue[]; // deterministic scan of the ORIGINAL draft
  verify: PublishCheck; // deterministic 10-check on the REWRITE
  original_len: number;
  rewrite_len: number;
}

const str = { type: "string" };
const auditSchema = {
  type: "object",
  additionalProperties: false,
  required: ["flags", "rewrite", "changes", "platform_note"],
  properties: {
    flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "excerpt", "problem"],
        properties: { category: str, excerpt: str, problem: str },
      },
    },
    rewrite: str,
    changes: { type: "array", items: str },
    platform_note: str,
  },
};

export async function runAudit(draft: string, platform: Platform): Promise<AuditResult> {
  const scan = scanText(draft);
  const scanHint =
    scan.length > 0
      ? `Deterministic scan already caught these (include them and anything else you find):\n${scan
          .map((s) => `- [${s.category}] "${s.term}" — …${s.context}`)
          .join("\n")}`
      : "Deterministic scan found no hard-no violations, but still audit voice, rhythm, hedging, triads, and structure.";

  const prompt = `Target: ${platform}.

Run the 3-pass process on the draft below. Do NOT generate new content or add facts. If a System A topic package was pasted in, treat it as a draft and still audit/rewrite it — do not write fresh copy from a topic.

PASS 1 (Audit) + PASS 2 (Critique): produce "flags" — one per violation. Each flag: category, the exact "excerpt" from the draft, and "problem" = one sentence on what's wrong and what it needs instead. Cover overused/banned words, em dashes, banned phrases, formal transitions, semicolons, runs of same-length sentences, topic-sentence/explain/example/wrap paragraphs, hedges/both-sides framing, triads used only for rhythm, and generic phrases where a concrete detail would land.

PASS 3 (Rewrite): rewrite the whole thing applying Voice, Rhythm, and Specificity. Keep EVERY fact, figure, name, and claim. Add nothing. Drop nothing. Stay within ~10% of the original length. Make it right for ${platform} (apply the platform notes — and if this reads like repurposed long-form dressed up as an X post, say so in platform_note and fix it).

Also return "changes": a short list of plain-language statements of what you changed and why. "platform_note": one line on platform fit (empty string if nothing to flag).

${scanHint}

DRAFT:
"""
${draft}
"""`;

  const out = await llmJson<{
    flags: AuditFlag[];
    rewrite: string;
    changes: string[];
    platform_note: string;
  }>(prompt, {
    system: VOICE_GUIDE,
    models: [env.modelHeavy()],
    schema: auditSchema,
    name: "voice_audit",
    maxTokens: 6000,
    attemptsPerModel: 2,
  });

  const rewrite = (out.rewrite ?? "").trim();
  return {
    flags: out.flags ?? [],
    rewrite,
    changes: out.changes ?? [],
    platform_note: out.platform_note ?? "",
    scan,
    verify: publishCheck(rewrite),
    original_len: draft.trim().length,
    rewrite_len: rewrite.length,
  };
}
