import "server-only";
import { z } from "zod";

// Free-tier LLM routing.
//
// Free tiers are rate-limited *per model* (e.g. Groq: ~8k tokens/minute each), so instead of one
// model we keep a pool and rotate: when a model returns 429 we put it on cooldown for the time the
// provider asks and immediately try the next one. Gemini Flash-Lite is the last resort.
//
//   "smart" tier → grading, planning, coaching (needs reasoning)
//   "fast"  tier → short interviewer utterances, hints

export type Tier = "smart" | "fast";

const list = (v: string | undefined, d: string[]) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : d);

const GROQ_SMART = list(process.env.GROQ_MODELS_SMART, ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"]);
const GROQ_FAST = list(process.env.GROQ_MODELS_FAST, ["openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"]);
const GEMINI_MODELS = list(process.env.GEMINI_MODELS, ["gemini-3.5-flash-lite", "gemini-3.6-flash"]);

type Target = { provider: "groq" | "gemini"; model: string };

function targets(tier: Tier): Target[] {
  const out: Target[] = [];
  if (process.env.GROQ_API_KEY) for (const m of tier === "smart" ? GROQ_SMART : GROQ_FAST) out.push({ provider: "groq", model: m });
  if (process.env.GEMINI_API_KEY) for (const m of GEMINI_MODELS) out.push({ provider: "gemini", model: m });
  return out;
}

export const llmEnabled = () => Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);

// Cooldowns survive across requests while the serverless instance is warm.
const cooldown = new Map<string, number>();
const key = (t: Target) => `${t.provider}:${t.model}`;

class RateLimited extends Error {
  constructor(msg: string, public retryMs: number) {
    super(msg);
  }
}

function retryAfterMs(res: Response, body: string) {
  const h = Number(res.headers.get("retry-after"));
  if (h > 0) return h * 1000;
  const m = body.match(/try again in ([\d.]+)(ms|s|m)/i);
  if (m) return Number(m[1]) * (m[2] === "ms" ? 1 : m[2] === "m" ? 60_000 : 1000);
  return 20_000;
}

async function groq(model: string, system: string, user: string, maxTokens: number) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_completion_tokens: maxTokens,
      // gpt-oss models reason before answering; keep it short for latency and token budget.
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const body = await res.text();
  if (res.status === 429) throw new RateLimited(`Groq 429 (${model})`, retryAfterMs(res, body));
  if (!res.ok) throw new Error(`Groq ${res.status} (${model}): ${body.slice(0, 200)}`);
  const text = JSON.parse(body)?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq returned no content (${model})`);
  return text as string;
}

async function gemini(model: string, system: string, user: string, maxTokens: number) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: maxTokens + 2048, thinkingConfig: { thinkingLevel: "low" } },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (res.status === 429 || res.status === 503) throw new RateLimited(`Gemini ${res.status} (${model})`, res.status === 503 ? 30_000 : retryAfterMs(res, body));
  if (!res.ok) throw new Error(`Gemini ${res.status} (${model}): ${body.slice(0, 200)}`);
  const data = JSON.parse(body);
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
  if (!text) throw new Error(`Gemini returned no text (${model}, finishReason=${data?.candidates?.[0]?.finishReason})`);
  return text;
}

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error("Response was not JSON");
  }
}

/** Get a JSON object matching `schema` from the first available free model. */
export async function llmJSON<S extends z.ZodType>(
  system: string,
  user: string,
  schema: S,
  { maxTokens = 1024, tier = "smart" }: { maxTokens?: number; tier?: Tier } = {},
): Promise<{ data: z.infer<S>; model: string }> {
  const prompt = `${user}\n\nRespond with ONLY a valid JSON object (no markdown, no extra text) matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;
  const all = targets(tier);
  const now = Date.now();
  // Skip models on cooldown, but if *everything* is cooling down, try the one that frees up first.
  let order = all.filter((t) => (cooldown.get(key(t)) ?? 0) <= now);
  if (!order.length) order = [...all].sort((a, b) => (cooldown.get(key(a)) ?? 0) - (cooldown.get(key(b)) ?? 0)).slice(0, 1);

  const errors: string[] = [];
  for (const t of order) {
    const t0 = Date.now();
    try {
      const raw = t.provider === "groq" ? await groq(t.model, system, prompt, maxTokens) : await gemini(t.model, system, prompt, maxTokens);
      const parsed = schema.safeParse(extractJson(raw));
      if (parsed.success) {
        console.log(`[llm] ${key(t)} ok in ${Date.now() - t0}ms`);
        return { data: parsed.data, model: key(t) };
      }
      errors.push(`${key(t)}: schema mismatch`);
    } catch (e) {
      if (e instanceof RateLimited) cooldown.set(key(t), Date.now() + Math.min(e.retryMs, 120_000));
      errors.push(`${key(t)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.warn(`[llm] ${errors[errors.length - 1]} (${Date.now() - t0}ms)`);
  }
  throw new Error(`All free models unavailable: ${errors.join(" | ")}`);
}
