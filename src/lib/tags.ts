import type { BriefingPayload } from "./types";

// A light, deterministic tag extractor. Pulls a theme tag, brand tags from case
// studies, format tags, and a small keyword vocabulary. No LLM call → free, and
// there's no undefined-variable risk (a bug class flagged in context.md §1.5).

const KEYWORDS: Record<string, string[]> = {
  cep: ["category entry point", "cep"],
  d2c: ["d2c", "direct-to-consumer", "dtc"],
  fmcg: ["fmcg", "cpg", "packaged goods"],
  brand: ["brand positioning", "brand building"],
  performance: ["performance marketing", "roas", "cac"],
  retention: ["retention", "churn", "loyalty"],
  ai: ["ai", "llm", "generative"],
  creator: ["creator", "influencer", "ugc"],
  social: ["linkedin", "instagram", "reddit", "x/twitter", "tiktok"],
  positioning: ["positioning", "differentiation"],
  pricing: ["pricing", "price"],
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function deriveTags(payload: BriefingPayload): string[] {
  const tags = new Set<string>();

  // Full text to scan against the keyword vocabulary.
  const hay = JSON.stringify(payload).toLowerCase();
  for (const [tag, needles] of Object.entries(KEYWORDS)) {
    if (needles.some((n) => hay.includes(n))) tags.add(tag);
  }

  // Theme of the day's concept.
  if (payload.concept?.theme) tags.add(slug(payload.concept.theme));

  // Brands from case studies → brand:<slug>.
  for (const cs of payload.concept?.case_studies ?? []) {
    if (cs.brand) tags.add(`brand:${slug(cs.brand)}`);
  }

  // Resource formats.
  for (const r of payload.resources ?? []) {
    if (r.format) tags.add(r.format);
  }

  return [...tags].filter(Boolean).slice(0, 24);
}
