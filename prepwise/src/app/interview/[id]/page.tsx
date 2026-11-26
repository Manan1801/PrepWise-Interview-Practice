"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { agentCall, reportCall } from "@/lib/api";
import { getSession, saveSession, uid } from "@/lib/storage";
import { computeMetrics, paceLabel } from "@/lib/metrics";
import { speak, stopSpeaking, useVoiceAnswer } from "@/lib/useSpeech";
import { LANGS, isLang } from "@/lib/code";
import { CodeEditor } from "@/components/CodeEditor";
import type { AgentInput, CodeLang, InterviewSession, RunResult, SessionReport, Turn } from "@/lib/types";

type CodeDrafts = Record<number, { lang: CodeLang; sources: Partial<Record<CodeLang, string>>; run?: RunResult }>;
const codeKey = (id: string) => `prepwise.code.${id}`;
function loadDrafts(id: string): CodeDrafts {
  try {
    return JSON.parse(localStorage.getItem(codeKey(id)) || "{}");
  } catch {
    return {};
  }
}
function preferredLang(): CodeLang {
  try {
    const l = localStorage.getItem("prepwise.codeLang");
    if (isLang(l)) return l;
  } catch {}
  return "cpp";
}

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
  const spokenSecs = useRef(0); // seconds actually recorded for the current answer
  const [now, setNow] = useState(Date.now());
  const sessionRef = useRef<InterviewSession | null>(null);
  const inflight = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- code editor (per-question drafts, one source per language) ----
  const [editorOpen, setEditorOpen] = useState(false);
  const [drafts, setDrafts] = useState<CodeDrafts>({});
  const [running, setRunning] = useState(false);

  const voice = useVoiceAnswer(
    (txt) => {
      setDraft((d) => (d ? d + " " : "") + txt);
    },
    () => {
      const s = sessionRef.current;
      const last = s ? [...s.turns].reverse().find((t) => t.role === "interviewer") : undefined;
      return last?.text ?? "";
    },
    (secs) => {
      spokenSecs.current += secs;
    },
  );

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

  // Load saved code drafts once, then keep them in localStorage so a reload never loses code.
  useEffect(() => {
    setDrafts(loadDrafts(id));
  }, [id]);

  // Open the editor automatically on coding questions (or where the candidate already wrote code).
  const curQ = session?.currentQ ?? -1;
  const curCoding = !!session?.plan?.items[curQ]?.coding;
  useEffect(() => {
    if (curQ < 0) return;
    setEditorOpen(curCoding || !!loadDrafts(id)[curQ]);
  }, [id, curQ, curCoding]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [session?.turns.length, busy]);

  const finish = useCallback(
    async (s: InterviewSession) => {
      stopSpeaking();
      voice.stop();
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
        spokenSecs.current = 0;
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

  // Current question's code state
  const qDraft = session ? drafts[session.currentQ] : undefined;
  const codeLang: CodeLang = qDraft?.lang ?? preferredLang();
  const codeSrc = qDraft?.sources[codeLang] ?? LANGS[codeLang].starter;
  const lastSentCode = session
    ? [...session.turns].reverse().find((t) => t.role === "candidate" && t.qIndex === session.currentQ && t.code)?.code?.source
    : undefined;
  const codeReady = editorOpen && codeSrc.trim() !== LANGS[codeLang].starter.trim() && codeSrc !== lastSentCode;

  function updateCode(patch: { lang?: CodeLang; source?: string; run?: RunResult | null }) {
    const q = sessionRef.current?.currentQ ?? 0;
    setDrafts((all) => {
      const cur = all[q] ?? { lang: codeLang, sources: {} };
      const lang = patch.lang ?? cur.lang;
      const next: CodeDrafts = {
        ...all,
        [q]: {
          lang,
          sources: patch.source !== undefined ? { ...cur.sources, [lang]: patch.source } : cur.sources,
          run: patch.run === null ? undefined : patch.run ?? cur.run,
        },
      };
      try {
        localStorage.setItem(codeKey(id), JSON.stringify(next));
      } catch {}
      return next;
    });
    if (patch.lang)
      try {
        localStorage.setItem("prepwise.codeLang", patch.lang);
      } catch {}
  }

  async function runCode(stdin: string) {
    setRunning(true);
    let res: RunResult;
    try {
      const r = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: codeLang, source: codeSrc, stdin }), signal: AbortSignal.timeout(60_000) });
      const j = await r.json();
      res = r.ok ? j : { status: "unavailable", output: j.error ?? "Couldn't run the code.", stdin };
    } catch {
      res = { status: "unavailable", output: "Couldn't reach the code runner. Check your connection and try again.", stdin };
    }
    updateCode({ run: res });
    setRunning(false);
  }

  function submit() {
    const s = sessionRef.current;
    if (!s || (!draft.trim() && !codeReady) || busy || voice.state !== "idle") return;
    // Pace uses the time actually spent speaking; typed answers fall back to elapsed time (pace isn't shown for them).
    const secs = usedVoice && spokenSecs.current >= 2 ? spokenSecs.current : answerStart ? (Date.now() - answerStart) / 1000 : 30;
    spokenSecs.current = 0;
    const turn: Turn = {
      id: uid(),
      role: "candidate",
      kind: "answer",
      text: draft.trim(),
      code: codeReady ? { lang: codeLang, source: codeSrc, run: qDraft?.run } : undefined,
      qIndex: s.currentQ,
      metrics: computeMetrics(draft, secs, usedVoice),
      at: Date.now(),
    };
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
    if (voice.state === "recording") voice.stop();
    else if (voice.state === "idle") {
      voice.start();
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
      <div className="card mx-auto max-w-md p-8 text-center">
        <p className="font-medium">This session was not found in this browser.</p>
        <Link href="/setup" className="btn-primary mt-5">Start a new one</Link>
      </div>
    );
  if (!session) return <p className="text-muted">Loading…</p>;

  if (busy === "report")
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center" role="status">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-brand-soft border-t-brand" />
        <p className="text-lg font-semibold">The coach is writing your feedback…</p>
        <p className="mt-1.5 text-sm text-muted">Reviewing each answer against the interview plan. This usually takes a few seconds.</p>
      </div>
    );

  const { config, plan } = session;
  const total = plan?.items.length ?? config.numQuestions;
  const item = plan?.items[session.currentQ];
  const lastInterviewer = [...session.turns].reverse().find((t) => t.role === "interviewer");
  const stuck = !busy && pendingInput(session) !== null;
  const live = computeMetrics(draft + " " + voice.preview, answerStart ? (now - answerStart) / 1000 : 0, usedVoice);
  const elapsed = answerStart ? Math.floor((now - answerStart) / 1000) : 0;
  const canAct = !busy && !stuck && !!lastInterviewer;
  const answered = session.turns.some((t) => t.role === "candidate" && t.kind === "answer");

  return (
    <div
      className={`mx-auto grid gap-5 ${
        editorOpen && showAgent
          ? "max-w-[1500px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_300px]"
          : editorOpen
            ? "max-w-7xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
            : showAgent
              ? "max-w-6xl lg:grid-cols-[1fr_320px]"
              : "max-w-4xl"
      }`}
    >
      <div className="min-w-0 space-y-4">
        {/* Header */}
        <div className="card p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold">{config.role}</h1>
                {config.company && <span className="text-muted">· {config.company}</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${session.mode === "ai" ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn"}`}>
                  {session.mode === "ai" ? "● AI interviewer" : "● Offline mode"}
                </span>
              </div>
              {item && (
                <div className="mt-1 text-sm text-muted">
                  Question {Math.min(session.currentQ + 1, total)} of {total} · <span className="text-ink">{item.competency}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost px-3 py-2" onClick={toggleAgent} aria-pressed={showAgent}>{showAgent ? "Hide" : "Show"} reasoning</button>
              <button className="btn-ghost px-3 py-2" onClick={() => finish(session)} disabled={!!busy || !answered}>End & get feedback</button>
            </div>
          </div>
          <div className="mt-4 flex gap-1.5" aria-label={`Question ${session.currentQ + 1} of ${total}`}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} title={plan?.items[i]?.competency} className={`h-1.5 flex-1 rounded-full transition-colors ${i < session.currentQ ? "bg-brand" : i === session.currentQ ? "bg-brand/50" : "bg-line"}`} />
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className={`card ${editorOpen ? "max-h-[42vh]" : "max-h-[50vh]"} min-h-[220px] space-y-5 overflow-y-auto p-4 sm:p-6`} aria-live="polite">
          {session.turns.length === 0 && busy && <Thinking text="The interviewer is planning your interview" />}
          {session.turns.map((t) => (
            <TurnView key={t.id} t={t} onReplay={() => speak(t.text)} />
          ))}
          {busy === "thinking" && session.turns.length > 0 && <Thinking text={retrying ? `Connection hiccup — retrying (${retrying}/2)` : "Interviewer is thinking"} />}
        </div>

        {(error || stuck) && !busy && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-sm" role="alert">
            <span className="flex-1">{error || "The interviewer hasn't replied yet."} <b>Your answer is saved.</b></span>
            <button className="btn-primary py-2" onClick={() => { const p = pendingInput(session); if (p) run(p); }}>Retry</button>
          </div>
        )}

        {/* Composer */}
        <div className="card p-4 sm:p-5">
          <div className="flex gap-4">
            {voice.supported && (
              <button
                onClick={toggleMic}
                disabled={!!busy || voice.state === "transcribing"}
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-60 ${voice.state === "recording" ? "pw-pulse bg-red-600" : "bg-brand hover:bg-brand-2 dark:text-black"}`}
                aria-pressed={voice.state === "recording"}
                aria-label={voice.state === "recording" ? "Stop recording" : voice.state === "transcribing" ? "Transcribing" : "Answer by voice"}
                title={voice.state === "recording" ? "Stop recording" : "Answer by voice"}
              >
                {voice.state === "recording" ? <StopIcon /> : voice.state === "transcribing" ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <MicIcon />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <textarea
                className="input min-h-28 resize-y text-[15px] leading-relaxed"
                placeholder={
                  voice.state === "recording"
                    ? voice.engine === "whisper"
                      ? "Recording… speak naturally. Tap stop when you're done — Whisper will transcribe it."
                      : "Listening… speak naturally. You can edit the text before submitting."
                    : voice.state === "transcribing"
                      ? "Transcribing your answer with Whisper…"
                      : editorOpen
                        ? "Explain your approach and its time/space complexity (speak or type). Your code is sent with this."
                        : voice.supported
                          ? "Tap the mic and speak, or type here. Think out loud — explain your reasoning."
                          : "Type your answer. Think out loud — explain your reasoning."
                }
                value={draft + (voice.preview ? (draft ? " " : "") + voice.preview : "")}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (!answerStart) setAnswerStart(Date.now());
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
                }}
                disabled={!!busy || voice.state !== "idle"}
                aria-label="Your answer"
              />
              {voice.state === "transcribing" && <p className="mt-1.5 text-xs text-brand">Transcribing with Whisper…</p>}
              {voice.error && <p className="mt-1.5 text-xs text-bad" role="alert">{voice.error}</p>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                {showStats ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>⏱ {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
                    <span>{live.words} words</span>
                    {usedVoice && live.words > 5 && <span>{live.wpm} wpm · {paceLabel(live.wpm, true)}</span>}
                    <span className={live.fillers > 3 ? "font-medium text-warn" : ""}>fillers: {live.fillers}</span>
                    {live.hedges > 0 && <span>hedges: {live.hedges}</span>}
                  </div>
                ) : (
                  <span>Live stats hidden</span>
                )}
                <button className="underline-offset-2 hover:underline" onClick={() => setShowStats((v) => !v)}>{showStats ? "Hide" : "Show"} live stats</button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className="btn-ghost px-3 py-2" onClick={() => request("hint")} disabled={!canAct}>💡 Hint</button>
            <button className="btn-ghost px-3 py-2" onClick={() => request("clarify")} disabled={!canAct}>❓ Clarify</button>
            {lastInterviewer && <button className="btn-ghost px-3 py-2" onClick={() => speak(lastInterviewer.text)} disabled={!!busy}>🔁 Repeat</button>}
            <button className="btn-ghost px-3 py-2" onClick={() => request("skip")} disabled={!canAct}>⏭ Skip</button>
            <button className={`btn-ghost px-3 py-2 ${editorOpen ? "border-brand text-brand" : ""}`} onClick={() => setEditorOpen((v) => !v)} aria-pressed={editorOpen}>
              &lt;/&gt; {editorOpen ? "Hide editor" : "Code editor"}
            </button>
            <div className="ml-auto flex items-center gap-3">
              {codeReady && <span className="hidden text-xs text-muted sm:inline">+ {LANGS[codeLang].label} code attached</span>}
              <button className="btn-primary px-5" onClick={submit} disabled={!canAct || (!draft.trim() && !codeReady) || voice.state !== "idle"}>
                Submit answer <kbd className="hidden rounded bg-white/20 px-1.5 text-[10px] sm:inline">⌘↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {editorOpen && (
        <div className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
          <CodeEditor
            lang={codeLang}
            source={codeSrc}
            onLang={(l) => updateCode({ lang: l })}
            onSource={(src) => updateCode({ source: src })}
            onRun={runCode}
            run={qDraft?.run}
            running={running}
            disabled={!!busy}
          />
          <p className="mt-2 px-1 text-xs text-muted">
            Code runs in a free online sandbox (Wandbox). When you submit, your code and last run result are sent to the interviewer with your explanation.
          </p>
        </div>
      )}

      {/* Agent reasoning panel (opt-in, for transparency) */}
      {showAgent && (
        <aside className="card h-fit max-h-[85vh] overflow-y-auto p-5 text-sm lg:sticky lg:top-24" aria-label="How the interviewer decides">
          <p className="eyebrow">Agent reasoning</p>
          <h2 className="mt-1 font-semibold">How the interviewer decides</h2>
          <p className="mt-1 text-xs text-muted">It plans the interview, grades each answer against a rubric, then picks its next move.</p>
          {plan && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Plan</div>
              <ol className="mt-2 space-y-1.5">
                {plan.items.map((p, i) => (
                  <li key={i} className={`flex gap-2 ${i === session.currentQ ? "font-medium" : "text-muted"}`}>
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${i < session.currentQ ? "bg-brand text-white dark:text-black" : i === session.currentQ ? "bg-brand-soft text-brand ring-1 ring-brand" : "bg-line"}`}>
                      {i < session.currentQ ? "✓" : i + 1}
                    </span>
                    <span>{p.competency} <span className="text-xs font-normal text-muted">· {p.type}</span></span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 inline-block rounded-full bg-brand-soft px-2.5 py-1 text-xs">Difficulty: {["", "easier", "standard", "harder"][session.difficulty]}</div>
            </div>
          )}
          <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Latest steps</div>
          <ol className="mt-2 space-y-2">
            {[...session.trace].reverse().slice(0, 20).map((t, i) => (
              <li key={i} className="rounded-xl border border-line p-2.5">
                <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${t.step === "fallback" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand"}`}>{t.step}</span>
                <span className="text-xs leading-relaxed">{t.text}</span>
              </li>
            ))}
            {session.trace.length === 0 && <li className="text-xs text-muted">Nothing yet.</li>}
          </ol>
        </aside>
      )}
    </div>
  );
}

