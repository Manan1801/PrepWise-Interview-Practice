import { NextResponse } from "next/server";
import { runCoach } from "@/lib/agent/agent";
import { rateLimited, sanitizeState } from "@/lib/guard";
import type { InterviewSession } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const session = (await req.json()) as InterviewSession;
  if (!session?.config) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(await runCoach({ ...session, ...sanitizeState(session) }));
}
