import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "PrepWise — AI Interview Practice",
  description: "Self-directed, AI-assisted mock interviews with realistic follow-ups and actionable feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <header className="border-b border-line bg-card/80 backdrop-blur sticky top-0 z-20">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm text-white dark:text-black">P</span>
              PrepWise <span className="hidden text-xs font-normal text-muted sm:inline">· IIT Gandhinagar</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link href="/progress" className="rounded-lg px-3 py-2 hover:bg-brand-soft">My progress</Link>
              <Link href="/setup" className="btn-primary py-2">Practice</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted">
          Your practice sessions are stored only in this browser. Built for CS 435 (HCI), IIT Gandhinagar — free for everyone.
        </footer>
      </body>
    </html>
  );
}
