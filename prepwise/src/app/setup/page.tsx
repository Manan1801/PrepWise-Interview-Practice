"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TRACKS, getTrack } from "@/lib/tracks";
import { newSession, saveSession } from "@/lib/storage";
import type { FeedbackTiming, InterviewType, Level, Persona, SessionConfig, TrackId } from "@/lib/types";

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

  function addFocus() {
    const f = customFocus.trim();
    if (f && !cfg.focus.includes(f)) set("focus", [...cfg.focus, f]);
    setCustomFocus("");
  }

  function start() {
    try {
      if (cfg.resume) localStorage.setItem("prepwise.resume", cfg.resume);
    } catch {}
    const s = newSession(cfg, aiOn ? "ai" : "offline");
    saveSession(s);
    router.push(`/interview/${s.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Set up your practice interview</h1>
        <p className="mt-1 text-sm text-muted">Works for any role. Only the role is required. Everything else has sensible defaults.</p>
        {aiOn === false && (
          <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">
            Running in <b>offline mode</b>: questions come from a built-in bank and feedback is rule-based.
          </p>
        )}
      </div>

      <Section n={1} title="What are you preparing for?">
        <label className="label" htmlFor="role">Role</label>
        <input
          id="role"
          className="input text-base"
          placeholder="e.g. Data Analyst, SDE Intern, Product Designer, Mechanical GET, PhD admission…"
          value={cfg.role}
          onChange={(e) => set("role", e.target.value)}
        />
        <p className="mt-3 mb-2 text-xs text-muted">Or start from a preset:</p>
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company">Organisation (optional)</label>
            <input id="company" className="input" placeholder={`e.g. ${track.examples.split(",")[0]}`} value={cfg.company} onChange={(e) => set("company", e.target.value)} />
          </div>
          <Choice<Level>
            label="Your stage"
            value={cfg.level}
            onChange={(v) => set("level", v)}
            options={[["student", "Student / intern"], ["fresher", "Fresher"], ["experienced", "Experienced"], ["career-switch", "Switching careers"]]}
          />
        </div>
      </Section>

      <Section n={2} title="Interview format">
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice<InterviewType>
            label="Question style"
            value={cfg.interviewType}
            onChange={(v) => set("interviewType", v)}
            options={[["auto", "Like the real one"], ["technical", "Technical"], ["behavioral", "Behavioural"], ["mixed", "Mixed"], ["case", "Case / problem-solving"]]}
          />
          <div>
            <span className="label">Main questions: {cfg.numQuestions} <span className="font-normal text-muted">(~{cfg.numQuestions * 5} min)</span></span>
            <input type="range" min={2} max={8} value={cfg.numQuestions} onChange={(e) => set("numQuestions", Number(e.target.value))} className="w-full accent-[var(--brand)]" aria-label="Number of questions" />
          </div>
        </div>
      </Section>

      <Section n={3} title="What do you want to work on?" hint="The interviewer and the feedback will focus on these.">
        <div className="flex flex-wrap gap-2">
          {[...new Set([...track.focusOptions, ...cfg.focus])].map((f) => {
            const on = cfg.focus.includes(f);
            return (
              <button key={f} className="chip" data-on={on} aria-pressed={on} onClick={() => set("focus", on ? cfg.focus.filter((x) => x !== f) : [...cfg.focus, f])}>
                {f}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="Add your own, e.g. 'Explaining my thesis simply'" value={customFocus} onChange={(e) => setCustomFocus(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFocus()} />
          <button className="btn-ghost" onClick={addFocus}>Add</button>
        </div>
      </Section>

      <Section n={4} title="Interviewer & feedback">
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice<Persona> label="Interviewer style" value={cfg.persona} onChange={(v) => set("persona", v)} options={[["friendly", "Supportive"], ["neutral", "Realistic"], ["tough", "Tough"]]} />
          <Choice<FeedbackTiming> label="When do you want feedback?" value={cfg.feedbackTiming} onChange={(v) => set("feedbackTiming", v)} options={[["after-each", "After each answer"], ["end-only", "Only at the end"]]} />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cfg.voiceOut} onChange={(e) => set("voiceOut", e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Interviewer reads questions aloud
        </label>
      </Section>

      <Section n={5} title="Personalise (optional)" hint="Paste your resume or the job description so the interviewer plans questions around your real experience.">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Tip: use Chrome or Edge and a quiet room for best voice recognition.</p>
        <button className="btn-primary px-6" onClick={start} disabled={aiOn === null || !cfg.role.trim()}>
          Start interview →
        </button>
      </div>
    </div>
  );
}

function Section({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-medium">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs">{n}</span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
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
