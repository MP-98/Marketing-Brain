// ── System prompts + JSON schemas for briefing generation ────────────────
// Structured outputs (output_config.format) constrain each call to valid JSON,
// so there is no prose-parsing step and no undefined-variable risk.

export const BRAIN_SYSTEM = `You are Marketing Brain — a daily intelligence engine for a sharp D2C/FMCG marketing operator in India who also builds a personal creator presence.

Your job is to surface understanding and raw material, NOT to write finished social posts. Three lenses, every day:
1. Reactive marketing moments — a real event or viral moment (not just marketing-trade news) that a D2C/FMCG brand could react to, plus the specific reactive angle. Think Empire State Building climbers, IKEA "Punch the monkey": a real event, then the marketing angle on top.
2. Market / AI learning — one concept worth actually understanding, deep enough to teach someone else, with a failure mode and a real named case study. Not a headline.
3. People worth connecting with — tied to today's topics, who is relevant right now and why.

Be specific. Real names, real numbers, real brands, real places. A named study beats "a recent study". Never invent fake sources or fake statistics — if you are not sure a fact is real, choose a different, real one. Write in a direct, practitioner voice. No hedging, no both-sides framing, no corporate filler.`;

// ── helper to build strict object schemas ────────────────────────────────
function obj(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
const str = { type: "string" };
const strArr = { type: "array", items: { type: "string" } };

// ── Concept (heavy) ──────────────────────────────────────────────────────
export const conceptSchema = obj({
  title: str,
  theme: str,
  intro_problem: str,
  what_it_is: str,
  why_it_matters: str,
  failure_modes: {
    type: "array",
    items: obj({ title: str, body: str }),
  },
  mechanism: str,
  common_misuse: {
    type: "array",
    items: obj({ title: str, body: str }),
  },
  case_studies: {
    type: "array",
    items: obj({ brand: str, story: str, takeaway: str }),
  },
});

export function conceptPrompt(seed: string): string {
  return `Teach ONE marketing or AI-for-marketing concept today${
    seed ? `, ideally connected to: ${seed}` : ""
  }.

Go deep enough that the reader could teach it to a colleague. Return JSON:
- title: the concept name
- theme: 2-4 word theme (e.g. "brand positioning", "retention", "creative strategy")
- intro_problem: the real problem this concept solves, stated concretely
- what_it_is: a clear, plain explanation
- why_it_matters: why a D2C/FMCG marketer should care right now
- failure_modes: exactly 3 items {title, body} — how people get this wrong
- mechanism: how it actually works, the causal chain
- common_misuse: exactly 3 items {title, body} — misapplications to avoid
- case_studies: exactly 3 items {brand, story, takeaway} — real named brands, real stories`;
}

// ── Trending (light) ─────────────────────────────────────────────────────
export const trendingSchema = obj({
  items: {
    type: "array",
    items: obj({
      title: str,
      what_happened: str,
      why_interesting: str,
      what_to_do: str,
      source: obj({ publication: str, url: str }),
    }),
  },
});

export function trendingPrompt(): string {
  return `Surface 5 reactive marketing moments for today. Each is a real recent event or viral moment (culture, news, sports, tech, memes — not just marketing-trade news) that a D2C/FMCG brand could react to.

Return JSON { items: [...] }, exactly 5 items, each:
- title: the moment
- what_happened: the real event, factually
- why_interesting: why it's culturally live right now
- what_to_do: the specific reactive marketing angle a brand could take (this is the marketing lens on top)
- source: { publication, url } — a real, plausible publication and URL. Never fabricate a source that clearly wouldn't exist.`;
}

// ── Authorities (light) ──────────────────────────────────────────────────
export const authoritiesSchema = obj({
  items: {
    type: "array",
    items: obj({
      name: str,
      current_role: str,
      origin: { type: "string", enum: ["India", "Global"] },
      career: str,
      known_for: str,
      recent_piece: str,
      what_to_track: str,
      linkedin_message: str,
      where_to_follow: {
        type: "array",
        items: obj({ platform: str, handle_or_url: str }),
      },
    }),
  },
});

export function authoritiesPrompt(seed: string): string {
  return `Surface 2-3 real people worth connecting with, tied to today's topics${
    seed ? ` (${seed})` : ""
  }. Mix Indian and global marketing/brand thinkers.

Return JSON { items: [...] }, each:
- name, current_role
- origin: "India" or "Global"
- career: one-line background
- known_for: what they're known for
- recent_piece: something specific and real they recently made/said
- what_to_track: why follow them now
- linkedin_message: a DRAFT connect request under 280 characters that references something specific and real about them. This is a draft for a human to review and send — never written as if already sent.
- where_to_follow: [{ platform, handle_or_url }]

Only use real, verifiable people. Do not invent anyone.`;
}

// ── Phase 2: resources + content package + intro + takeaway (heavy) ───────
export const phase2Schema = obj({
  intro: str,
  resources: {
    type: "array",
    items: obj({
      title: str,
      description: str,
      author: str,
      format: {
        type: "string",
        enum: ["essay", "thread", "podcast", "video", "book", "report", "post"],
      },
      url: { type: ["string", "null"] },
    }),
  },
  content_package: {
    type: "array",
    items: obj({
      core_point: str,
      angle_type: { type: "string", enum: ["take", "case study", "lesson"] },
      facts_to_preserve: strArr,
      why_postable: str,
      platform_fit: str,
    }),
  },
  quick_takeaway: str,
  vault_connections: strArr,
});

export function phase2Prompt(
  conceptTitle: string,
  vaultBlock: string,
): string {
  return `Given today's concept ("${conceptTitle}"), produce the supporting material. Return JSON:

- intro: 1-2 sentences framing today's briefing.
- resources: 5-7 items {title, description, author, format, url}. Real, high-signal things worth reading/watching/listening to. format is one of essay|thread|podcast|video|book|report|post. url may be null if you can't be sure of it.
- content_package: 3-5 items. This is RAW MATERIAL for a writer, NOT finished posts. Each item:
    - core_point: the single point worth making
    - angle_type: "take" | "case study" | "lesson"
    - facts_to_preserve: the specific names/numbers/facts a writer must keep
    - why_postable: what makes it worth posting now
    - platform_fit: e.g. "LinkedIn personal", "X personal", "Instagram"
  Do NOT write finished copy. Write briefs a writer would want.
- quick_takeaway: the one thing to remember today, one punchy sentence.
- vault_connections: 0-4 short strings tying today's topics back to the reader's own notes, using the notes below. Empty array if nothing connects.

${vaultBlock ? `Reader's vault notes (for grounding):\n${vaultBlock}` : "Reader's vault is empty."}`;
}

// ── Connect-message regeneration ─────────────────────────────────────────
export const connectMessageSchema = obj({ message: str });

// ── Thought → Connect It ─────────────────────────────────────────────────
export const connectSchema = obj({
  content_angle: str,
  client_application: str,
  my_pov: str,
});

export function connectPrompt(thought: string, notesBlock: string): string {
  return `The user had this thought:
"${thought}"

Using their vault notes below, return JSON with three angles:
- content_angle: how this could become content (raw brief, not a finished post)
- client_application: how it applies to a client/brand problem
- my_pov: a sharp point of view the user could stand behind

Vault notes:
${notesBlock || "(no relevant notes found)"}`;
}
