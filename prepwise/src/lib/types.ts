export type TrackId = "general" | "swe" | "ml" | "core" | "product" | "consulting" | "hr";

export type Level = "student" | "fresher" | "experienced" | "career-switch";
export type Persona = "friendly" | "neutral" | "tough";
export type FeedbackTiming = "after-each" | "end-only";
export type InterviewType = "auto" | "technical" | "behavioral" | "mixed" | "case";

export interface SessionConfig {
  track: TrackId; // preset used for offline question bank + hints
  role: string; // any role, free text — e.g. "Data Analyst", "School teacher", "SDE Intern"
  company: string;
  level: Level;
  interviewType: InterviewType;
  numQuestions: number; // planned main questions
  persona: Persona;
  focus: string[];
  resume: string;
  jobDescription: string;
  feedbackTiming: FeedbackTiming;
  voiceOut: boolean;
  seed: number;
}

// ---------- Agent memory ----------

export type QuestionType = "technical" | "behavioral" | "case" | "situational" | "motivation";

export interface PlanItem {
  competency: string; // what this question is meant to reveal, e.g. "Concurrency fundamentals"
  type: QuestionType;
  seedQuestion: string; // the planned question (the interviewer may adapt wording)
  expectedPoints: string[]; // what a strong answer should cover — the assessment rubric
  hint: string;
  coding?: boolean; // the candidate is expected to write code — the editor opens automatically
}

export interface InterviewPlan {
  summary: string; // one-line description of the interview the agent planned
  items: PlanItem[];
}

export type Signal = "strong" | "partial" | "weak" | "off_topic" | "no_answer";

export interface Assessment {
  qIndex: number;
  turnId: string;
  score: number; // 1-5
  signal: Signal;
  covered: string[];
  missing: string[];
  note: string; // short private interviewer note
}

export type AgentAction = "probe" | "redirect" | "deepen" | "next" | "close";

export interface Decision {
  action: AgentAction;
  reason: string;
  target?: string; // the specific gap to probe
  difficulty: number; // 1 easy … 3 hard, adapted over the interview
}

export interface TraceStep {
  at: number;
  step: "plan" | "assess" | "decide" | "act" | "fallback";
  text: string;
}

// ---------- Conversation ----------

export type TurnKind = "question" | "followup" | "hint" | "clarification" | "closing" | "answer" | "skip" | "request";

export interface DeliveryMetrics {
  words: number;
  seconds: number;
  wpm: number;
  fillers: number;
  fillerList: Record<string, number>;
  hedges: number;
  usedVoice: boolean;
}

export interface QuickFeedback {
  score: number; // 1-5
  tip: string;
}

export type CodeLang = "cpp" | "java" | "python" | "javascript";

export interface RunResult {
  status: "ok" | "compile_error" | "runtime_error" | "timeout" | "unavailable";
  output: string; // stdout, or the compiler/runtime error text
  stdin?: string;
  ms?: number;
}

export interface CodeAttachment {
  lang: CodeLang;
  source: string;
  run?: RunResult; // the last run before submitting, if any
}

export interface Turn {
  id: string;
  role: "interviewer" | "candidate";
  kind: TurnKind;
  text: string;
  code?: CodeAttachment; // code written in the built-in editor, sent with the answer
  qIndex: number;
  metrics?: DeliveryMetrics;
  quickFeedback?: QuickFeedback;
  at: number;
}

// ---------- Report ----------

export type DimensionKey = "structure" | "depth" | "specificity" | "communication" | "delivery";

export interface DimensionScore {
  key: DimensionKey;
  score: number; // 1-10
  note: string;
}

export interface QuestionReport {
  qIndex: number;
  question: string;
  competency?: string;
  score: number; // 1-10
  strengths: string[];
  improvements: string[];
  betterAnswerOutline: string[];
}

export interface SessionReport {
  overall: number;
  summary: string;
  dimensions: DimensionScore[];
  questions: QuestionReport[];
  nextSteps: string[];
  generatedBy: "ai" | "offline";
}

// ---------- Session (stored client-side; the server is stateless) ----------

export interface AgentState {
  config: SessionConfig;
  plan?: InterviewPlan;
  turns: Turn[];
  assessments: Assessment[];
  currentQ: number;
  difficulty: number;
}

export interface InterviewSession extends AgentState {
  id: string;
  createdAt: number;
  endedAt?: number;
  status: "active" | "ended";
  mode: "ai" | "offline";
  trace: TraceStep[];
  report?: SessionReport;
}

export type AgentInput = "start" | "answer" | "hint" | "clarify" | "skip";

export interface AgentRequest {
  input: AgentInput;
  state: AgentState;
}

export interface AgentResponse {
  mode: "ai" | "offline";
  plan?: InterviewPlan; // only on start
  assessment?: Assessment;
  decision?: Decision;
  message: string;
  kind: TurnKind;
  qIndex: number;
  difficulty: number;
  quickFeedback?: QuickFeedback;
  ended: boolean;
  trace: TraceStep[];
}
