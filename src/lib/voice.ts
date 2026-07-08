// ── System B — deterministic voice scanner ──────────────────────────────
// Exact, free, regex-based detection of the guide's "hard nos". Used to
// (1) ground the LLM audit and (2) verify the rewrite is actually clean.

export const BANNED_WORDS = [
  "delve", "leverage", "synergy", "optimize", "streamline", "empower",
  "innovative", "groundbreaking", "transformative", "utilize", "landscape",
  "harness", "unlock", "unleash", "seamless", "cutting-edge", "game-changer",
  "paradigm", "unprecedented", "elevate", "showcase", "loop", "signal",
  "cascade", "drift", "drifting", "quiet", "quietly", "tapestry", "realm",
];

const BANNED_PHRASES: { re: RegExp; label: string }[] = [
  { re: /\bnot just\b[^.?!]{1,40}?\bbut\b/gi, label: '"not just X but Y"' },
  { re: /\bit'?s not\b[^.?!]{1,40}?,?\s*it'?s\b/gi, label: '"it\'s not X, it\'s Y"' },
  { re: /\bisn'?t\b[^.?!]{1,40}?,?\s*it'?s\b/gi, label: '"isn\'t X, it\'s Y"' },
  { re: /what (no one|nobody) (else )?(is talking about|tells you)/gi, label: '"what nobody tells you"' },
  { re: /raises? important questions/gi, label: '"raises important questions"' },
  { re: /invites? us to reconsider/gi, label: '"invites us to reconsider"' },
  { re: /explores? themes of/gi, label: '"explores themes of"' },
  { re: /\bin conclusion\b/gi, label: '"in conclusion"' },
  { re: /\bto summari[sz]e\b/gi, label: '"to summarize"' },
  { re: /\b(let me explain|in this (article|post) we will)\b/gi, label: "meta-commentary" },
  { re: /the future (looks|is) bright/gi, label: '"the future looks bright"' },
  { re: /the possibilities are endless/gi, label: '"the possibilities are endless"' },
  { re: /only time will tell/gi, label: '"only time will tell"' },
];

const TRANSITION_OPENERS = ["furthermore", "however", "moreover", "therefore", "additionally"];

export interface VoiceIssue {
  category:
    | "em-dash"
    | "banned-word"
    | "banned-phrase"
    | "transition-opener"
    | "semicolon"
    | "list-bullet";
  term: string;
  context: string;
}

function context(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + len + 30);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

export function scanText(text: string): VoiceIssue[] {
  const issues: VoiceIssue[] = [];

  // em dashes (— and the rare — variants)
  for (const m of text.matchAll(/—|—|--/g)) {
    issues.push({ category: "em-dash", term: m[0], context: context(text, m.index!, m[0].length) });
  }

  // banned words (whole word, case-insensitive)
  for (const w of BANNED_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[-]/g, "\\-")}\\b`, "gi");
    for (const m of text.matchAll(re)) {
      issues.push({ category: "banned-word", term: m[0], context: context(text, m.index!, m[0].length) });
    }
  }

  // banned phrases
  for (const { re, label } of BANNED_PHRASES) {
    for (const m of text.matchAll(re)) {
      issues.push({ category: "banned-phrase", term: label, context: context(text, m.index!, m[0].length) });
    }
  }

  // transition openers at the start of a sentence/line
  for (const t of TRANSITION_OPENERS) {
    const re = new RegExp(`(^|[.!?\\n]\\s+)(${t})\\b`, "gi");
    for (const m of text.matchAll(re)) {
      issues.push({ category: "transition-opener", term: m[2], context: context(text, m.index!, m[0].length) });
    }
  }

  // semicolons
  for (const m of text.matchAll(/;/g)) {
    issues.push({ category: "semicolon", term: ";", context: context(text, m.index!, 1) });
  }

  // list / bullet lines inside the post
  for (const m of text.matchAll(/(^|\n)\s*([-*•]|\d+[.)])\s+/g)) {
    issues.push({ category: "list-bullet", term: m[2].trim(), context: context(text, m.index!, m[0].length) });
  }

  return issues;
}

export interface PublishCheck {
  clean: boolean;
  counts: Record<VoiceIssue["category"], number>;
  issues: VoiceIssue[];
}

export function publishCheck(text: string): PublishCheck {
  const issues = scanText(text);
  const counts: Record<VoiceIssue["category"], number> = {
    "em-dash": 0,
    "banned-word": 0,
    "banned-phrase": 0,
    "transition-opener": 0,
    "semicolon": 0,
    "list-bullet": 0,
  };
  for (const i of issues) counts[i.category]++;
  return { clean: issues.length === 0, counts, issues };
}
