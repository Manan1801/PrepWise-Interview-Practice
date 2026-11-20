// Rule-based "brain": same interface as the LLM brain. Used when no free API key is configured,
// or per-step whenever an LLM call fails, so the interview never gets stuck.
import { getTrack } from "../tracks";
import type {
  AgentState,
  Assessment,
  Decision,
  DimensionKey,
  DimensionScore,
  InterviewPlan,
  InterviewSession,
  QuestionReport,
  SessionConfig,
  SessionReport,
  Signal,
} from "../types";

const bankFor = (c: SessionConfig) => getTrack(c.track).bank;

export function planOffline(c: SessionConfig): InterviewPlan {
  const bank = bankFor(c);
  const n = Math.min(c.numQuestions, bank.length);
  const items = Array.from({ length: n }, (_, i) => {
    const b = bank[(c.seed + i) % bank.length];
    return {
      competency: b.c,
      type: c.track === "hr" || c.track === "general" ? ("behavioral" as const) : ("technical" as const),
      seedQuestion: b.q,
      expectedPoints: b.keywords,
      hint: b.hint,
    };
  });
  return { summary: `${n}-question ${getTrack(c.track).name} interview for ${c.role || "the role"}`, items };
}

const OPENERS = {
  friendly: "Hi! Thanks for joining — take your time, there's no rush.",
  neutral: "Hello, let's get started.",
  tough: "Let's begin. I'll push on details, so be precise.",
};

export function openerOffline(s: AgentState, plan: InterviewPlan) {
  return `${OPENERS[s.config.persona]} We'll go through ${plan.items.length} questions${s.config.role ? ` for ${s.config.role}` : ""}${
    s.config.company ? ` at ${s.config.company}` : ""
  }. First: ${plan.items[0].seedQuestion}`;
}

const NUM = /\d/;
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

export function assessOffline(s: AgentState, answer: string, turnId: string): Assessment {
  const item = s.plan!.items[s.currentQ];
  const low = answer.toLowerCase();
  const covered = item.expectedPoints.filter((k) => low.includes(k.toLowerCase()));
  const missing = item.expectedPoints.filter((k) => !low.includes(k.toLowerCase()));
  const w = words(answer);
  let score = 1 + Math.min(2, w / 50) + Math.min(2, covered.length * 0.7) + (NUM.test(answer) ? 0.5 : 0);
  score = Math.max(1, Math.min(5, Math.round(score)));
  const signal: Signal = w < 8 ? "no_answer" : score >= 4 ? "strong" : score >= 3 ? "partial" : "weak";
  return {
    qIndex: s.currentQ,
    turnId,
    score,
    signal,
    covered,
    missing: missing.slice(0, 3),
    note: `${w} words; covered ${covered.length}/${item.expectedPoints.length} expected points.`,
  };
}

export function speakOffline(s: AgentState, d: Decision): string {
  const plan = s.plan!;
  const item = plan.items[s.currentQ];
  const bankItem = bankFor(s.config).find((b) => b.q === item.seedQuestion);
  const used = s.turns.filter((t) => t.qIndex === s.currentQ && t.kind === "followup").length;
  switch (d.action) {
    case "redirect":
      return `Let me bring us back to the question: ${item.seedQuestion}`;
    case "probe":
    case "deepen":
      return bankItem?.followups[used] ?? `Can you go deeper on ${d.target ?? "that"} — be specific, with an example?`;
    case "next": {
      const n = plan.items[s.currentQ + 1];
      const ack = s.config.persona === "friendly" ? "Thanks, that's helpful." : s.config.persona === "tough" ? "Okay." : "Thank you.";
      return `${ack} Question ${s.currentQ + 2}: ${n.seedQuestion}`;
    }
    case "close":
      return "That's the end of the interview — well done for completing it. Your detailed feedback report is ready.";
  }
}

export function quickTipOffline(a: Assessment) {
  if (a.signal === "no_answer") return "Try to give at least a structured partial answer — interviewers reward visible reasoning.";
  if (a.missing.length) return `Strengthen it by addressing: ${a.missing.slice(0, 2).join(", ")}.`;
  return "Solid. Close with a one-line summary and a concrete result.";
}

// ---------- Coach (report) ----------

