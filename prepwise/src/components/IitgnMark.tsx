/** IIT Gandhinagar emblem (upright) with an optional horizontal wordmark. */
export function IitgnEmblem({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-xl bg-white ring-1 ring-black/5" style={{ width: size + 8, height: size + 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/iitgn-emblem.png" alt="" width={size} height={size} style={{ width: size, height: size }} />
    </span>
  );
}

export function IitgnLockup({ size = 28, sub }: { size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <IitgnEmblem size={size} />
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-ink">IIT Gandhinagar</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
    </span>
  );
}
