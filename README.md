# Marketing Brain

A daily marketing **intelligence engine** — rebuilt as a real Next.js app on **Supabase** (replacing the original MongoDB prototype).

This is **System A** from the engineer handoff (`docs/context.md`): a daily learning + intelligence + networking agent. It surfaces understanding and raw material — it does **not** write finished social posts. (System B, the content audit/rewrite tool, is a separate build.)

Every morning it produces:

1. **The Concept** — one idea, deep enough to teach, with failure modes, mechanism, and 3 real case studies.
2. **Reactive Moments** — real events/viral moments with the D2C/FMCG marketing angle on top.
3. **Worth Your Time** — 5–7 high-signal resources.
4. **People to Know** — 2–3 relevant people, each with a **draft** LinkedIn connect message (always human-reviewed before sending — see below).
5. **Content Package** — raw material for your own drafts: the core point, the facts to keep, and which angle makes it postable. **Not** finished copy.
6. **Ask** — freeform Q&A grounded in the day's brief + your Obsidian vault.

Plus **quick capture**, an **archive** (list + calendar heatmap, `tag:` search), and an Obsidian vault uploader.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 — warm editorial dark theme (Manrope / Outfit / JetBrains Mono) |
| Database | **Supabase** (Postgres + **pgvector**) |
| LLM | **OpenAI** — `gpt-4o` (concept + content package), `gpt-4o-mini` (trending / authorities / ask) |
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
                └─ background job (Next `after()`):
                     Phase 1 (parallel): concept · trending · authorities
                        └─ schema-validated; any failed section gets one recovery pass
                     Phase 2: resources + content_package + intro + takeaway
                        └─ 3s last-ditch retry on failure
                     → persist to `briefings` with auto-derived tags
             frontend polls GET /api/briefing/job/{id} every 2.5s,
             renders each section as it lands (shimmer skeletons for the rest).
```

Job state is persisted to `briefing_jobs` at every stage, so if the backend dies mid-generation the frontend detects the stale job (>3 min) and silently restarts once.

### API surface (all under `/api`)

`briefing/today` · `briefing/generate` · `briefing/job/[id]` · `briefing/archive` · `briefing/by-date/[date]` · `briefing/tags` · `authority/connect-message` · `connect` · `ask` · `qa/list` · `qa/[id]` (DELETE) · `qa/[id]/save-to-vault` · `notes/upload` · `notes/count` · `notes` (DELETE) · `capture` · `capture/list` · `capture/export`

---

## Deploying

Deploy to **Vercel** and point it at your Supabase project. Set the three env vars in the Vercel project settings. Background generation uses Next's `after()`; on serverless, keep the function timeout generous (the generate route already sets `maxDuration`). For very long vault uploads or heavy generation, a long-running host (Railway / a VM) is the more robust option.

---

## Notes / next steps

- **Trending grounding.** Trending moments are currently model-generated with a "use real, verifiable events" instruction. The highest-value enhancement is wiring OpenAI's web-search tool (Responses API) into `genTrending` so moments are grounded in live search results.
- **System B** (content audit/rewrite against `docs/content-voice-guide.md`) is intentionally out of scope for this build — see `docs/context.md` §4.
