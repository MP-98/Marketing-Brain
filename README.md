# Marketing Brain

A daily marketing **intelligence engine** — rebuilt as a real Next.js app on **Supabase** (replacing the original MongoDB prototype).

This is **System A** from the engineer handoff (`docs/context.md`): a daily learning + intelligence + networking agent. It surfaces understanding and raw material — it does **not** write finished social posts. **System B** (Content Studio, at `/studio`) is the separate content audit/rewrite tool — see below.

Every morning it produces:

1. **§1 Concept of the Day** — one concept, 1,400–1,600 words, India-first, with a **named academic citation**, 3 failure modes, a procedural mechanism, 3 misuses, and 3 case studies (≥2 Indian) each ending in a `STEAL THIS` imperative.
2. **§2 What's Trending** — 5 real, this-week signals (grounded in **live web search**), accordion, ~280 words each, split into `WHAT HAPPENED / WHY IT'S INTERESTING / WHAT TO DO WITH IT`.
3. **§3 Underrated Resources** — 6–7 cards, opinionated curator blurbs that tie each back to the day's concept.
4. **§4 Authorities to Know** — exactly 3 *reachable* operators/writers (no C-suite of listed companies), each with a `why reachable` line + a 150–230-char **draft** LinkedIn message (human-reviewed before sending).
5. **§5 Content Angles** — 5 ready-to-ship post ideas, accordion, ~290 words each: a literal `HOOK`, a slide-by-slide `ANGLE`, `PAYOFF`, and a `WHY NOW` tied to today's trending.
6. **§6 Ask** — freeform Q&A grounded in the day's brief + your Obsidian vault.

The register is deliberately different from System B: the briefing is an operator briefing another operator (em dashes welcome), tuned to `docs/briefing-quality-spec.md`. Content Package was removed.

Plus **quick capture**, an **archive** (list + calendar heatmap, `tag:` search), and an Obsidian vault uploader.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 — warm editorial dark theme (Manrope / Outfit / JetBrains Mono) |
| Database | **Supabase** (Postgres + **pgvector**) |
| LLM | **OpenAI** — `MB_MODEL_HEAVY` (default `gpt-5`) runs every content section; `MB_MODEL_UTILITY` (default `gpt-4o-mini`) runs only the topic seed, web search, and Ask/Connect helpers |
| Embeddings | **OpenAI** `text-embedding-3-small` (1536-dim) |

### What changed vs the MongoDB original

- **MongoDB collections → Postgres tables** (`briefings`, `briefing_jobs`, `note_chunks`, `captures`, `qa`). Same shapes, typed.
- **MiniLM (384-dim, local) → OpenAI embeddings (1536-dim)** stored in a pgvector `vector(1536)` column, searched via an **HNSW** cosine index + the `match_note_chunks` RPC (no ivfflat training step — fixes the original reindex fragility, `context.md` §3.2).
- **Fragile JSON-from-prose parsing → structured outputs** (OpenAI `response_format: json_schema`, strict mode), so the model is constrained to valid JSON. This removes the whole class of parsing / undefined-variable bugs flagged in `context.md` §1.5.
- **v1 content change (§3.4):** `content_angles` (finished-feeling drafts) → **`content_package`** (raw material for a writer).
- Connect messages are **always drafts**, shown as an editable field flagged "review before sending" (§3.3).
- The job runner is split into small single-purpose functions (`context.md` §1.5).

---

## Setup

### 1. Supabase

Create a project, then run the schema in the SQL editor:

```
supabase/migrations/0001_init.sql
```

It enables `pgvector`, creates the five tables + indexes, and the `match_note_chunks` search function. RLS is on with no public policies — all writes go through the server using the service-role key.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in:

| Var | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (**server only** — never exposed to the browser) |
| `OPENAI_API_KEY` | platform.openai.com (powers both generation and embeddings) |

Optional overrides: `MB_MODEL_HEAVY`, `MB_MODEL_LIGHT`, `MB_EMBED_MODEL`.

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Open the app → **Generate today's brief**. It streams in section by section (concept, trending, authorities in parallel, then resources + content package). Upload your Obsidian vault as a `.zip` of `.md` files via the gear icon to ground Ask and the daily brief in your own notes.

---

## How generation works

```
GET /api/briefing/today
  ├─ exists → render (cost $0)
  └─ empty  → POST /api/briefing/generate → { job_id }
                └─ background job (Next `after()`), 3 phases on the HEAVY model:
                     seed (utility) → 2× web_search (utility, freshness)
                     Phase 1 (parallel): concept · trending · authorities
                        └─ schema-validated; failed section gets one recovery pass
                     Phase 2 (parallel): resources · content_angles
                     Phase 3: intro + quick_takeaway (generated LAST, sees the
                        whole briefing, so it can tie the news → concept → angles)
                     → persist to `briefings` with auto-derived tags
             frontend polls GET /api/briefing/job/{id} every 2.5s,
             renders each section as it lands (shimmer skeletons for the rest).
