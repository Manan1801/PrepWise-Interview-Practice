// The agent's decision policy. Deterministic on purpose: the LLM perceives (assesses answers) and
// speaks, but *what to do next* follows explicit, explainable rules so the interview stays
// structured, bounded in length, and predictable for the student.
import type { AgentState, Assessment, Decision } from "../types";

export const MAX_FOLLOWUPS = 2;

export const followupsUsed = (s: AgentState, q: number) =>
  s.turns.filter((t) => t.qIndex === q && t.kind === "followup").length;

export function decide(state: AgentState, a: Assessment | null, skipped: boolean): Decision {
  const q = state.currentQ;
  const total = state.plan?.items.length ?? state.config.numQuestions;
  const isLast = q >= total - 1;
  const used = followupsUsed(state, q);
  const canFollow = !skipped && used < MAX_FOLLOWUPS;
  const tough = state.config.persona === "tough";

  // Adapt difficulty from the running average of assessments (including this one).
  const scores = [...state.assessments, ...(a ? [a] : [])].map((x) => x.score);
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 3;
  let difficulty = state.difficulty || 2;
  if (scores.length >= 2 && avg >= 4.2) difficulty = Math.min(3, difficulty + 1);
  else if (scores.length >= 2 && avg <= 2.2) difficulty = Math.max(1, difficulty - 1);

  const moveOn = (reason: string): Decision =>
    isLast ? { action: "close", reason: `${reason} That was the last planned question.`, difficulty } : { action: "next", reason, difficulty };

  if (skipped) return moveOn("Candidate chose to skip.");
  if (!a) return moveOn("No assessment available.");

  if (canFollow && (a.signal === "off_topic" || a.signal === "no_answer"))
    return { action: "redirect", reason: "Answer did not address the question — refocus the candidate.", difficulty };

  if (canFollow && (a.signal === "weak" || a.signal === "partial") && a.missing.length) {
    const target = a.missing[Math.min(used, a.missing.length - 1)];
    return { action: "probe", reason: `Answer was ${a.signal}; probing a gap.`, target, difficulty };
  }

  if (a.signal === "strong" && used === 0 && (tough || difficulty >= 2))
    return { action: "deepen", reason: "Strong answer — push one level deeper to test real depth.", difficulty };

  return moveOn(a.signal === "strong" ? "Question covered well." : "Follow-ups used up; moving on to keep the interview on time.");
}
