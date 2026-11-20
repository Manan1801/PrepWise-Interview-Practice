"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks() {
  const path = usePathname();
  const active = (p: string) => path.startsWith(p);
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link
        href="/progress"
        className={`rounded-xl px-3 py-2 transition hover:bg-brand-soft ${active("/progress") ? "font-medium text-ink" : "text-muted"}`}
        aria-current={active("/progress") ? "page" : undefined}
      >
        My progress
      </Link>
      <Link href="/setup" className="btn-primary py-2">
        Practice
      </Link>
    </div>
  );
}