```

Per-section token usage is logged to the server console (`[briefing] concept · gpt-5 · N in / M out`) so a quality/cost regression is visible the day it happens.

Job state is persisted to `briefing_jobs` at every stage, so if the backend dies mid-generation the frontend detects the stale job (>3 min) and silently restarts once.

### API surface (all under `/api`)

`briefing/today` · `briefing/generate` · `briefing/job/[id]` · `briefing/archive` · `briefing/by-date/[date]` · `briefing/tags` · `authority/connect-message` · `connect` · `ask` · `qa/list` · `qa/[id]` (DELETE) · `qa/[id]/save-to-vault` · `notes/upload` · `notes/count` · `notes` (DELETE) · `capture` · `capture/list` · `capture/export`

---

## Deploying

Deploy to **Vercel** and point it at your Supabase project. Set the three env vars in the Vercel project settings. Background generation uses Next's `after()`; on serverless, keep the function timeout generous (the generate route already sets `maxDuration`). For very long vault uploads or heavy generation, a long-running host (Railway / a VM) is the more robust option.

---

## Notes / next steps

- **Freshness.** Trending, Authorities, and Resources are grounded in **live web search** — the generate job runs two OpenAI `web_search` (Responses API) queries first (recent news + recent people/essays) and the model may only use real events/URLs from those results. This is what stops the "old news" problem.
- **Cost & timing (important with `gpt-5`).** The depth upgrade puts ~6 content calls on the heavy model across 3 phases. Target cost is **≈ $0.35 per fresh briefing** (matching the `mar-br-*` reference); cached loads stay $0. But generation now takes **~2–5 minutes** on `gpt-5`. That matters for hosting: it will exceed **Vercel Hobby's 60s** and can exceed **Pro's 300s** function cap. For reliable generation, run on a long-running host (Railway / a VM) or move the job to a queue/worker. The frontend's abandon-and-retry recovery keeps the UI sane, but a briefing only *saves* if the job finishes within the function's time limit. Set `MB_MODEL_HEAVY` to a faster model if you need to fit a tighter cap.
- **Acceptance check.** After a real run, verify against `docs/briefing-quality-spec.md` §8: concept ≥1,300 words, ≥6 named Indian brands, a real citation, no C-suite authorities, and a clean banned-word grep over the payload.

---

## System B — Content Studio (`/studio`)

A deliberately separate, minimal tool (`docs/context.md` §4). **You** write the draft; this audits and rewrites it against the voice guide (`docs/content-voice-guide.md`). It never generates from a topic — paste a System A content package in and it's treated as a draft to fix, not a prompt to expand.

Pick a target (LinkedIn personal/company, X personal/company, Instagram), paste a draft, hit **Audit & Rewrite**. It runs the guide's 3-pass process:

1. **Audit** — flags every violation (banned words, em dashes, banned phrases, formal transitions, semicolons, same-length-sentence runs, hedges, rhythm-only triads, generic phrasing).
2. **Critique** — one sentence per flag on what's wrong and what it needs.
3. **Rewrite** — applies Voice / Rhythm / Specificity, keeps every fact/figure/name, stays within ~10% of length, and respects platform notes (repurposed long-form dressed as an X post is a hard fail).

Two layers under the hood:
- **`src/lib/voice.ts`** — a deterministic regex scanner for the "hard nos". It's exact and free: it grounds the LLM audit **and** re-checks the rewrite, so the UI shows a green "publish check passed" only when the rewrite is genuinely clean.
- **`src/lib/audit.ts`** + `POST /api/audit` — the LLM 3-pass (strict structured output, `gpt-4o`), with the voice guide embedded in the system prompt (`src/lib/voiceGuide.ts`).

Kept clean-separate from System A per the handoff: its own route, API, lib files, and UI — sharing only the OpenAI wrapper and design primitives.
