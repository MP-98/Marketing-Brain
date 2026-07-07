# Context.md — Marketing Brain v1 (Engineer Handoff)

This is the full context for rebuilding "Marketing Brain" properly, as a real
web app, replacing the Emergent prototype. Read this whole file before
touching code. It covers what already exists, what's broken, and what to
change or add.

---

## 0. Who this is for, and the two-system split

There are **two separate systems**. Do not merge them.

**System A — Daily Intelligence Engine.** Runs every morning. Surfaces
what's worth knowing and who's worth knowing. Outputs understanding and raw
material. Does **not** write finished social posts.

**System B — Content Writing & Audit.** Mrunal writes his own drafts by
hand. This system's job is to audit and rewrite them against a strict voice
guide (attached separately as `content-voice-guide.md`), not to generate
content from scratch. Topics from System A can inform what he writes about,
but the writing itself starts with him.

This split is intentional. Earlier prototypes blurred the line by having
the engine draft finished posts directly; that's being removed. Keep the
handoff between the two systems as clean data (a "topic package"), not
finished copy.

---

## 1. System A — what already exists (Emergent v0, to rebuild)

### 1.1 File footprint (original)
- Backend: FastAPI, single `server.py` (~1300-1480 lines), all endpoints,
  all Claude API calls, all Mongo I/O.
- Frontend: React, single page (`MarketingBrain.jsx`) orchestrating 4
  components: `BriefingView`, `AskSection`, `SettingsDialog`,
  `ArchivePopover`. shadcn/ui for base components, untouched.
- ~3,300 lines total across files Mrunal owns.

### 1.2 MongoDB collections (original schema, keep the shape, fix the bugs)

**`briefings`** — one doc per day, cached by date. Payload contains:
- `intro`
- `concept` — title, theme, intro_problem, what_it_is, why_it_matters,
  failure_modes[3], mechanism, common_misuse[3], case_studies[3]
- `trending[5]` — title, what_happened, why_interesting, what_to_do, source
- `resources[5-7]` — title, description, author, format, url
- `authorities[2-3]` — name, current_role, origin, career, known_for,
  recent_piece, what_to_track, `linkedin_message` (<280 chars, draft only,
  never auto-sent), where_to_follow
- `content_angles[5]` — platform, title, hook, angle, payoff, why_now
  **[v1 change: replace this with a "content package" — see §3.4]**
- `quick_takeaway`, `generated_at`, `date`

**`briefing_jobs`** — durable job state so generation survives restarts.
Tracks `status`, `stage`, per-section `sections{}` status, partial `result`,
`errors`, timestamps.

**`note_chunks`** — Obsidian vault, chunked (~800 chars, 120 overlap),
embedded with `all-MiniLM-L6-v2` (384-dim). `source` field distinguishes
`vault` / `capture` / `qa`. Re-uploading the vault only wipes `source:vault`
chunks.

**`captures`** — flat quick-capture log, also mirrored into `note_chunks`.

**`qa`** — every question asked + answer + which vault chunks were used +
whether it was saved back into the vault as a note.

### 1.3 API endpoints (original, keep the surface, fix the internals)
- `GET /api/briefing/today`, `POST /api/briefing/generate?force=`,
  `GET /api/briefing/job/{id}`
- `GET /api/briefing/archive?q=`, `GET /api/briefing/by-date/{date}`,
  `GET /api/briefing/tags`
- `POST /api/authority/connect-message`
- `POST /api/connect` (Thought → Connect It: embeds a thought, cosine-scores
  against vault chunks, returns content_angle/client_application/my_pov)
- `POST /api/ask`, `GET /api/qa/list`, `DELETE /api/qa/{id}`,
  `POST /api/qa/{id}/save-to-vault`
- `POST /api/notes/upload` (zip of vault), `GET /api/notes/count`,
  `DELETE /api/notes`
- `POST /api/capture`, `GET /api/capture/list`, `GET /api/capture/export`

### 1.4 Generation flow (original, this part worked, keep it)
Two-phase parallel generation: Phase 1 (concept, trending, authorities in
parallel, haiku with sonnet fallback, schema-validated, one recovery pass on
failure) then Phase 2 (resources + content angles + intro + takeaway on
sonnet, with a 3-second last-ditch retry). Job state persisted at every
stage change so the frontend can poll and recover from a dead backend.
Cost was roughly $0.35 per fresh day, $0 on cache hit.

### 1.5 Known bugs to fix on rebuild (from a code review of v0)
These are real, not stylistic nitpicks:
- Undefined-variable risk: `_embedder` may not be initialized on all code
  paths; `msg` in the connect-message generator can be undefined in some
  branches; `d` (3 occurrences) and `parsed` similarly unguarded. Add proper
  initialization or null checks before use everywhere flagged.
- `is` used for literal/string comparison in a few spots (identity check,
  not value check) — replace with `==`.
