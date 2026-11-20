"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteSession, loadSessions } from "@/lib/storage";
import { DIMENSIONS, getTrack } from "@/lib/tracks";
import type { DimensionKey, InterviewSession } from "@/lib/types";

export default function ProgressPage() {
  const [all, setAll] = useState<InterviewSession[] | null>(null);
  useEffect(() => {
    setAll(loadSessions());
  }, []);
  if (!all) return <p className="text-muted">Loading…</p>;

  const done = all.filter((s) => s.report).sort((a, b) => a.createdAt - b.createdAt);
  const avg = (k: DimensionKey) => {
    const xs = done.map((s) => s.report!.dimensions.find((d) => d.key === k)?.score).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  };
  const dimAvgs = (Object.keys(DIMENSIONS) as DimensionKey[]).map((k) => ({ k, v: avg(k) }));
  const weakest = done.length ? [...dimAvgs].sort((a, b) => a.v - b.v)[0] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">My progress</h1>
        <Link href="/setup" className="btn-primary">New practice</Link>
      </div>

      {all.length === 0 ? (
        <div className="card p-8 text-center">
          <p>No practice sessions yet.</p>
          <Link href="/setup" className="btn-primary mt-4">Start your first interview</Link>
        </div>
      ) : (
        <>
          {done.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
              <section className="card p-5">
                <h2 className="mb-3 font-medium">Overall score over time</h2>
                <Trend values={done.map((s) => s.report!.overall)} />
              </section>
              <section className="card p-5">
                <h2 className="mb-3 font-medium">Average by skill</h2>
                <div className="space-y-2">
                  {dimAvgs.map(({ k, v }) => (
                    <div key={k} className="text-sm">
                      <div className="flex justify-between"><span>{DIMENSIONS[k].label}</span><span>{v.toFixed(1)}</span></div>
                      <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full bg-brand" style={{ width: `${v * 10}%` }} /></div>
                    </div>
                  ))}
                </div>
                {weakest && <p className="mt-3 text-xs text-muted">Focus next on <b>{DIMENSIONS[weakest.k].label.toLowerCase()}</b>.</p>}
              </section>
            </div>
          )}

          <section className="space-y-2">
            <h2 className="font-medium">Sessions ({all.length})</h2>
            {all.map((s) => (
              <div key={s.id} className="card flex items-center justify-between gap-3 p-4">
                <Link href={s.status === "ended" ? `/report/${s.id}` : `/interview/${s.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.config.role || getTrack(s.config.track).name}{s.config.company && ` · ${s.config.company}`}</div>
                  <div className="text-xs text-muted">{new Date(s.createdAt).toLocaleString()} · {s.status === "ended" ? "completed" : "in progress — resume"}</div>
                </Link>
                {s.report && <span className="text-lg font-semibold">{s.report.overall}/10</span>}
                <button
                  className="text-xs text-muted hover:text-bad"
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

function Trend({ values }: { values: number[] }) {
  const W = 400, H = 140, P = 20;
  if (values.length < 2) return <p className="text-sm text-muted">Complete at least two sessions to see a trend. Current: {values[0]}/10</p>;
  const x = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v: number) => H - P - ((v - 0) * (H - 2 * P)) / 10;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Scores: ${values.join(", ")}`}>
      {[0, 5, 10].map((g) => (
        <g key={g}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="var(--line)" />
          <text x={2} y={y(g) + 4} fontSize="10" fill="var(--muted)">{g}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill="var(--brand)" />)}
    </svg>
  );
}
