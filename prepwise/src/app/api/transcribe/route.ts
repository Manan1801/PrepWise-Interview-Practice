import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/guard";

// Speech-to-text with Whisper on Groq (free tier, same GROQ_API_KEY as the interviewer).
// The browser records the answer, posts the audio here, and gets back the transcript.
export const maxDuration = 60;

const MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";
const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is ~4.5 MB (~15 min of compressed speech)

// Whisper drops "um/uh" unless the prompt contains them; keeping them lets us count filler words.
const STYLE = "Umm, so, let me think… like, I would, uh, start with the basic idea. Hmm, okay.";

export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "Whisper is not configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(`stt:${ip}`, 20)) return NextResponse.json({ error: "Too many requests — wait a few seconds." }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000) return NextResponse.json({ text: "" });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "Recording too long" }, { status: 413 });
  const context = String(form.get("context") ?? "").slice(0, 300);

  const type = audio.type || "audio/webm";
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const out = new FormData();
  out.append("file", audio, `answer.${ext}`);
  out.append("model", MODEL);
  out.append("language", "en");
  out.append("temperature", "0");
  out.append("response_format", "json");
  // Context (the interview question) helps Whisper spell technical words correctly.
  out.append("prompt", `${context ? `Interview question: ${context}\n` : ""}${STYLE}`);

  const t0 = Date.now();
  try {
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: out,
      signal: AbortSignal.timeout(40_000),
    });
    if (!r.ok) {
      console.warn(`[stt] groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }
    const j = (await r.json()) as { text?: string };
    console.log(`[stt] ok in ${Date.now() - t0}ms (${Math.round(audio.size / 1024)} KB)`);
    let text = (j.text ?? "").trim();
    // On near-silent audio Whisper can echo its prompt back — never return that as the answer.
    if (text && (STYLE.includes(text) || text.includes("let me think… like, I would"))) text = "";
    return NextResponse.json({ text });
  } catch (e) {
    console.warn(`[stt] error: ${e instanceof Error ? e.message : e}`);
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
