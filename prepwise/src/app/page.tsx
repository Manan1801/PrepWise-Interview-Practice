import Link from "next/link";
import { IitgnEmblem } from "@/components/IitgnMark";
import { TRACKS } from "@/lib/tracks";

const AGENT_STEPS = [
  { k: "Plan", d: "Designs an interview for your role, company, resume and JD — each question with a rubric." },
  { k: "Assess", d: "Grades every answer against that rubric: what you covered, what's missing." },
  { k: "Decide", d: "Probes a gap, steers you back, goes deeper, or moves on — and adapts difficulty." },
  { k: "Act", d: "Asks the next question naturally, by voice or text, in the style you chose." },
  { k: "Coach", d: "Writes a report grounded in its notes, with a plan for your next practice." },
];

const WHY = [
  {
    t: "Follow-ups on what you actually said",
    d: "Not a static question list. Vague answer? It asks for numbers. Strong answer? It pushes on trade-offs — like a real interviewer.",
  },
  {
    t: "Feedback you can act on",
    d: "Scores on structure, depth, specificity, communication and delivery, quoting your answer, plus how a strong answer is structured.",
  },
  {
    t: "You stay in control",
    d: "Pick the role, style and focus. Ask for a hint, clarification or skip anytime. See exactly why the interviewer asked what it asked.",
  },
];

export default function Home() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden rounded-3xl px-4 py-10 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{ background: "radial-gradient(55% 60% at 10% 0%, var(--brand-soft), transparent 70%)" }}
        />
        <div className="grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-3 rounded-2xl border border-line bg-card py-1.5 pl-1.5 pr-4 text-sm shadow-sm">
              <IitgnEmblem size={22} />
              <span className="font-medium">Made for <span className="text-brand">IIT Gandhinagar</span></span>
            </div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-[3.25rem]">
              Practise interviews on your own — with an interviewer that <span className="text-brand">actually listens.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Type any role. An AI interviewer agent plans a realistic interview, asks follow-ups on what you say, adapts its difficulty and
              gives you specific feedback — any time, for free.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/setup" className="btn-primary px-6 py-3 text-base">Start practising →</Link>
              <Link href="/progress" className="btn-ghost px-6 py-3 text-base">My progress</Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {["Any role, tech or non-tech", "Voice or text", "Free · no login", "Private — stays in your browser"].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <Check /> {x}
                </li>
              ))}
            </ul>
          </div>

          <div className="card relative p-5 shadow-xl shadow-black/5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">SDE Intern · Q2 of 4</div>
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs">AI interviewer</span>
            </div>
            <div className="space-y-3 text-sm">
              <Bubble who="Interviewer">Tell me about the most challenging project on your resume.</Bubble>
              <Bubble who="You" me>I built a campus bus tracker with GPS modules… it reduced waiting time a lot.</Bubble>
              <div className="rounded-lg border border-dashed border-line p-2 text-xs">
                <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase">assess</span>
                partial · missing: measurable impact
                <span className="mx-1.5 text-muted">→</span>
                <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase">decide</span>
                probe
              </div>
              <Bubble who="Interviewer" tag="Follow-up">You said “a lot” — roughly how much, and how did you measure it?</Bubble>
            </div>
          </div>
        </div>
      </section>

      {/* Agent loop */}
      <section>
        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium text-brand">How it works</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">An interviewer agent, not a question generator</h2>
          <p className="mt-2 text-muted">Every answer goes through a loop of planning, assessment and decision — and you can open the reasoning panel to see it.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AGENT_STEPS.map((s, i) => (
            <li key={s.k} className="card relative p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white dark:text-black">{i + 1}</span>
                <span className="font-semibold">{s.k}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted">{s.d}</p>
              {i < AGENT_STEPS.length - 1 && <span aria-hidden className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-muted lg:block">›</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* Why */}
      <section className="grid gap-4 md:grid-cols-3">
        {WHY.map((w) => (
          <div key={w.t} className="card p-5">
            <div className="mb-3 h-1 w-10 rounded-full bg-brand" />
            <h3 className="font-semibold">{w.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{w.d}</p>
          </div>
        ))}
      </section>

      {/* Presets */}
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-brand">Start fast</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Popular presets</h2>
          </div>
          <Link href="/setup" className="text-sm text-muted underline-offset-4 hover:underline">Or type any role →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => (
            <Link key={t.id} href={`/setup?track=${t.id}`} className="card group p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-black/5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                <span className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand">→</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{t.blurb}</p>
              <p className="mt-3 text-xs text-muted">e.g. {t.examples}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="card flex flex-col items-start justify-between gap-5 bg-brand-soft p-8 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Your next interview is closer than you think.</h2>
          <p className="mt-1 text-muted">Do one 15-minute session today. Compare your scores next week.</p>
        </div>
        <Link href="/setup" className="btn-primary px-6 py-3 text-base">Start a practice interview</Link>
      </section>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
    </svg>
  );
}

function Bubble({ who, children, me, tag }: { who: string; children: React.ReactNode; me?: boolean; tag?: string }) {
  return (
    <div className={me ? "ml-8" : "mr-8"}>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted">
        {who}
        {tag && <span className="rounded bg-brand-soft px-1.5 py-0.5">{tag}</span>}
      </div>
      <div className={`rounded-xl p-3 leading-relaxed ${me ? "bg-brand-soft" : "border border-line bg-card"}`}>{children}</div>
    </div>
  );
}
