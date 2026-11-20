"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteSession, loadSessions } from "@/lib/storage";
import { DIMENSIONS, getTrack } from "@/lib/tracks";
import { scoreTone } from "@/components/ScoreRing";
import type { DimensionKey, InterviewSession } from "@/lib/types";

export default function ProgressPage() {
  const [all, setAll] = useState<InterviewSession[] | null>(null);
  useEffect(() => {
    setAll(loadSessions());
  }, []);
  if (!all) return <p className="text-muted">Loading…</p>;

  const done = all.filter((s) => s.report).sort((a, b) => a.createdAt - b.createdAt);
  const scores = done.map((s) => s.report!.overall);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const change = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;
  const avg = (k: DimensionKey) => {
    const xs = done.map((s) => s.report!.dimensions.find((d) => d.key === k)?.score).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const dimAvgs = (Object.keys(DIMENSIONS) as DimensionKey[]).map((k) => ({ k, v: avg(k) }));
  const weakest = done.length ? [...dimAvgs].sort((a, b) => a.v - b.v)[0] : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Your journey</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">My progress</h1>
          <p className="mt-1 text-sm text-muted">Stored only in this browser.</p>
        </div>
        <Link href="/setup" className="btn-primary">+ New practice</Link>
      </div>

      {all.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-2xl">🎯</div>
          <p className="mt-4 text-lg font-semibold">No practice sessions yet</p>
          <p className="mt-1 text-sm text-muted">Your scores and trends will appear here after your first interview.</p>
          <Link href="/setup" className="btn-primary mt-6">Start your first interview</Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Interviews completed" value={String(done.length)} sub={`${all.length - done.length} in progress`} />
            <Tile label="Average score" value={done.length ? avgScore.toFixed(1) : "—"} sub="out of 10" />
            <Tile label="Best score" value={done.length ? String(Math.max(...scores)) : "—"} sub="out of 10" />
            <Tile
              label="Since first session"
              value={change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
              sub={change === null ? "Do 2+ sessions" : change > 0 ? "Improving 📈" : change < 0 ? "Keep going" : "Steady"}
              color={change === null ? undefined : change > 0 ? "var(--good)" : change < 0 ? "var(--bad)" : undefined}
            />
          </div>

          {done.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="card p-6">
                <h2 className="font-semibold">Overall score over time</h2>
                <div className="mt-4">
                  <Trend values={scores} />
                </div>
              </section>
              <section className="card p-6">
                <h2 className="font-semibold">Average by skill</h2>
                <div className="mt-4 space-y-3.5">
                  {dimAvgs.map(({ k, v }) => (
                    <div key={k} className="text-sm">
                      <div className="flex justify-between">
                        <span>{DIMENSIONS[k].label}</span>
                        <span className="font-semibold" style={{ color: scoreTone(v) }}>{v.toFixed(1)}</span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-line">
                        <div className="h-2 rounded-full" style={{ width: `${v * 10}%`, background: scoreTone(v) }} />
                      </div>
                    </div>
                  ))}
                </div>
                {weakest && (
                  <p className="mt-5 rounded-xl bg-brand-soft p-3 text-sm">
                    🎯 Focus next on <b>{DIMENSIONS[weakest.k].label.toLowerCase()}</b> — add it as a focus area in your next session.
                  </p>
                )}
              </section>
            </div>
          )}

          <section className="card divide-y divide-line">
            <h2 className="px-6 py-4 font-semibold">Sessions ({all.length})</h2>
            {all.map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg text-sm font-bold"
                  style={{ color: s.report ? scoreTone(s.report.overall) : "var(--muted)" }}
                >
                  {s.report ? s.report.overall : "…"}
                </span>
                <Link href={s.status === "ended" ? `/report/${s.id}` : `/interview/${s.id}`} className="min-w-0 flex-1 hover:text-brand">
                  <div className="truncate font-medium">{s.config.role || getTrack(s.config.track).name}{s.config.company && ` · ${s.config.company}`}</div>
                  <div className="text-xs text-muted">
                    {new Date(s.createdAt).toLocaleString()} · {s.status === "ended" ? "Completed — view report" : "In progress — resume"}
                  </div>
                </Link>
                <button
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-bad-soft hover:text-bad"
                  onClick={() => {
                    if (confirm("Delete this session? This cannot be undone.")) {
                      deleteSession(s.id);
                      setAll(loadSessions());
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Trend({ values }: { values: number[] }) {
  const W = 520, H = 180, P = 24;
  if (values.length < 2)
    return (
      <p className="rounded-xl bg-bg p-4 text-sm text-muted">
        Complete at least two sessions to see a trend. Current score: <b className="text-ink">{values[0]}/10</b>
      </p>
    );
  const x = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v: number) => H - P - (v * (H - 2 * P)) / 10;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Overall scores over time: ${values.join(", ")}`}>
      <defs>
        <linearGradient id="pw-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10].map((g) => (
        <g key={g}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g === 0 ? undefined : "3 4"} />
          <text x={4} y={y(g) + 4} fontSize="11" fill="var(--muted)">{g}</text>
        </g>
      ))}
      <path d={area} fill="url(#pw-area)" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={5} fill="var(--card)" stroke="var(--brand)" strokeWidth={2.5} />
          <text x={x(i)} y={y(v) - 10} fontSize="11" textAnchor="middle" fill="var(--ink)">{v}</text>
        </g>
      ))}
    </svg>
  );
}
