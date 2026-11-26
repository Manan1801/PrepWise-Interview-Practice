"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LANGS } from "@/lib/code";
import type { CodeLang, RunResult } from "@/lib/types";

// Monaco (the editor inside VS Code) is loaded in the browser only.
const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading editor…</div>,
});

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(m.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

const STATUS: Record<RunResult["status"], { label: string; cls: string }> = {
  ok: { label: "Ran successfully", cls: "text-good" },
  compile_error: { label: "Compilation error", cls: "text-bad" },
  runtime_error: { label: "Runtime error", cls: "text-bad" },
  timeout: { label: "Time limit exceeded", cls: "text-warn" },
  unavailable: { label: "Runner unavailable", cls: "text-warn" },
};

export function CodeEditor({
  lang,
  source,
  onLang,
  onSource,
  onRun,
  run,
  running,
  disabled,
}: {
  lang: CodeLang;
  source: string;
  onLang: (l: CodeLang) => void;
  onSource: (s: string) => void;
  onRun: (stdin: string) => void;
  run?: RunResult;
  running: boolean;
  disabled?: boolean;
}) {
  const dark = useDark();
  const [stdin, setStdin] = useState("");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <span className="mr-1 text-sm font-semibold">
          <span className="text-brand">&lt;/&gt;</span> Code editor
        </span>
        <div className="flex rounded-xl border border-line p-0.5" role="radiogroup" aria-label="Language">
          {(Object.keys(LANGS) as CodeLang[]).map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={lang === l}
              onClick={() => onLang(l)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${lang === l ? "bg-brand text-white dark:text-black" : "text-muted hover:text-ink"}`}
            >
              {LANGS[l].label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-bg hover:text-ink"
            onClick={() => {
              if (confirm(`Reset the editor to the ${LANGS[lang].label} starter code? Your current code will be lost.`)) onSource(LANGS[lang].starter);
            }}
          >
            Reset
          </button>
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => onRun(stdin)} disabled={running || disabled || !source.trim()}>
            {running ? "Running…" : "▶ Run"}
          </button>
        </div>
      </div>

      <div className="h-[340px] sm:h-[380px]">
        <Monaco
          language={LANGS[lang].monaco}
          value={source}
          onChange={(v) => onSource(v ?? "")}
          theme={dark ? "vs-dark" : "light"}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12 },
            readOnly: disabled,
            wordWrap: "on",
          }}
        />
      </div>

      <div className="grid border-t border-line text-sm sm:grid-cols-2">
        <label className="block border-line p-3 sm:border-r">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Custom input (stdin)</span>
          <textarea
            className="input h-24 resize-y font-mono text-xs"
            placeholder="e.g. 5&#10;1 2 3 4 5"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="min-w-0 border-t border-line p-3 sm:border-t-0" aria-live="polite">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted">Output</span>
            {run && !running && (
              <span className={`font-medium ${STATUS[run.status].cls}`}>
                {STATUS[run.status].label}
                {run.ms != null && <span className="font-normal text-muted"> · {(run.ms / 1000).toFixed(1)}s</span>}
              </span>
            )}
          </div>
          <pre className="h-24 overflow-auto whitespace-pre-wrap rounded-xl bg-bg p-2.5 font-mono text-xs">
            {running ? "Compiling and running… (C++/Java can take ~5–15s)" : run ? run.output || "(no output)" : "Press ▶ Run to compile and run your code."}
          </pre>
        </div>
      </div>
    </div>
  );
}
