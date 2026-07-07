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
  modelHeavy: () => process.env.MB_MODEL_HEAVY || "gpt-4o",
  modelLight: () => process.env.MB_MODEL_LIGHT || "gpt-4o-mini",
  embedModel: () => process.env.MB_EMBED_MODEL || "text-embedding-3-small",
};
