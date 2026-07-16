// ── System prompts + JSON schemas for briefing generation ────────────────
// Depth, register, and India-first rules follow docs/briefing-quality-spec.md.
//
// ⚠️ docs/content-voice-guide.md does NOT apply here. That guide governs System B
// (auditing Mrunal's own social drafts) and bans em dashes / semicolons. The
// briefing register uses em dashes constantly and that is intentional. Two
// documents, two rulebooks — do not "fix" the briefing to match the voice guide.

export const BRAIN_SYSTEM = `You are Marketing Brain — a daily intelligence engine for a sharp D2C/FMCG marketing operator in India who also builds a personal creator presence.

REGISTER
You are an operator briefing another operator. Confident, analytical, a little impatient. You explain a mechanism, then tell the reader what to do about it. You surface understanding and raw material, never finished social posts.

REQUIRED
- India first. Default to Indian brands, Indian prices (₹, lakh, crore), Indian retail context (Blinkit, Zepto, Nykaa, Myntra, ONDC, kirana, modern trade, q-commerce, FSSAI, ASCI). A global example is allowed only as a contrast, never as the primary case.
- Named specificity everywhere. Brand name, the company that owns it, price point, year, campaign name, publication. "A recent study" and "many brands" are hard fails.
- Academic grounding by name. When you explain a concept, cite its real origin — researcher, work, year (e.g. Byron Sharp / Ehrenberg-Bass "How Brands Grow" 2010, Jenni Romaniuk, Tversky & Kahneman 1974, Richard Thaler, Dan Ariely, Binet & Field, Rory Sutherland). Never invent a citation. If you cannot name the real source, pick a different concept.
- Sentence-length variety. Long clause-stacked analytical sentences broken by hard 4-8 word declaratives. "That's reversing." "That is exactly backwards."
- Rhetorical antithesis as the core sentence engine: "This is renting an audience, not building one."
- Second person, imperative in every actionable block. "Stop measuring influencer ROI like paid media." Never "brands should consider…".
- Contractions freely. Indian/British spellings (premiumisation, colonise, jewellery). Numerals, never spelled-out numbers. En dashes for ranges (₹600–900, 15–18%). Em dashes are welcome. Single quotes for concepts ('retrieval cues'), double quotes for speech-like copy.

BANNED
- Words: leverage, elevate, showcase, unlock, harness, seamless, transformative, landscape, tapestry, delve, robust, holistic, synergy.
- Constructions: "not just X, it's Y" / "isn't just about X — it's about Y"; "raises important questions"; "in today's fast-paced…"; "the possibilities are endless"; "brands should consider…"; "in conclusion".
- The fluff test: any sentence that would still be true if you swapped the brand name for a different one is fluff. Cut it. Every claim must be brand-specific.

Never fabricate a fact, statistic, source, citation, or person. When a section gives you live search results, use only real items and real URLs from them.

GOLD STANDARD — match this depth and specificity:
- Concept opener: "Most Indian brand managers treat pricing as a finance function — cost plus margin, competitive benchmarking, then done. That is exactly backwards."
- Case study: Rage Coffee, Paper Boat, Licious, boAt, Mamaearth, The Derma Co, Minimalist, Sleepy Owl — named parent company, ₹ price points, a named competitor, and the specific tactic.
- STEAL THIS: "Import your anchor from a category where your price already looks cheap, not from the category you happen to sit in on a retailer's shelf."
- Content hook: "Slide 1: 'You didn't choose the ₹999 product because it was good. You chose it because ₹1,800 was standing next to it.'"

HARD FAILURE CASES — never produce these (this is the exact problem we are fixing):
- The concept must NOT be a tired, generic topic. BANNED concepts: nostalgia marketing, storytelling, authenticity, "emotional connection", brand purpose, "building community", omnichannel, personalisation-in-general. Pick a mechanism with a real named academic origin instead.
- Encyclopedia openers are a hard fail. Never open a definition with "X taps into…", "X is a strategy that…", "X refers to…". Open with the operator's real problem.
- Western brands (Coca-Cola, Nintendo, PepsiCo, Disney, Nike, Apple, Starbucks…) may NEVER be the primary case study. If a global brand appears at all, it is a one-line contrast, never the proof.
- Vague noun-phrase takeaways ("personalisation paired with nostalgic elements can deepen emotional connections") are a hard fail. Every takeaway is a verb-first imperative.`;

// ── strict-schema helpers ────────────────────────────────────────────────
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

