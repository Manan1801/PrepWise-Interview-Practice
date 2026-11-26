"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TRACKS, getTrack } from "@/lib/tracks";
import { newSession, saveSession } from "@/lib/storage";
import type { FeedbackTiming, InterviewType, Level, Persona, SessionConfig, TrackId } from "@/lib/types";

const LEVELS: [Level, string][] = [["student", "Student / intern"], ["fresher", "Fresher"], ["experienced", "Experienced"], ["career-switch", "Switching careers"]];
const TYPES: [InterviewType, string][] = [["auto", "Like the real one"], ["technical", "Technical"], ["behavioral", "Behavioural"], ["mixed", "Mixed"], ["case", "Case / problem-solving"]];
const PERSONAS: [Persona, string, string][] = [
  ["friendly", "Supportive", "Warm, encouraging, still realistic"],
  ["neutral", "Realistic", "Like a typical interviewer"],
  ["tough", "Tough", "Pushes hard on vague answers"],
];
const label = <T extends string>(opts: [T, string, ...string[]][], v: T) => opts.find((o) => o[0] === v)?.[1] ?? v;

export default function SetupPage() {
  return (
    <Suspense>
      <Setup />
    </Suspense>
  );
}

function Setup() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTrack = (params.get("track") as TrackId) || "general";
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<SessionConfig>(() => ({
    track: initialTrack,
    role: getTrack(initialTrack).defaultRole,
    company: "",
    level: "student",
    interviewType: "auto",
    numQuestions: 4,
    persona: "neutral",
    focus: [],
    resume: "",
    jobDescription: "",
    feedbackTiming: "after-each",
    voiceOut: true,
    seed: 0,
  }));
  const [customFocus, setCustomFocus] = useState("");
  const [showPersonal, setShowPersonal] = useState(false);

  useEffect(() => {
    fetch("/api/agent").then((r) => r.json()).then((d) => setAiOn(Boolean(d.ai))).catch(() => setAiOn(false));
    try {
      const saved = localStorage.getItem("prepwise.resume");
      if (saved) setCfg((c) => ({ ...c, resume: saved }));
    } catch {}
  }, []);

  const set = <K extends keyof SessionConfig>(k: K, v: SessionConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const track = getTrack(cfg.track);
  const ready = cfg.role.trim().length > 0 && aiOn !== null;

  function addFocus() {
    const f = customFocus.trim();
    if (f && !cfg.focus.includes(f)) set("focus", [...cfg.focus, f]);
    setCustomFocus("");
  }

  function start() {
    if (!ready) return;
    try {
      if (cfg.resume) localStorage.setItem("prepwise.resume", cfg.resume);
    } catch {}
    const s = newSession(cfg, aiOn ? "ai" : "offline");
    saveSession(s);
    router.push(`/interview/${s.id}`);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">New practice interview</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Set up your interview</h1>
        <p className="mt-2 text-muted">Works for any role. Only the role is required — everything else has sensible defaults.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section n={1} title="What are you preparing for?">
            <label className="label" htmlFor="role">Role</label>
            <input
              id="role"
              className="input py-3 text-base"
              placeholder="e.g. Data Analyst, SDE Intern, Product Designer, Mechanical GET, PhD admission…"
              value={cfg.role}
              onChange={(e) => set("role", e.target.value)}
              autoFocus
            />
            <p className="mt-4 mb-2 text-xs font-medium text-muted">Or start from a preset</p>
            <div className="flex flex-wrap gap-2">
              {TRACKS.map((t) => (
                <button
                  key={t.id}
                  className="chip"
                  data-on={cfg.track === t.id}
                  aria-pressed={cfg.track === t.id}
                  onClick={() => setCfg((c) => ({ ...c, track: t.id, role: t.defaultRole || c.role, focus: [] }))}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="company">Organisation <span className="font-normal text-muted">(optional)</span></label>
                <input id="company" className="input" placeholder={`e.g. ${track.examples.split(",")[0]}`} value={cfg.company} onChange={(e) => set("company", e.target.value)} />
              </div>
              <Choice label="Your stage" value={cfg.level} onChange={(v) => set("level", v)} options={LEVELS} />
            </div>
          </Section>

          <Section n={2} title="Interview format">
            <Choice label="Question style" value={cfg.interviewType} onChange={(v) => set("interviewType", v)} options={TYPES} />
            <div className="mt-5">
              <div className="flex items-baseline justify-between">
                <span className="label">Main questions</span>
                <span className="text-sm"><b>{cfg.numQuestions}</b> <span className="text-muted">· about {cfg.numQuestions * 5} min</span></span>
              </div>
              <input type="range" min={2} max={8} value={cfg.numQuestions} onChange={(e) => set("numQuestions", Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-label="Number of questions" />
              <div className="mt-1 flex justify-between text-xs text-muted"><span>Quick (2)</span><span>Full round (8)</span></div>
            </div>
          </Section>

          <Section n={3} title="What do you want to work on?" hint="The interviewer and the feedback will focus on these.">
            <div className="flex flex-wrap gap-2">
              {[...new Set([...track.focusOptions, ...cfg.focus])].map((f) => {
                const on = cfg.focus.includes(f);
                return (
                  <button key={f} className="chip" data-on={on} aria-pressed={on} onClick={() => set("focus", on ? cfg.focus.filter((x) => x !== f) : [...cfg.focus, f])}>
                    {on ? "✓ " : ""}{f}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="Add your own, e.g. ‘Explaining my thesis simply’" value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFocus()} />
              <button className="btn-ghost" onClick={addFocus} disabled={!customFocus.trim()}>Add</button>
            </div>
          </Section>

          <Section n={4} title="Interviewer & feedback">
            <span className="label">Interviewer style</span>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Interviewer style">
              {PERSONAS.map(([v, l, d]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={cfg.persona === v}
                  onClick={() => set("persona", v)}
                  className={`rounded-xl border p-3 text-left transition ${cfg.persona === v ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50"}`}
                >
                  <div className="text-sm font-medium">{l}</div>
                  <div className="mt-0.5 text-xs text-muted">{d}</div>
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Choice<FeedbackTiming> label="When do you want feedback?" value={cfg.feedbackTiming} onChange={(v) => set("feedbackTiming", v)} options={[["after-each", "After each answer"], ["end-only", "Only at the end"]]} />
              <div>
                <span className="label">Voice</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-sm">
                  <input type="checkbox" checked={cfg.voiceOut} onChange={(e) => set("voiceOut", e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                  Interviewer reads questions aloud
                </label>
              </div>
            </div>
          </Section>

          <Section n={5} title="Personalise" hint="Optional. Paste your resume or the job description so the interviewer plans questions around your real experience.">
            {!showPersonal && !cfg.resume ? (
              <button className="btn-ghost" onClick={() => setShowPersonal(true)}>+ Add resume / job description</button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="resume">Resume or background</label>
                  <textarea id="resume" rows={5} className="input" placeholder="Paste the text of your resume (saved only in this browser)" value={cfg.resume} onChange={(e) => set("resume", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="jd">Job description</label>
                  <textarea id="jd" rows={4} className="input" placeholder="Paste the job description" value={cfg.jobDescription} onChange={(e) => set("jobDescription", e.target.value)} />
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-br from-brand to-brand-2 p-5 text-white dark:text-black">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Your interview</div>
              <div className="mt-1 text-xl font-semibold leading-snug">{cfg.role.trim() || "Choose a role"}</div>
              {cfg.company && <div className="text-sm opacity-90">at {cfg.company}</div>}
            </div>
            <dl className="divide-y divide-line px-5 text-sm">
              <Row k="Stage" v={label(LEVELS, cfg.level)} />
              <Row k="Style" v={label(TYPES, cfg.interviewType)} />
              <Row k="Questions" v={`${cfg.numQuestions} · ~${cfg.numQuestions * 5} min`} />
              <Row k="Interviewer" v={label(PERSONAS, cfg.persona)} />
              <Row k="Feedback" v={cfg.feedbackTiming === "after-each" ? "After each answer" : "At the end"} />
              <Row k="Personalised" v={cfg.resume || cfg.jobDescription ? "Yes" : "No"} />
              {cfg.focus.length > 0 && <Row k="Focus" v={cfg.focus.join(", ")} />}
            </dl>
            <div className="space-y-3 p-5 pt-3">
              <button className="btn-primary w-full py-3 text-base" onClick={start} disabled={!ready}>
                Start interview →
              </button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted">
                <span className={`h-2 w-2 rounded-full ${aiOn === null ? "bg-line" : aiOn ? "bg-good" : "bg-warn"}`} />
                {aiOn === null ? "Checking AI…" : aiOn ? "AI interviewer ready" : "Offline mode (built-in questions)"}
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-xs text-muted">Tip: voice answers are transcribed by Whisper and work in any modern browser — a quiet room helps. Coding questions open a built-in code editor (C++, Java, Python, JavaScript).</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{n}</span>
        {title}
      </h2>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={value === v} className="chip" data-on={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