- Several functions are doing too much: topic gathering, the main job
  runner, archive querying, tag extraction, and note upload all need to be
  split into smaller single-purpose functions. The job runner especially
  (128 lines, high branching) is the one most worth breaking apart first,
  since it's the thing failing "almost every day" in production.
- Low type-hint coverage. Add types as you touch each function, don't do it
  as a separate pass.

---

## 2. What was missing from the "content ideas" framing (corrected scope)

The engine is not just a content-ideas tool. It's a daily **learning +
intelligence + networking** agent. Keep all of these:

- **Learning**: explain one real concept a day deeply enough to teach
  someone else, with a failure mode and a real case study, not a headline.
- **Trending, with a marketing lens**: real-world news/viral moments (not
  just marketing-trade news) a D2C/FMCG brand could react to. Pattern to
  match: Empire State Building climbers, IKEA's "Punch the monkey"
  campaign — a real event, then the reactive marketing angle on top.
- **People worth connecting with**: tied to the day's topics, who's
  relevant right now, why, and a drafted (never auto-sent) LinkedIn connect
  message referencing something specific and real.
- **Obsidian grounding**: today's topics should connect back to what's
  already in the vault, not live in isolation.
- **Ask**: freeform Q&A grounded in that day's brief + the vault.
- **Quick capture** and **archive/search** over past briefings.

---

## 3. What to change for v1

### 3.1 Topic relevance filter (`topic-lens` logic)
Three categories, all in scope daily:
1. Reactive marketing moments (real event + brand-reaction angle)
2. Market/AI learning (concept worth actually understanding)
3. People worth connecting with (derived from 1 and 2)

### 3.2 Obsidian grounding — reconsider the embedding pipeline
The original MiniLM + chunk + cosine-similarity approach works but is one
of the more failure-prone, expensive parts of the system. Worth deciding
early: keep vector search for scale, or do direct full-text/semantic search
over the vault at request time (no pre-indexing, no `note_chunks`
collection to maintain). If the vault stays a personal, moderate-size
collection of notes, the simpler approach may be more reliable. If it needs
to scale to thousands of notes, keep the vector index but fix the reindex
bugs first.

### 3.3 People/connect messages — always human-reviewed
Never send anything automatically. Draft messages, surface them, require
explicit per-message approval before anything goes out. This is a standing
decision, not a v1-only limitation — flag it clearly in the UI as a manual
step regardless of how automated the rest becomes.

### 3.4 Content handoff format — the actual v1 change
Replace `content_angles` (finished-feeling post drafts) with a **content
package**: the core point worth making, the specific facts/names/numbers to
preserve, and which angle makes it postable (a take, a case study, a
lesson). This is raw material, not copy. It should read like a brief a
writer would want, not a draft a writer would just publish.

---

## 4. System B — Content Writing & Audit (separate system, minimal scope)

Mrunal writes the actual post himself. This system's only job:

1. Take his draft as input.
2. Run the 3-pass process defined in the attached `content-voice-guide.md`:
   **Audit** (flag every voice/rhythm/banned-word violation, one line each,
   no rewriting yet) → **Critique** (one sentence per flag on what's wrong
   and what's needed) → **Rewrite** (apply Voice/Rhythm/Specificity rules,
   keep every fact/figure/name/claim, stay within ~10% of original length).
3. Output the rewritten version plus the flags that were fixed, so he can
   see what changed and why.

No content generation from a topic belongs in this system. If a topic
package from System A is pasted in as a starting point, treat it the same
as a draft, still audit/rewrite it, don't generate fresh copy from scratch.

Platform-specific rules matter a lot here (see the voice guide's Platform
Notes section) — LinkedIn and X are not interchangeable, and repurposed
long-form content dressed up as an X post is a hard fail.

---

## 5. Accounts in scope
- LinkedIn personal (live), LinkedIn company (not launched)
- X personal (live), X company (to build)
- Instagram is Mrunal's primary personal platform today; Reddit, X, and
  Discord are planned expansions for his own creator presence, separate
  from the agency accounts above.

---

## 6. Open decisions for the engineer to flag back, not solve unilaterally
- Vector search vs. direct file search for Obsidian grounding (§3.2).
- Whether connect-message review becomes a proper approve/reject UI step
  in v1, or stays a plain drafts list for now.
- Hosting: original ran on a preview URL via Emergent; needs a real home
  (Vercel/Railway/own VM). `.env` shape is documented in the original
  ARCHITECTURE.md if still available; otherwise rebuild `.env.example`
  from the endpoint list above.

---

## 7. Attach alongside this file
- `content-voice-guide.md` (the full voice/rhythm/banned-word rules for
  System B)
- Original `ARCHITECTURE.md`, if you want the byte-for-byte original schema
  and endpoint reference in addition to the summary above.
