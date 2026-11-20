export const scoreTone = (s: number) => (s >= 7 ? "var(--good)" : s >= 5 ? "var(--warn)" : "var(--bad)");
export const scoreWord = (s: number) => (s >= 9 ? "Exceptional" : s >= 7 ? "Strong" : s >= 5 ? "Borderline" : s >= 3 ? "Needs work" : "Just starting");

/** Circular 0–10 score gauge. */
export function ScoreRing({ score, size = 132, label = "Overall" }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label} score ${score} out of 10`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={10} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreTone(score)}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 10)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-4xl font-semibold leading-none" style={{ color: scoreTone(score) }}>
            {score}
            <span className="text-base text-muted">/10</span>
          </div>
          <div className="mt-1 text-xs text-muted">{label}</div>
        </div>
      </div>
    </div>
  );
}
