import "server-only";
import type { AgentState } from "./types";
import { isLang, MAX_CODE } from "./code";

// Basic abuse limits so a public deployment can't be used to burn the free API quota.
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;

export function rateLimited(key: string, max = MAX_PER_WINDOW) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.n > max;
}

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

export function sanitizeState(s: AgentState): AgentState {
  const c = s.config;
  return {
    config: {
      ...c,
      role: str(c.role, 120),
      company: str(c.company, 120),
      resume: str(c.resume, 6000),
      jobDescription: str(c.jobDescription, 4000),
      focus: (c.focus ?? []).slice(0, 8).map((f) => str(f, 100)),
      numQuestions: Math.max(2, Math.min(8, Number(c.numQuestions) || 4)),
      seed: Number(c.seed) || 0,
      interviewType: c.interviewType ?? "auto",
    },
    plan: s.plan
      ? {
          summary: str(s.plan.summary, 400),
          items: (s.plan.items ?? []).slice(0, 8).map((i) => ({
            competency: str(i.competency, 120),
            type: i.type,
            seedQuestion: str(i.seedQuestion, 600),
            expectedPoints: (i.expectedPoints ?? []).slice(0, 6).map((p) => str(p, 160)),
            hint: str(i.hint, 400),
            coding: Boolean(i.coding),
          })),
        }
      : undefined,
    turns: (s.turns ?? []).slice(-60).map((t) => ({
      ...t,
      text: str(t.text, 4000),
      code:
        t.code && isLang(t.code.lang)
          ? {
              lang: t.code.lang,
              source: str(t.code.source, MAX_CODE),
              run: t.code.run ? { status: t.code.run.status, output: str(t.code.run.output, 600), stdin: str(t.code.run.stdin, 300) } : undefined,
            }
          : undefined,
    })),
    assessments: (s.assessments ?? []).slice(-40),
    currentQ: Math.max(0, Number(s.currentQ) || 0),
    difficulty: Math.max(1, Math.min(3, Number(s.difficulty) || 2)),
  };
}
