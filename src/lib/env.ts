// Central env access. Fail loud on the server if a required key is missing.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  openaiKey: () => required("OPENAI_API_KEY"),
  // HEAVY runs every content-bearing section (concept, trending, authorities,
  // resources, angles, intro/takeaway). UTILITY runs only the topic seed, web
  // search, and embeddings — never content (briefing-quality-spec §6.1).
  modelHeavy: () => process.env.MB_MODEL_HEAVY || "gpt-5",
  modelUtility: () => process.env.MB_MODEL_UTILITY || "gpt-4o-mini",
  embedModel: () => process.env.MB_EMBED_MODEL || "text-embedding-3-small",
};
