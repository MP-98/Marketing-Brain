-- ════════════════════════════════════════════════════════════════════════
-- Marketing Brain — Supabase schema (System A: Daily Intelligence Engine)
-- Replaces the original MongoDB collections with Postgres + pgvector.
--
-- Run once in the Supabase SQL editor (or via the Supabase CLI:
--   supabase db push   /   psql "$DATABASE_URL" -f 0001_init.sql
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists vector;      -- pgvector for embeddings
create extension if not exists pgcrypto;    -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────
-- briefings — one row per day, cached by date (was Mongo `briefings`)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.briefings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,               -- YYYY-MM-DD cache key
  created_at  timestamptz not null default now(),
  tags        text[] not null default '{}',       -- auto-derived
  payload     jsonb not null                      -- full briefing document
);
create index if not exists briefings_date_desc_idx on public.briefings (date desc);
create index if not exists briefings_tags_gin_idx  on public.briefings using gin (tags);

-- ─────────────────────────────────────────────────────────────
-- briefing_jobs — durable job state (was Mongo `briefing_jobs`)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.briefing_jobs (
  id           uuid primary key default gen_random_uuid(),
  status       text not null default 'pending',   -- pending | done | error | abandoned
  stage        text,                              -- gathering_topics | generating_phase1 | ...
  sections     jsonb not null default '{}'::jsonb,-- per-section streaming status
  result       jsonb not null default '{}'::jsonb,-- partial while streaming, full when done
  errors       jsonb not null default '{}'::jsonb,
  from_cache   boolean not null default false,
  briefing_date date,
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists briefing_jobs_updated_idx on public.briefing_jobs (updated_at desc);

-- ─────────────────────────────────────────────────────────────
-- note_chunks — Obsidian vault + captures + Q&A, embedded (1536-dim)
-- (was Mongo `note_chunks`; embedding dim changed 384 → 1536 for OpenAI)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.note_chunks (
  id          uuid primary key default gen_random_uuid(),
  filename    text not null,
  chunk_index int not null default 0,
  text        text not null,
  embedding   vector(1536),
  source      text not null default 'vault',      -- vault | capture | qa
  created_at  timestamptz not null default now()
);
create index if not exists note_chunks_source_idx on public.note_chunks (source);
-- HNSW cosine index — works on empty tables, no training step (fixes the
-- original ivfflat reindex fragility called out in context.md §3.2).
create index if not exists note_chunks_embedding_hnsw_idx
  on public.note_chunks using hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- captures — quick-capture log (was Mongo `captures`)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.captures (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists captures_created_idx on public.captures (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- qa — Ask history (was Mongo `qa`)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.qa (
  id             uuid primary key default gen_random_uuid(),
  question       text not null,
  answer         text not null,
  briefing_date  date,
  sources        jsonb not null default '[]'::jsonb,
  saved_to_vault boolean not null default false,
  note_filename  text,
  created_at     timestamptz not null default now()
);
create index if not exists qa_created_idx on public.qa (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- match_note_chunks — cosine similarity search RPC
-- Returns top matches; optional source filter. score = 1 - cosine_distance.
-- ─────────────────────────────────────────────────────────────
create or replace function public.match_note_chunks (
  query_embedding vector(1536),
  match_count     int  default 8,
  filter_source   text default null
)
returns table (
  id          uuid,
  filename    text,
  chunk_index int,
  text        text,
  source      text,
  score       float
)
language sql stable
as $$
  select
    nc.id,
    nc.filename,
    nc.chunk_index,
    nc.text,
    nc.source,
    1 - (nc.embedding <=> query_embedding) as score
  from public.note_chunks nc
  where filter_source is null or nc.source = filter_source
  order by nc.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- This is a single-user personal tool; all writes go through the server
-- using the service-role key (which bypasses RLS). We enable RLS with no
-- public policies so the anon key can't read/write directly.
-- ─────────────────────────────────────────────────────────────
alter table public.briefings     enable row level security;
alter table public.briefing_jobs enable row level security;
alter table public.note_chunks   enable row level security;
alter table public.captures      enable row level security;
alter table public.qa            enable row level security;
