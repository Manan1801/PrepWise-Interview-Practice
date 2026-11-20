"use client";
import type { InterviewSession, SessionConfig } from "./types";

// All practice data stays in the student's own browser (privacy by default).
const KEY = "prepwise.sessions.v1";

export function loadSessions(): InterviewSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as InterviewSession[]) : [];
  } catch {
    return [];
  }
}

export function getSession(id: string) {
  const s = loadSessions().find((s) => s.id === id);
  return s ? normalize(s) : undefined;
}

export function saveSession(s: InterviewSession) {
  try {
    const all = loadSessions().filter((x) => x.id !== s.id);
    all.unshift(s);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, 50)));
  } catch {
    /* storage unavailable — session still works in memory */
  }
}

export function deleteSession(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSessions().filter((s) => s.id !== id)));
  } catch {}
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function newSession(config: SessionConfig, mode: "ai" | "offline"): InterviewSession {
  return {
    id: uid(),
    createdAt: Date.now(),
    config: { ...config, seed: Math.floor(Math.random() * 1000) },
    turns: [],
    assessments: [],
    trace: [],
    currentQ: 0,
    difficulty: 2,
    status: "active",
    mode,
  };
}

// Sessions saved by older versions of the app lack agent fields.
export function normalize(s: InterviewSession): InterviewSession {
  return {
    ...s,
    assessments: s.assessments ?? [],
    trace: s.trace ?? [],
    difficulty: s.difficulty ?? 2,
    config: {
      ...s.config,
      interviewType: s.config.interviewType ?? "auto",
      level: ({ intern: "student", "new-grad": "fresher" } as Record<string, SessionConfig["level"]>)[s.config.level] ?? s.config.level,
    },
  };
}