const clamp = (n: number, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

export function coachOffline(session: InterviewSession): SessionReport {
  const { turns, assessments } = session;
  const plan = session.plan ?? planOffline(session.config);
  const asked = Math.max(0, ...turns.map((t) => t.qIndex)) + 1;
  const questions: QuestionReport[] = [];
  let totWords = 0, totFill = 0, totHedge = 0, vSecs = 0, vWords = 0, nums = 0, star = 0;
  const STAR = ["situation", "so i", "i decided", "as a result", "result", "outcome", "learned", "because", "first", "then"];

  for (let q = 0; q < Math.min(asked, plan.items.length); q++) {
    const item = plan.items[q];
    const ans = turns.filter((t) => t.qIndex === q && t.role === "candidate" && t.kind === "answer");
    const text = ans.map((a) => a.text).join(" ");
    const as = assessments.filter((a) => a.qIndex === q);
    const best = as.length ? Math.max(...as.map((a) => a.score)) : 1;
    const covered = [...new Set(as.flatMap((a) => a.covered))];
    const missing = item.expectedPoints.filter((p) => !covered.includes(p));
    totWords += words(text);
    if (NUM.test(text)) nums++;
    star += Math.min(3, STAR.filter((m) => text.toLowerCase().includes(m)).length);
    for (const a of ans) {
      totFill += a.metrics?.fillers ?? 0;
      totHedge += a.metrics?.hedges ?? 0;
      if (a.metrics?.usedVoice) { vSecs += a.metrics.seconds; vWords += a.metrics.words; }
    }
    questions.push({
      qIndex: q,
      question: item.seedQuestion,
      competency: item.competency,
      score: ans.length ? clamp(best * 2) : 1,
      strengths: ans.length ? (covered.length ? [`Covered: ${covered.join(", ")}.`] : ["You attempted the question and kept going."]) : [],
      improvements: ans.length
        ? [...(missing.length ? [`Also address: ${missing.slice(0, 3).join(", ")}.`] : []), ...(NUM.test(text) ? [] : ["Add a concrete number or outcome."])]
        : ["Skipped — retry it using the hint; partial answers still earn credit."],
      betterAnswerOutline: [item.hint, "Close with a one-line summary and a trade-off or lesson."],
    });
  }

  const n = Math.max(1, questions.length);
  const avgA = assessments.length ? assessments.reduce((s, a) => s + a.score, 0) / assessments.length : 1;
  const per100 = totWords ? (totFill / totWords) * 100 : 0;
  const wpm = vSecs ? (vWords / vSecs) * 60 : 0;
  const dims: DimensionScore[] = [
    { key: "structure", score: clamp(2 + (star / n) * 1.8), note: star / n >= 2 ? "Answers had a recognisable flow." : "Signpost answers more clearly (first…, then…, the result was…)." },
    { key: "depth", score: clamp(avgA * 2), note: avgA >= 3.5 ? "Covered most expected points." : "Several expected points were missing." },
    { key: "specificity", score: clamp(3 + (nums / n) * 6), note: nums ? "Some concrete details." : "Very few concrete numbers or examples." },
    { key: "communication", score: clamp(2 + Math.min(6, totWords / n / 20)), note: totWords / n < 50 ? "Answers were short — think aloud more." : "Answers were reasonably complete." },
    {
      key: "delivery" as DimensionKey,
      score: clamp(9 - per100 * 0.6 - totHedge * 0.4 - (wpm && (wpm < 100 || wpm > 175) ? 1.5 : 0)),
      note: `${totFill} filler words, ${totHedge} hedging phrases${wpm ? `, ~${Math.round(wpm)} wpm (comfortable is 110–160)` : ""}.`,
    },
  ];
  const overall = clamp(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  const weakest = [...dims].sort((a, b) => a.score - b.score)[0];
  return {
    overall,
    summary: `You completed ${questions.length} question(s). Biggest opportunity: ${weakest.key}. (Rule-based feedback — the AI coach was unavailable.)`,
    dimensions: dims,
    questions,
    nextSteps: [`Focus: ${weakest.note}`, "Retry your lowest-scoring question using the outline.", "Do another session in 2–3 days and compare on the Progress page."],
    generatedBy: "offline",
  };
}
