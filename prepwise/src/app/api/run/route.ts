import { NextResponse } from "next/server";
import { rateLimited } from "@/lib/guard";
import { isLang, MAX_CODE } from "@/lib/code";
import type { CodeLang, RunResult } from "@/lib/types";

// Code is compiled and run in Wandbox's public sandbox (https://wandbox.org) — free, no API key.
// Nothing runs on our own server.
export const maxDuration = 60;

const WANDBOX = process.env.WANDBOX_URL || "https://wandbox.org/api/compile.json";
const COMPILERS: Record<CodeLang, { compiler: string; options?: string }> = {
  cpp: { compiler: "gcc-13.2.0", options: "-std=gnu++17" },
  java: { compiler: "openjdk-jdk-21+35" },
  python: { compiler: "cpython-3.12.16" },
  javascript: { compiler: "nodejs-20.17.0" },
};

// Wandbox saves Java as prog.java, so a top-level `public class Main` would not compile.
const fixJava = (src: string) => src.replace(/^public\s+((?:final\s+|abstract\s+)*class\s)/gm, "$1");

const clip = (s: string, n = 8000) => (s.length > n ? s.slice(0, n) + "\n… (output truncated)" : s);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(`run:${ip}`, 15)) return NextResponse.json({ error: "Too many runs — wait a few seconds." }, { status: 429 });

  let body: { lang?: unknown; source?: unknown; stdin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!isLang(body.lang) || typeof body.source !== "string" || !body.source.trim()) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const lang = body.lang;
  const source = body.source.slice(0, MAX_CODE);
  const stdin = typeof body.stdin === "string" ? body.stdin.slice(0, 10000) : "";
  const { compiler, options } = COMPILERS[lang];

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(WANDBOX, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "PrepWise/1.0" },
      body: JSON.stringify({ compiler, code: lang === "java" ? fixJava(source) : source, stdin, ...(options ? { "compiler-option-raw": options } : {}) }),
      signal: AbortSignal.timeout(50_000),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return NextResponse.json<RunResult>({ status: timedOut ? "timeout" : "unavailable", output: timedOut ? "The run took too long and was stopped." : "The code runner is unreachable right now. Try again in a moment.", stdin });
  }
  const ms = Date.now() - t0;
  if (!res.ok) return NextResponse.json<RunResult>({ status: "unavailable", output: `The code runner is busy (HTTP ${res.status}). Try again in a moment.`, stdin });

  const w = (await res.json()) as Record<string, string>;
  const code = Number(w.status);
  let out: RunResult;
  if (w.compiler_error && code !== 0 && !w.program_output && !w.program_error) out = { status: "compile_error", output: clip(w.compiler_error) };
  else if (code === 137 || w.signal === "Killed") out = { status: "timeout", output: clip((w.program_output || "") + "\nTime limit exceeded — the program was stopped. Check for infinite loops or slow algorithms.") };
  else if (code !== 0 || w.signal) out = { status: "runtime_error", output: clip([w.program_output, w.program_error, w.signal && `Signal: ${w.signal}`, `Exit code ${w.status}`].filter(Boolean).join("\n")) };
  else out = { status: "ok", output: clip((w.program_output || "") + (w.program_error ? `\n[stderr]\n${w.program_error}` : "")) };
  return NextResponse.json<RunResult>({ ...out, stdin, ms });
}
