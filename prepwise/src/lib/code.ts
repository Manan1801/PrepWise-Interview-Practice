import type { CodeLang, Turn } from "./types";

/** Languages offered in the in-interview code editor. `monaco` is the editor's language id. */
export const LANGS: Record<CodeLang, { label: string; monaco: string; starter: string }> = {
  cpp: {
    label: "C++",
    monaco: "cpp",
    starter: `#include <bits/stdc++.h>
using namespace std;

int main() {
    // Read input, solve, print output.

    return 0;
}
`,
  },
  java: {
    label: "Java",
    monaco: "java",
    starter: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Read input, solve, print output.

    }
}
`,
  },
  python: {
    label: "Python",
    monaco: "python",
    starter: `def solve():
    # Read input with input(), solve, print output.
    pass


if __name__ == "__main__":
    solve()
`,
  },
  javascript: {
    label: "JavaScript",
    monaco: "javascript",
    starter: `const input = require("fs").readFileSync(0, "utf8").trim().split("\\n");
// Solve and print with console.log().
`,
  },
};

export const isLang = (v: unknown): v is CodeLang => typeof v === "string" && v in LANGS;

export const MAX_CODE = 8000;

/** The candidate's answer as the agent sees it: explanation + attached code + last run result. */
export function answerText(t: Pick<Turn, "text" | "code">): string {
  if (!t.code) return t.text;
  const c = t.code;
  let s = `${t.text || "(no spoken/written explanation)"}\n[Code submitted in ${LANGS[c.lang]?.label ?? c.lang}]\n${c.source}\n[End of code]`;
  if (c.run) {
    s += `\n[Candidate ran it${c.run.stdin ? ` with input: ${c.run.stdin.slice(0, 200)}` : ""} → ${c.run.status}${c.run.output ? `: ${c.run.output.slice(0, 400)}` : ""}]`;
  }
  return s;
}
