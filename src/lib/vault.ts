import { supabaseAdmin } from "./supabase";
import { embed, embedMany } from "./embeddings";
import type { NoteMatch } from "./types";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

/** Split markdown into ~800-char chunks with 120-char overlap. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= CHUNK_SIZE) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

interface NoteFile {
  filename: string;
  content: string;
}

/**
 * Chunk + embed + insert a set of note files into note_chunks.
 * `source` distinguishes vault uploads from captures / qa answers.
 * Returns the number of chunks written.
 */
export async function indexNotes(
  files: NoteFile[],
  source: "vault" | "capture" | "qa",
): Promise<number> {
  const rows: { filename: string; chunk_index: number; text: string; source: string }[] = [];
  for (const f of files) {
    chunkText(f.content).forEach((text, i) =>
      rows.push({ filename: f.filename, chunk_index: i, text, source }),
    );
  }
  if (rows.length === 0) return 0;

  // Embed in batches of 96 to stay well under OpenAI request limits.
  const supabase = supabaseAdmin();
  const BATCH = 96;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vectors = await embedMany(batch.map((r) => r.text));
    const insert = batch.map((r, j) => ({ ...r, embedding: vectors[j] }));
    const { error } = await supabase.from("note_chunks").insert(insert);
    if (error) throw new Error(`note_chunks insert failed: ${error.message}`);
  }
  return rows.length;
}

/** Replace all `source: 'vault'` chunks with a fresh upload (captures/qa survive). */
export async function replaceVault(files: NoteFile[]): Promise<number> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("note_chunks").delete().eq("source", "vault");
  if (error) throw new Error(`vault wipe failed: ${error.message}`);
  return indexNotes(files, "vault");
}

/** Semantic search across note_chunks via the match_note_chunks RPC. */
export async function searchNotes(
  query: string,
  matchCount = 8,
  source?: "vault" | "capture" | "qa",
): Promise<NoteMatch[]> {
  const embedding = await embed(query);
  const { data, error } = await supabaseAdmin().rpc("match_note_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_source: source ?? null,
  });
  if (error) throw new Error(`match_note_chunks failed: ${error.message}`);
  return (data ?? []) as NoteMatch[];
}

/** Top-N unique notes (deduped by filename), best chunk kept per file. */
export async function searchNotesDeduped(
  query: string,
  topN = 3,
): Promise<NoteMatch[]> {
  const matches = await searchNotes(query, 8);
  const byFile = new Map<string, NoteMatch>();
  for (const m of matches) {
    const cur = byFile.get(m.filename);
    if (!cur || m.score > cur.score) byFile.set(m.filename, m);
  }
  return [...byFile.values()].sort((a, b) => b.score - a.score).slice(0, topN);
}