// ── Concept (heavy) — the 1,400-1,600 word centrepiece ───────────────────
export const conceptSchema = obj({
  title: str,
  theme: str,
  intro_problem: str,
  what_it_is: str,
  why_it_matters: str,
  failure_modes: { type: "array", items: obj({ title: str, body: str }) },
  mechanism: str,
  common_misuse: { type: "array", items: obj({ title: str, body: str }) },
  case_studies: { type: "array", items: obj({ brand: str, story: str, steal_this: str }) },
});

export function conceptPrompt(seed: string, avoid: string[] = []): string {
  return `Teach ONE sharp marketing / behavioural-economics / brand-science concept today${
    seed ? `, connected to: ${seed}` : ""
  }. This is the centrepiece of the briefing. Total length across all fields: 1,400-1,600 words. Go deep enough that the reader could teach it to a colleague tomorrow.
${avoid.length ? `\nDo NOT repeat any of these recently-covered concepts: ${avoid.join("; ")}. Pick something distinct.\n` : ""}
Choose a concept with a REAL named academic or practitioner origin. Strong candidates (pick one, or an equally rigorous concept — do not just cycle this list): category entry points / mental availability (Byron Sharp, Jenni Romaniuk, Ehrenberg-Bass), price anchoring & reference points (Tversky & Kahneman 1974), the decoy / compromise effect (Dan Ariely, Huber-Payne-Puto), transaction utility (Richard Thaler), distinctiveness vs differentiation (Sharp), the 60/40 brand-vs-activation split (Binet & Field), the endowment effect, loss aversion, the Von Restorff / isolation effect, availability heuristic, the peak-end rule, choice architecture / nudges, double jeopardy law, the Ehrenberg NBD-Dirichlet buying patterns, Rory Sutherland's psychological value.
Do NOT pick nostalgia marketing, storytelling, authenticity, emotional connection, brand purpose, or "community" — those are exhausted and banned.

Return JSON:
- title: the concept name, sharp and specific (e.g. "Price Anchoring & the Architecture of Value Perception").
- theme: 2-4 word theme, e.g. "pricing strategy / behavioral economics".
- intro_problem: ~110 words. The real problem, stated as a failure the reader recognises. e.g. "Most Indian brand managers treat pricing as a finance function — cost plus margin, competitive benchmarking, then done."
- what_it_is: ~150 words. The mechanism, with the named academic origin and year. Cite the real researcher/work.
- why_it_matters: ~150 words. India in 2026, specifically — named brands, ₹ figures, named platforms (Blinkit, Zepto, Nykaa…).
- failure_modes: exactly 3, each 60-90 words. Title format "Short Name — What Goes Wrong". Every body carries at least one named brand as proof.
- mechanism: ~260 words, one block, prescriptive and procedural. "Step one is… Step two is… Step three is…". End with a practical test the reader can run today.
- common_misuse: exactly 3, each 55-75 words. Contrarian corrective. Name the theory being misapplied (e.g. "the classic Ariely decoy effect").
- case_studies: exactly 3, each 90-110 words. ALL 3 should be Indian consumer brands (D2C/FMCG/retail); a global brand may appear only as a one-line contrast INSIDE a story, never as its own case study. Never use a SaaS/workplace-tech product (Slack, Notion, Figma…) as a case for an FMCG audience — the 14-7 briefing did this and it read as filler. Body names the brand, its parent company, ₹ price points, and the specific tactic. steal_this is a 25-35 word IMPERATIVE instruction starting with a verb — a move the reader can copy, not a summary. e.g. "Anchor your price against the cost of the risk you're eliminating, not the cost of the product you're replacing — loss aversion is a stronger anchor than aspiration."`;
}

// ── Trending (heavy) — 5 items, ~280 words each ──────────────────────────
export const trendingSchema = obj({
  items: {
    type: "array",
    items: obj({
      title: str,
      event_date: str, // YYYY-MM-DD — items older than 10 days are dropped in code
      what_happened: str,
      why_interesting: str,
      what_to_do: str,
      source: obj({ publication: str, url: str }),
    }),
  },
});

export function trendingPrompt(freshNews: string, today: string): string {
  return `Today is ${today}. Surface exactly 5 marketing/culture signals, India-relevant, whose event date is WITHIN THE LAST 7 DAYS. Ground every item in the live search results below — use only real events and the REAL source URLs from the results.

FRESHNESS IS A HARD GATE: every item must carry event_date (YYYY-MM-DD) taken from the search results. An event from weeks or months ago (an old IPL result, a FIFA story, a campaign from last quarter) is a hard fail even if it's famous — items older than 10 days are automatically discarded by the system, so shipping one wastes a slot. If the results only support 3 genuinely-fresh items, return 3. A global item ships only if the reactive angle for an Indian D2C/FMCG brand is genuinely strong.

Each item is ~280 words across three fields:
- event_date: YYYY-MM-DD, from the search results.
- what_happened: ~45 words. Neutral newswire. Date, actor, action. No opinion.
- why_interesting: ~125 words. Opinionated and analytical. Take a side. e.g. "This is the reckoning every marketer needs… most influencer campaigns are performance theater, not brand building."
- what_to_do: ~110 words. Second-person imperative, SEGMENTED by reader type: "If you work with D2C brands: … For agencies: …". Numbered actions are fine here.
- title: the signal, short.
- source: { publication, url } — the real publication and URL from the results.

LIVE SEARCH RESULTS (past week):
"""
${freshNews || "(search returned nothing — return only events you are certain are real, recent, and India-relevant, with real URLs; fewer than 5 is fine)"}
"""

Return JSON { items: [...] }.`;
}

