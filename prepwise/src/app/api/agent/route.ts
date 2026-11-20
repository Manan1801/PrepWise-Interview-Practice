import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/agent";
import { llmEnabled } from "@/lib/llm";
import { rateLimited, sanitizeState } from "@/lib/guard";
import type { AgentRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests — please wait a few seconds." }, { status: 429 });
  let body: AgentRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const inputs = ["start", "answer", "hint", "clarify", "skip"];
  if (!inputs.includes(body.input) || !body.state?.config) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(await runAgent({ input: body.input, state: sanitizeState(body.state) }));
}

export async function GET() {
  return NextResponse.json({ ai: llmEnabled() });
}
