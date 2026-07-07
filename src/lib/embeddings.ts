import OpenAI from "openai";
import { env } from "./env";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiKey() });
  return _client;
}

/** Embed one string → 1536-dim vector. */
export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: env.embedModel(),
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

/** Embed many strings in one request. Preserves order. */
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await client().embeddings.create({
    model: env.embedModel(),
    input: texts.map((t) => t.slice(0, 8000)),
  });
  return res.data.map((d) => d.embedding);
}
