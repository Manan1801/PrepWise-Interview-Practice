import "server-only";
// PrepWise interviewer agent.
//
//   start  ─► PLAN (build interview plan from role/JD/resume) ─► ACT (opener + Q1)
//   answer ─► ASSESS (grade vs rubric) ─► DECIDE (policy) ─► ACT (probe / redirect / deepen / next / close)
//   hint / clarify ─► ACT (help on current question)
//   skip   ─► DECIDE ─► ACT
//
// Memory (plan, transcript, assessments, difficulty) lives in AgentState, which the client stores
// and sends back each turn, so the server stays stateless. Every LLM step has an offline fallback.
import { llmEnabled } from "../llm";
import * as llm from "./brain-llm";
import * as off from "./brain-offline";
import { decide } from "./policy";
import type { AgentRequest, AgentResponse, AgentState, Assessment, InterviewSession, SessionReport, TraceStep } from "../types";

async function step<T>(trace: TraceStep[], name: string, ai: () => Promise<T>, fallback: () => T, usedAI: { v: boolean }): Promise<T> {
  if (llmEnabled()) {
    try {
      const r = await ai();
      usedAI.v = true;
      return r;
    } catch (e) {
      console.warn(`[agent] ${name} failed, using offline fallback:`, e instanceof Error ? e.message.slice(0, 300) : e);
      trace.push({ at: Date.now(), step: "fallback", text: `${name}: AI unavailable, used built-in logic.` });
    }
  }
  return fallback();
}

export async function runAgent({ input, state }: AgentRequest): Promise<AgentResponse> {
  const trace: TraceStep[] = [];
  const usedAI = { v: false };
  const now = () => Date.now();
  const mode = () => (usedAI.v ? "ai" : "offline") as AgentResponse["mode"];

  // ---- start: plan the interview ----
  if (input === "start") {
    const { plan, opener } = await step(
      trace,
      "plan",
      () => llm.planLLM(state.config),
      () => {
        const plan = off.planOffline(state.config);
        return { plan, opener: off.openerOffline(state, plan) };
      },
      usedAI,
    );
    trace.push({ at: now(), step: "plan", text: `${plan.summary} — competencies: ${plan.items.map((i) => i.competency).join(" → ")}.` });
    return { mode: mode(), plan, message: opener, kind: "question", qIndex: 0, difficulty: 2, ended: false, trace };
  }

  const s: AgentState = { ...state, plan: state.plan ?? off.planOffline(state.config), difficulty: state.difficulty || 2 };

  // ---- help actions ----
  if (input === "hint" || input === "clarify") {
    const msg = await step(
      trace,
      input,
      () => llm.helpLLM(s, input),
      () => (input === "hint" ? `Hint: ${s.plan!.items[s.currentQ].hint}` : `Sure — in other words: ${s.plan!.items[s.currentQ].seedQuestion} Focus on how you'd think it through.`),
      usedAI,
    );
    trace.push({ at: now(), step: "act", text: `Candidate asked to ${input}; responded without giving the answer away.` });
    return { mode: mode(), message: msg, kind: input === "hint" ? "hint" : "clarification", qIndex: s.currentQ, difficulty: s.difficulty, ended: false, trace };
  }

  // ---- answer / skip: assess → decide → act ----
  let assessment: Assessment | undefined;
  let tip: string | undefined;
  if (input === "answer") {
    const last = [...s.turns].reverse().find((t) => t.role === "candidate" && t.kind === "answer");
    const answer = last?.text ?? "";
    const r = await step(
      trace,
      "assess",
      () => llm.assessLLM(s, answer, last?.id ?? ""),
      () => {
        const a = off.assessOffline(s, answer, last?.id ?? "");
        return { a, tip: off.quickTipOffline(a) };
      },
      usedAI,
    );
    assessment = r.a;
    tip = r.tip;
    trace.push({
      at: now(),
      step: "assess",
      text: `Q${s.currentQ + 1} answer: ${assessment.signal} (${assessment.score}/5). Covered: ${assessment.covered.join(", ") || "—"}. Missing: ${assessment.missing.join(", ") || "—"}.`,
    });
  }

  const decision = decide(s, assessment ?? null, input === "skip");
  trace.push({ at: now(), step: "decide", text: `${decision.action.toUpperCase()}${decision.target ? ` → "${decision.target}"` : ""}: ${decision.reason} Difficulty ${decision.difficulty}/3.` });

  const message = await step(trace, "act", () => llm.speakLLM(s, decision), () => off.speakOffline(s, decision), usedAI);

  const kind = decision.action === "next" ? "question" : decision.action === "close" ? "closing" : "followup";
  return {
    mode: mode(),
    assessment,
    decision,
    message,
    kind,
    qIndex: decision.action === "next" ? s.currentQ + 1 : s.currentQ,
    difficulty: decision.difficulty,
    quickFeedback: assessment && s.config.feedbackTiming === "after-each" ? { score: assessment.score, tip: tip ?? "" } : undefined,
    ended: decision.action === "close",
    trace,
  };
}

export async function runCoach(session: InterviewSession): Promise<SessionReport> {
  const s = { ...session, plan: session.plan ?? off.planOffline(session.config) };
  if (llmEnabled() && s.turns.some((t) => t.role === "candidate" && t.kind === "answer")) {
    try {
      return await llm.coachLLM(s);
    } catch (e) {
      console.warn("[agent] coach failed, using offline report:", e instanceof Error ? e.message.slice(0, 300) : e);
    }
  }
  return off.coachOffline(s);
}
