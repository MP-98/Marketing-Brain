import OpenAI from "openai";
import { env } from "./env";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: env.openaiKey() });
  return _client;
}

type JsonSchema = Record<string, unknown>;

export interface LlmJsonOptions {
  system?: string;
  maxTokens?: number;
  /** Ordered list of models to try. First that returns valid JSON wins. */
  models: string[];
  /** JSON Schema the response must conform to (structured outputs, strict mode). */
  schema: JsonSchema;
  /** Schema name (a-zA-Z0-9_-). Defaults to "response". */
  name?: string;
  /** How many attempts per model before falling through to the next. */
  attemptsPerModel?: number;
}

/**
 * Call OpenAI and get back a schema-validated JSON object.
 *
 * Uses Chat Completions `response_format: { type: "json_schema", strict: true }`
 * so the model is constrained to valid JSON matching `schema`. This removes the
 * whole class of prose-parsing bugs. Retries across models with backoff.
 */
export async function llmJson<T = unknown>(
  prompt: string,
  opts: LlmJsonOptions,
): Promise<T> {
  const { system, models, schema } = opts;
  const maxTokens = opts.maxTokens ?? 8000;
  const attemptsPerModel = opts.attemptsPerModel ?? 2;
  const name = opts.name ?? "response";

  let lastErr: unknown = null;

  for (const model of models) {
    for (let attempt = 0; attempt < attemptsPerModel; attempt++) {
      try {
        const res = await client().chat.completions.create({
          model,
          max_completion_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: "system" as const, content: system }] : []),
            { role: "user" as const, content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name, strict: true, schema },
          },
        });

        const choice = res.choices[0]?.message;
        if (choice?.refusal) throw new Error("Model refused the request");
        const text = choice?.content ?? "";
        return JSON.parse(text) as T;
      } catch (err) {
        lastErr = err;
        const delay = 400 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw new Error(
    `llmJson failed across models [${models.join(", ")}]: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

/** Plain markdown/text completion (used by Ask). Single model. */
export async function llmText(
  prompt: string,
  opts: { system?: string; model: string; maxTokens?: number },
): Promise<string> {
  const res = await client().chat.completions.create({
    model: opts.model,
    max_completion_tokens: opts.maxTokens ?? 4000,
    messages: [
      ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
      { role: "user" as const, content: prompt },
    ],
  });

  const choice = res.choices[0]?.message;
  if (choice?.refusal) return "I can't help with that one.";
  return (choice?.content ?? "").trim();
}