function Thinking({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar ai />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-line px-4 py-3 text-sm text-muted">
        {text}
        <span className="flex gap-1" aria-hidden>
          <span className="pw-dot h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="pw-dot h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="pw-dot h-1.5 w-1.5 rounded-full bg-muted" />
        </span>
      </div>
    </div>
  );
}

function Avatar({ ai }: { ai?: boolean }) {
  return ai ? (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-xs font-bold text-white dark:text-black" aria-hidden>AI</span>
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-line text-xs font-bold" aria-hidden>You</span>
  );
}

function TurnView({ t, onReplay }: { t: Turn; onReplay: () => void }) {
  const me = t.role === "candidate";
  const tag: Record<string, string> = { followup: "Follow-up", hint: "Hint", clarification: "Clarification", closing: "Wrap-up", question: "Question" };
  return (
    <div className={`flex items-start gap-3 ${me ? "flex-row-reverse" : ""}`}>
      <Avatar ai={!me} />
      <div className={`min-w-0 max-w-[85%] ${me ? "items-end text-right" : ""}`}>
        <div className={`mb-1 flex items-center gap-2 text-xs text-muted ${me ? "justify-end" : ""}`}>
          {me ? "You" : "Interviewer"}
          {!me && tag[t.kind] && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">{tag[t.kind]}</span>}
          {!me && (
            <button onClick={onReplay} className="rounded p-0.5 hover:text-ink" aria-label="Read aloud" title="Read aloud">🔊</button>
          )}
        </div>
        <div
          className={`inline-block whitespace-pre-wrap rounded-2xl px-4 py-3 text-left text-[15px] leading-relaxed ${
            me ? "rounded-tr-sm bg-brand text-white dark:text-black" : t.kind === "hint" ? "rounded-tl-sm border border-warn/30 bg-warn-soft" : "rounded-tl-sm border border-line bg-card"
          }`}
        >
          {t.text || (t.code ? "(submitted code)" : "")}
        </div>
        {t.code && <CodeBlock code={t.code} />}
        {t.quickFeedback && (
          <div className="mt-2 rounded-xl border border-dashed border-line bg-bg px-3 py-2 text-left text-xs">
            <span className="mr-1 font-semibold">Quick feedback</span>
            <span className="text-brand" aria-label={`${t.quickFeedback.score} out of 5`}>{"●".repeat(t.quickFeedback.score)}<span className="text-line">{"●".repeat(5 - t.quickFeedback.score)}</span></span>
            <div className="mt-1 text-muted">{t.quickFeedback.tip}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: NonNullable<Turn["code"]> }) {
  const lines = code.source.split("\n").length;
  return (
    <details className="mt-2 overflow-hidden rounded-xl border border-line text-left">
      <summary className="cursor-pointer bg-bg px-3 py-2 text-xs font-medium">
        &lt;/&gt; {LANGS[code.lang]?.label ?? code.lang} code · {lines} lines{code.run ? ` · last run: ${code.run.status.replace("_", " ")}` : ""}
      </summary>
      <pre className="max-h-72 overflow-auto bg-[#1e1e1e] p-3 font-mono text-xs leading-relaxed text-[#d4d4d4]">{code.source}</pre>
    </details>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
