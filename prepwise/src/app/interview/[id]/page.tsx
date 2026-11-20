"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentCall, reportCall } from "@/lib/api";
import { getSession, saveSession, uid } from "@/lib/storage";
import { computeMetrics, paceLabel } from "@/lib/metrics";
import { speak, stopSpeaking, useSpeechInput } from "@/lib/useSpeech";
import type { AgentInput, InterviewSession, SessionReport, Turn } from "@/lib/types";

// If the last thing in the transcript is from the candidate, the interviewer still owes a reply
// (e.g. the request was lost). Work out which agent input to (re)send.
function pendingInput(s: InterviewSession): AgentInput | null {
  if (s.status === "ended") return null;
  if (s.turns.length === 0) return "start";
  const last = s.turns[s.turns.length - 1];
  if (last.role !== "candidate") return null;
  if (last.kind === "answer") return "answer";
  if (last.kind === "skip") return "skip";
  return last.text.toLowerCase().includes("hint") ? "hint" : "clarify";
}

export default function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<false | "thinking" | "report">(false);
  const [retrying, setRetrying] = useState(0);
  const [error, setError] = useState("");
  const [showStats, setShowStats] = useState(true);
  const [showAgent, setShowAgent] = useState(false);
  const [answerStart, setAnswerStart] = useState<number | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const [now, setNow] = useState(Date.now());
  const sessionRef = useRef<InterviewSession | null>(null);
  const inflight = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const speech = useSpeechInput((txt) => setDraft((d) => (d ? d + " " : "") + txt));

  const persist = (s: InterviewSession) => {
    sessionRef.current = s;
    setSession(s);
    saveSession(s);
  };

  useEffect(() => {
    const s = getSession(id);
    if (!s) setMissing(true);
    else if (s.status === "ended") router.replace(`/report/${id}`);
    else {
      sessionRef.current = s;
      setSession(s);
      try {
        setShowAgent(localStorage.getItem("prepwise.showAgent") === "1");
      } catch {}
    }
  }, [id, router]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.turns.length, busy]);

  const finish = useCallback(
    async (s: InterviewSession) => {
      stopSpeaking();
      speech.stop();
      setBusy("report");
      let report: SessionReport | undefined;
      try {
        report = await reportCall(s);
      } catch {
        /* the report page offers a "Generate report" retry */
      }
      saveSession({ ...s, status: "ended", endedAt: Date.now(), report });
      router.push(`/report/${s.id}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  /** Send one agent step. The candidate's turn (if any) is already in the transcript. */
  const run = useCallback(
    async (input: AgentInput) => {
      const s = sessionRef.current;
      if (!s || inflight.current) return;
      inflight.current = true;
      setBusy("thinking");
      setError("");
      setRetrying(0);
      try {
        const r = await agentCall(input, s, (n) => setRetrying(n));
        const cur = sessionRef.current!;
        const turns = [...cur.turns];
        if (r.quickFeedback) {
          for (let i = turns.length - 1; i >= 0; i--)
            if (turns[i].role === "candidate") {
              turns[i] = { ...turns[i], quickFeedback: r.quickFeedback };
              break;
            }
        }
        turns.push({ id: uid(), role: "interviewer", kind: r.kind, text: r.message, qIndex: r.qIndex, at: Date.now() });
        const next: InterviewSession = {
          ...cur,
          plan: r.plan ?? cur.plan,
          turns,
          assessments: r.assessment ? [...cur.assessments, r.assessment] : cur.assessments,
          trace: [...cur.trace, ...r.trace],
          currentQ: r.qIndex,
          difficulty: r.difficulty,
          mode: r.mode,
        };
        persist(next);
        if (next.config.voiceOut) speak(r.message);
        setAnswerStart(null);
        setUsedVoice(false);
        if (r.ended) await finish(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        inflight.current = false;
        setRetrying(0);
        setBusy((b) => (b === "thinking" ? false : b));
      }
    },
    [finish],
  );

  // On load: start the interview, or recover a reply that was lost (e.g. page reloaded mid-request).
  const recovered = useRef(false);
  useEffect(() => {
    if (!session || recovered.current) return;
    recovered.current = true;
    const p = pendingInput(session);
    if (p) run(p);
  }, [session, run]);

  function submit() {
    const s = sessionRef.current;
    if (!s || !draft.trim() || busy) return;
    speech.stop();
    const secs = answerStart ? (Date.now() - answerStart) / 1000 : 30;
    const turn: Turn = { id: uid(), role: "candidate", kind: "answer", text: draft.trim(), qIndex: s.currentQ, metrics: computeMetrics(draft, secs, usedVoice), at: Date.now() };
    persist({ ...s, turns: [...s.turns, turn] });
    setDraft("");
    run("answer");
  }

  function request(input: "hint" | "clarify" | "skip") {
    const s = sessionRef.current;
    if (!s || busy) return;
    stopSpeaking();
    const text = input === "hint" ? "Could I get a hint?" : input === "clarify" ? "Could you clarify the question?" : "I'd like to skip this question.";
    persist({ ...s, turns: [...s.turns, { id: uid(), role: "candidate", kind: input === "skip" ? "skip" : "request", text, qIndex: s.currentQ, at: Date.now() }] });
    run(input);
  }

  function toggleMic() {
    if (speech.listening) speech.stop();
    else {
      speech.start();
      setUsedVoice(true);
      if (!answerStart) setAnswerStart(Date.now());
    }
  }

  function toggleAgent() {
    setShowAgent((v) => {
      try {
        localStorage.setItem("prepwise.showAgent", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  if (missing)
    return (
      <div className="card mx-auto max-w-md p-6 text-center">
        <p>This session was not found in this browser.</p>
        <Link href="/setup" className="btn-primary mt-4">Start a new one</Link>
      </div>
    );
  if (!session) return <p className="text-muted">Loading…</p>;

  if (busy === "report")
    return (
      <div className="card mx-auto max-w-md p-8 text-center" role="status">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        <p className="font-medium">The coach is writing your feedback…</p>
        <p className="mt-1 text-sm text-muted">Reviewing each answer against the interview plan. This usually takes a few seconds.</p>
      </div>
    );

  const { config, plan } = session;
  const total = plan?.items.length ?? config.numQuestions;
  const item = plan?.items[session.currentQ];
  const lastInterviewer = [...session.turns].reverse().find((t) => t.role === "interviewer");
  const stuck = !busy && pendingInput(session) !== null;
  const live = computeMetrics(draft + " " + speech.interim, answerStart ? (now - answerStart) / 1000 : 0, usedVoice);
  const elapsed = answerStart ? Math.floor((now - answerStart) / 1000) : 0;
  const canAct = !busy && !stuck && !!lastInterviewer;

  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        {/* Header / plan progress */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm text-muted">{config.role}{config.company && ` · ${config.company}`}</div>
            <div className="mt-2 flex items-center gap-1.5" aria-label={`Question ${session.currentQ + 1} of ${total}`}>
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} title={plan?.items[i]?.competency} className={`h-2 w-8 rounded-full ${i < session.currentQ ? "bg-brand" : i === session.currentQ ? "bg-brand/60" : "bg-line"}`} />
              ))}
              <span className="ml-2 text-sm font-medium">Q{Math.min(session.currentQ + 1, total)}/{total}</span>
            </div>
            {item && <div className="mt-1 text-xs text-muted">Now testing: <span className="text-ink">{item.competency}</span></div>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs ${session.mode === "ai" ? "bg-brand-soft" : "bg-warn-soft"}`}>{session.mode === "ai" ? "AI interviewer" : "Offline mode"}</span>
            <button className="btn-ghost py-2" onClick={toggleAgent} aria-pressed={showAgent}>{showAgent ? "Hide" : "Show"} reasoning</button>
            <button className="btn-ghost py-2" onClick={() => finish(session)} disabled={!!busy || !session.turns.some((t) => t.role === "candidate" && t.kind === "answer")}>
              End & get feedback
            </button>
          </div>
        </div>

        {/* Transcript */}
        <div className="card max-h-[52vh] space-y-4 overflow-y-auto p-4" aria-live="polite">
          {session.turns.length === 0 && busy && <div className="text-sm text-muted">The interviewer is planning your interview…</div>}
          {session.turns.map((t) => (
            <TurnView key={t.id} t={t} onReplay={() => speak(t.text)} />
          ))}
          {busy === "thinking" && session.turns.length > 0 && (
            <div className="text-sm text-muted">{retrying ? `Connection hiccup — retrying (${retrying}/2)…` : "Interviewer is thinking…"}</div>
          )}
          <div ref={endRef} />
        </div>

        {(error || stuck) && !busy && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-warn-soft p-3 text-sm" role="alert">
            <span className="flex-1">{error || "The interviewer hasn't replied yet."} Your answer is saved.</span>
            <button className="btn-primary py-2" onClick={() => { const p = pendingInput(session); if (p) run(p); }}>Retry</button>
          </div>
        )}

        {/* Composer */}
        <div className="card mt-4 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>Your answer {speech.supported ? "— speak or type (you can edit the transcript before submitting)" : "— type (voice needs Chrome/Edge)"}</span>
            <button className="underline" onClick={() => setShowStats((v) => !v)}>{showStats ? "Hide" : "Show"} live stats</button>
          </div>
          <textarea
            className="input min-h-32 text-base"
            placeholder={speech.listening ? "Listening… speak naturally" : "Think out loud — explain your reasoning, not just the answer."}
            value={draft + (speech.interim ? (draft ? " " : "") + speech.interim : "")}
            onChange={(e) => {
              setDraft(e.target.value);
              if (!answerStart) setAnswerStart(Date.now());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            disabled={!!busy}
            aria-label="Your answer"
          />
          {showStats && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
              <span>{live.words} words</span>
              {usedVoice && live.words > 5 && <span>pace: {live.wpm} wpm ({paceLabel(live.wpm, true)})</span>}
              <span className={live.fillers > 3 ? "text-warn" : ""}>fillers: {live.fillers}</span>
              {live.hedges > 0 && <span>hedges: {live.hedges}</span>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {speech.supported && (
              <button onClick={toggleMic} disabled={!!busy} className={`btn ${speech.listening ? "bg-bad text-white" : "btn-ghost"}`} aria-pressed={speech.listening}>
                {speech.listening ? "■ Stop mic" : "🎙 Speak"}
              </button>
            )}
            <button className="btn-ghost" onClick={() => request("hint")} disabled={!canAct}>Hint</button>
            <button className="btn-ghost" onClick={() => request("clarify")} disabled={!canAct}>Clarify</button>
            {lastInterviewer && <button className="btn-ghost" onClick={() => speak(lastInterviewer.text)} disabled={!!busy}>Repeat</button>}
            <button className="btn-ghost" onClick={() => request("skip")} disabled={!canAct}>Skip</button>
            <button className="btn-primary ml-auto" onClick={submit} disabled={!canAct || !draft.trim()}>
              Submit answer <span className="hidden text-xs opacity-70 sm:inline">⌘↵</span>
            </button>
          </div>
        </div>
      </div>

      {/* Agent reasoning panel (opt-in, for transparency) */}
      {showAgent && (
        <aside className="card h-fit max-h-[80vh] overflow-y-auto p-4 text-sm lg:w-80" aria-label="How the interviewer decides">
          <h2 className="font-medium">How the interviewer decides</h2>
          <p className="mt-1 text-xs text-muted">The agent plans the interview, grades each answer against a rubric, then picks its next move.</p>
          {plan && (
            <div className="mt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">Plan</div>
              <ol className="mt-1 space-y-1">
                {plan.items.map((p, i) => (
                  <li key={i} className={i === session.currentQ ? "font-medium" : i < session.currentQ ? "text-muted line-through" : "text-muted"}>
                    {i + 1}. {p.competency} <span className="text-xs">({p.type})</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2 text-xs text-muted">Difficulty now: {["", "easier", "standard", "harder"][session.difficulty]}</div>
            </div>
          )}
          <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Steps</div>
          <ol className="mt-1 space-y-2">
            {[...session.trace].reverse().slice(0, 20).map((t, i) => (
              <li key={i} className="rounded-lg border border-line p-2">
                <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase">{t.step}</span>
                <span className="text-xs">{t.text}</span>
              </li>
            ))}
            {session.trace.length === 0 && <li className="text-xs text-muted">Nothing yet.</li>}
          </ol>
        </aside>
      )}
    </div>
  );
}

function TurnView({ t, onReplay }: { t: Turn; onReplay: () => void }) {
  const me = t.role === "candidate";
  const tag: Record<string, string> = { followup: "Follow-up", hint: "Hint", clarification: "Clarification", closing: "Wrap-up" };
  return (
    <div className={me ? "ml-10" : "mr-10"}>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        {me ? "You" : "Interviewer"}
        {!me && tag[t.kind] && <span className="rounded bg-brand-soft px-1.5 py-0.5">{tag[t.kind]}</span>}
        {!me && <button onClick={onReplay} className="hover:text-ink" aria-label="Read aloud">🔊</button>}
      </div>
      <div className={`whitespace-pre-wrap rounded-xl p-3 text-[15px] leading-relaxed ${me ? "bg-brand-soft" : t.kind === "hint" ? "bg-warn-soft" : "border border-line"}`}>{t.text}</div>
      {t.quickFeedback && (
        <div className="mt-1.5 rounded-lg border border-dashed border-line p-2 text-xs">
          <span className="font-medium">Quick feedback {"●".repeat(t.quickFeedback.score)}{"○".repeat(5 - t.quickFeedback.score)}</span> — {t.quickFeedback.tip}
        </div>
      )}
    </div>
  );
}