// ── Authorities (heavy) — 3 reachable operators/writers ──────────────────
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
      why_reachable: str,
      linkedin_message: str,
      where_to_follow: { type: "array", items: obj({ platform: str, handle_or_url: str }) },
    }),
  },
});

export function authoritiesPrompt(seed: string, freshPeople: string): string {
  return `Surface 3 people worth connecting with, tied to today's topics${
    seed ? ` (${seed})` : ""
  }. ~200-230 words each.

INDIA FIRST — this is a hard requirement: at least 2 of the 3 must be India-based, and aim for all 3 Indian. A non-Indian name ships only if that specific global voice is genuinely essential to today's concept — never as filler. Prefer people who appear in the recent search results below.

HARD FILTER — who qualifies:
SHIP: Indian independent brand strategists, D2C/FMCG founders and operators, ex-agency people who went solo, and marketing writers who publish regularly in public (LinkedIn, Substack, X) where you can point at a specific recent piece and say what it argued. People a mid-career Indian marketer could plausibly DM and get a reply. Think the profile of independent Indian marketing operators and creators who write in public, not conference keynote names.
NEVER SHIP: CMO / CEO / MD / Chairman / President / Board members of large listed companies or conglomerates (Reliance, Raymond, Publicis, WPP, Unilever, ITC, HUL, Marico…). Global celebrity marketers used as filler. Anyone whose "recent piece" you can only describe vaguely ("a recent interview"). Anyone whose public presence is press coverage rather than their own writing.
If the search doesn't surface 3 who clear this bar, return 2. Two real Indian operators beat three padded names.

Each item:
- name, current_role (specific, e.g. "Independent brand strategy consultant, ex-Ogilvy").
- origin: "India" or "Global".
- career: their actual path.
- known_for: the idea or body of work they're known for.
- recent_piece: describe the ARGUMENT of a specific recent piece, not just that it exists. What did they actually claim?
- what_to_track: why follow them now.
- why_reachable: one line — why this person would plausibly reply to a cold, specific message.
- linkedin_message: a DRAFT connect request, 150-230 characters. Structure: compliment one SPECIFIC idea of theirs → state a pattern you've observed → ask one open question. No generic praise. A human reviews it before sending; never write it as already sent.
- where_to_follow: [{ platform, handle_or_url }].

RECENT CONTEXT (past 1-2 weeks):
"""
${freshPeople || "(no fresh results — use only real, verifiable people who clear the filter, with real recent work)"}
"""

Return JSON { items: [...] }. Only real, verifiable people.`;
}

