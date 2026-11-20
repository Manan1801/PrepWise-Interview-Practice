import Link from "next/link";
import { TRACKS } from "@/lib/tracks";

const STEPS = [
  { t: "Any role, your way", d: "Type any role — tech or non-tech. Add a company, resume or JD, and the agent plans a personalised interview." },
  { t: "Interview like it's real", d: "Answer by voice or text. The interviewer asks follow-ups on what you actually said. Ask for a hint, clarification, or skip — you're in control." },
  { t: "Get feedback you can act on", d: "Scores on structure, depth, specificity, communication and delivery, with answer-specific fixes and a better-answer outline." },
  { t: "Track your growth", d: "See trends across sessions and retry your weakest questions." },
];

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="grid gap-8 pt-4 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <p className="mb-3 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium">Built at IIT Gandhinagar · free for anyone preparing for an interview</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Practice interviews on your own — with an interviewer that actually listens.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            No mentor free at midnight before your interview? Type any role and an AI interviewer agent plans a realistic interview for it,
            asks follow-ups on what you actually say, adapts its difficulty, and gives you specific feedback — not just a filler-word count.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/setup" className="btn-primary">Start a practice interview →</Link>
            <Link href="/progress" className="btn-ghost">View my progress</Link>
          </div>
        </div>
        <div className="card p-5 text-sm shadow-sm">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Preview</div>
          <div className="space-y-3">
            <Bubble who="Interviewer">Tell me about the most challenging project on your resume.</Bubble>
            <Bubble who="You" me>I built a campus bus tracker using GPS modules… it reduced wait time a lot.</Bubble>
            <Bubble who="Interviewer">You said “a lot” — roughly how much, and how did you measure it?</Bubble>
            <div className="rounded-xl bg-warn-soft p-3 text-xs">
              <b>Quick tip:</b> Replace vague claims with a number — “wait time dropped from ~12 to ~4 minutes in a 2-week trial”.
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="card p-4">
              <div className="mb-2 grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-sm font-semibold">{i + 1}</div>
              <div className="font-medium">{s.t}</div>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Popular presets <span className="text-sm font-normal text-muted">— or type any role</span></h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRACKS.map((t) => (
            <Link key={t.id} href={`/setup?track=${t.id}`} className="card p-4 transition hover:border-brand">
              <div className="font-medium">{t.name}</div>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
              <p className="mt-2 text-xs text-muted">e.g. {t.examples}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Bubble({ who, children, me }: { who: string; children: React.ReactNode; me?: boolean }) {
  return (
    <div className={me ? "ml-8" : "mr-8"}>
      <div className="mb-1 text-xs text-muted">{who}</div>
      <div className={`rounded-xl p-3 ${me ? "bg-brand-soft" : "border border-line"}`}>{children}</div>
    </div>
  );
}
