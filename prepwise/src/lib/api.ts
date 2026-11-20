"use client";
// Network helper with timeout + automatic retries. Mobile/campus Wi-Fi and Safari can drop a
// request ("Load failed"); the agent is stateless, so re-sending the same request is safe.
import type { AgentInput, AgentResponse, AgentState, InterviewSession, SessionReport } from "./types";

async function postJSON<T>(url: string, body: unknown, { timeoutMs = 45_000, attempts = 3, onRetry }: { timeoutMs?: number; attempts?: number; onRetry?: (n: number) => void } = {}): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      onRetry?.(i);
      await new Promise((r) => setTimeout(r, 800 * 2 ** (i - 1)));
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      if (res.ok) return (await res.json()) as T;
      const msg = (await res.json().catch(() => null))?.error ?? `Server error (${res.status})`;
      lastErr = new Error(msg);
      if (res.status < 500 && res.status !== 429) break; // don't retry bad requests
    } catch (e) {
      lastErr = e instanceof DOMException && e.name === "AbortError" ? new Error("The server took too long to respond.") : new Error("Network problem — check your connection.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

export const agentCall = (input: AgentInput, state: AgentState, onRetry?: (n: number) => void) =>
  postJSON<AgentResponse>("/api/agent", { input, state: { config: state.config, plan: state.plan, turns: state.turns, assessments: state.assessments, currentQ: state.currentQ, difficulty: state.difficulty } }, { onRetry });

export const reportCall = (s: InterviewSession) => postJSON<SessionReport>("/api/report", s, { timeoutMs: 60_000, attempts: 2 });