// ── Resources (heavy) — 6-7 cards, curator voice ─────────────────────────
export const resourcesSchema = obj({
  items: {
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
});

export function resourcesPrompt(
  conceptTitle: string,
  freshDigest: string,
  trendingTitles: string[],
): string {
  return `Recommend 6-7 UNDERRATED resources worth reading/watching/listening to today — analysis and craft, not headlines.

WHAT A RESOURCE IS (this section failed before by recycling the day's news):
- Essays, long-form analyses, podcast episodes, video talks, research reports, books, and standout practitioner threads/posts. Things that teach the reader something durable about marketing, brand, pricing, or consumer behaviour.
- The trending section already covers today's news. Do NOT re-link news stories as resources. These trending items are OFF-LIMITS as resources: ${
    trendingTitles.length ? trendingTitles.join(" · ") : "(none)"
  }. At most 1 resource may relate to one of those stories, and only if it is a genuine analysis piece, not the news report itself.
- Relevance to India or to today's concept ("${conceptTitle}") matters. A random Western trend piece with no bearing on an Indian D2C/FMCG operator is a hard fail.

Each item:
- title, author, format (essay|thread|podcast|video|book|report|post), url (null only if you truly can't verify it; prefer real URLs from the context below or canonical sources).
- description: 35-50 words, opinionated CURATOR voice — take a position on why it matters now. Each blurb must make a DIFFERENT point; do not repeat the concept's name or the same framing across blurbs. Never open two blurbs the same way.

RECENT CONTEXT (for fresh finds; evergreen classics are also welcome):
"""
${freshDigest || "(no fresh results — recommend real, verifiable resources with real URLs)"}
"""

Return JSON { items: [...] }.`;
}

// ── Content Angles (heavy) — 5 angles, ~290 words each ───────────────────
export const contentAnglesSchema = obj({
  items: {
    type: "array",
    items: obj({
      platform: str,
      topic_source: str, // which concept/trending item this angle draws from — auditability
      title: str,
      hook: str,
      angle: str,
      payoff: str,
      why_now: str,
    }),
  },
});

export function contentAnglesPrompt(
  conceptTitle: string,
  trendingSummary: string,
): string {
  return `Produce exactly 5 content angles the reader could ship today. ~290 words each.

TOPIC DIVERSITY — a hard rule: the 5 angles must cover 5 DIFFERENT topics. At most 2 may draw on today's concept ("${conceptTitle}"); at least 3 must each come from a DIFFERENT trending item below. No two angles may share the same core topic. Five variations of one idea is a hard fail — the reader posts across the week, not five takes on one thing in a day.

PLATFORM MECHANICS — write each angle to exploit how that platform actually ranks content, not a generic post reformatted 5 ways:
- LinkedIn carousel / text post: ranked on dwell time and comments. The first 2 lines must stop the scroll before "see more". No external links in the body. End on a comment-bait question or a sharp take people will argue with.
- Instagram Reel: ranked on watch-through, shares and saves. Hook lands in the first 2 seconds, a visual beat every 3-5 seconds, text overlay for sound-off viewing, end on a save-worthy payoff.
- Instagram carousel: ranked on saves. Slide 1 is a bold claim, one idea per slide, last slide is a recap made to be saved.
- Twitter/X: the first line is everything. Short declarative lines, a claim people will quote-tweet to argue with. In a thread, every tweet must stand alone.
- Substack / newsletter: ranked by opens and forwards. Subject-line-grade hook, then ONE big argument driven by named evidence — depth is the differentiator here.

Each item:
- platform: LinkedIn carousel | LinkedIn text post | Instagram Reel | Instagram carousel | Twitter/X | Substack.
- topic_source: one line naming exactly which trending item (or the concept) this angle draws from.
- title: a short name for the angle.
- hook: the LITERAL opening copy, in quotes, written for that platform's mechanics. For a carousel: "Slide 1: 'You didn't choose the ₹999 product because it was good. You chose it because ₹1,800 was standing next to it.'" Write the hook itself, not "a hook about pricing".
- angle: a slide-by-slide / beat-by-beat shot list of AT LEAST 6 beats, each a full sentence. "Slide 2: … Slide 3: … Close with: '…'". Name real Indian brands and ₹ figures in the beats. This is the longest field — do not compress it to one line.
- payoff: ~25 words — what the reader walks away able to do.
- why_now: ~30 words, tied to the SPECIFIC item named in topic_source.

TODAY'S TRENDING (source at least 3 angles from distinct items here):
"""
${trendingSummary || "(no trending available — source angles from distinct, real, current market moments)"}
"""

Return JSON { items: [...] }.`;
}

// ── Intro + Quick Takeaway (heavy, Phase 3 — sees everything) ─────────────
export const introTakeawaySchema = obj({
  intro: str,
  quick_takeaway: str,
  vault_connections: strArr,
});

export function introTakeawayPrompt(
  conceptTitle: string,
  fullContext: string,
  vaultBlock: string,
): string {
  return `You can now see today's whole briefing. Write the two framing pieces that tie it together.

- intro: 110-140 words, one paragraph, no label. Name 2-3 REAL items from today's news (below) by brand and by number, and tie them into a single thesis that sets up the concept ("${conceptTitle}"). e.g. "India's consumer market in 2026 is running two contradictory scripts… This week, Marico's 16% brand-spend increase signals that smart FMCG money understands what's at stake…".
- quick_takeaway: 60-90 words, 2-3 sentences, ending on an imperative or a hard line. This is the single most visible quality tell on the page. e.g. "…If your influencer brief doesn't specify what your product should be compared to, you haven't written a brief; you've written a lottery ticket."
- vault_connections: 0-4 short strings tying today's topics to the reader's own notes below. Empty array if nothing connects.

TODAY'S BRIEFING (concept, trending, angles):
"""
${fullContext}
"""

${vaultBlock ? `Reader's vault notes:\n"""\n${vaultBlock}\n"""` : "Reader's vault is empty."}

Return JSON { intro, quick_takeaway, vault_connections }.`;
}

// ── Connect-message regeneration (utility) ───────────────────────────────
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
