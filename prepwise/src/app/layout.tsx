import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { IitgnEmblem, IitgnLockup } from "@/components/IitgnMark";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PrepWise — AI Interview Practice | IIT Gandhinagar",
  description:
    "Self-directed, AI-assisted mock interviews for any role, with realistic follow-ups and actionable feedback. Made for IIT Gandhinagar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} flex min-h-screen flex-col bg-bg font-sans text-ink antialiased`}>
        <header className="sticky top-0 z-30 border-b border-line bg-card/80 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="flex items-center gap-2.5" aria-label="PrepWise home">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-base font-bold text-white shadow-sm dark:text-black">
                  P
                </span>
                <span className="text-lg font-semibold tracking-tight">PrepWise</span>
              </Link>
              <span className="hidden h-7 w-px bg-line md:block" aria-hidden />
              <a href="https://iitgn.ac.in" target="_blank" rel="noreferrer" className="hidden md:block" title="IIT Gandhinagar">
                <IitgnLockup size={22} />
              </a>
            </div>
            <NavLinks />
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:py-10">{children}</main>

        <footer className="border-t border-line bg-card">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="flex items-start gap-3">
              <IitgnEmblem size={34} />
              <div className="self-center font-semibold">Made for IIT Gandhinagar</div>
            </div>
            <div>
              <div className="mb-2 font-semibold">PrepWise</div>
              <ul className="space-y-1.5 text-muted">
                <li><Link href="/setup" className="hover:text-ink">Start practising</Link></li>
                <li><Link href="/progress" className="hover:text-ink">My progress</Link></li>
              </ul>
            </div>
            <p className="text-muted">
              Free for everyone. Your practice sessions stay in your own browser.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
