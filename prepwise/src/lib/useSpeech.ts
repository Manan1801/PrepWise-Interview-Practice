"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;

export function useSpeechInput(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<Rec>(null);
  const wantRef = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec: Rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cb.current(r[0].transcript.trim());
        else inter += r[0].transcript;
      }
      setInterim(inter);
    };
    // Chrome stops after silence; restart while the user still wants to talk.
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) {
        try {
          rec.start();
        } catch {}
      } else setListening(false);
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setListening(false);
      }
    };
    recRef.current = rec;
    return () => {
      wantRef.current = false;
      try {
        rec.abort();
      } catch {}
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) return;
    window.speechSynthesis?.cancel();
    wantRef.current = true;
    try {
      recRef.current.start();
    } catch {}
    setListening(true);
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  return { supported, listening, interim, start, stop };
}

export type VoiceState = "idle" | "recording" | "transcribing";

function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

const MAX_RECORD_MS = 5 * 60_000;

/**
 * Voice answers. Records audio and transcribes it with Whisper (server, /api/transcribe) when you stop.
 * While recording, the browser's own speech recognition (if any) shows a live preview — and is the
 * fallback transcript if Whisper is unavailable. Browsers without MediaRecorder use the browser engine only.
 */
export function useVoiceAnswer(onText: (text: string) => void, getContext: () => string, onSpoken?: (seconds: number) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState("");
  const [canRecord, setCanRecord] = useState(false);
  const [engine, setEngine] = useState<"whisper" | "browser">("whisper");
  const live = useRef<string[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whisperOff = useRef(false);
  const cb = useRef(onText);
  cb.current = onText;
  const ctx = useRef(getContext);
  ctx.current = getContext;
  const modeRef = useRef<"whisper" | "browser">("whisper");
  // Time actually spent recording (for speaking pace) — not time spent thinking, typing or waiting for Whisper.
  const startedAt = useRef(0);
  const spokenCb = useRef(onSpoken);
  spokenCb.current = onSpoken;
  const reportSpoken = () => {
    if (!startedAt.current) return;
    spokenCb.current?.((Date.now() - startedAt.current) / 1000);
    startedAt.current = 0;
  };

  const sr = useSpeechInput((t) => {
    if (modeRef.current === "browser") cb.current(t);
    else live.current.push(t);
  });

  useEffect(() => {
    setCanRecord(!!navigator.mediaDevices?.getUserMedia && pickMime() !== null);
  }, []);

  const supported = canRecord || sr.supported;

  const start = useCallback(async () => {
    setError("");
    window.speechSynthesis?.cancel();
    live.current = [];
    const useWhisper = canRecord && !whisperOff.current;
    modeRef.current = useWhisper ? "whisper" : "browser";
    setEngine(modeRef.current);
    if (useWhisper) {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        setError("Microphone access was blocked. Allow it in the browser's address bar, or type your answer.");
        return;
      }
      const mime = pickMime() || undefined;
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearTimeout(timer.current);
        const fallback = live.current.join(" ").trim();
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        setState("transcribing");
        let text = "";
        try {
          const fd = new FormData();
          fd.append("audio", blob);
          fd.append("context", ctx.current());
          const r = await fetch("/api/transcribe", { method: "POST", body: fd, signal: AbortSignal.timeout(45_000) });
          if (r.status === 503) whisperOff.current = true; // no key configured — use the browser engine from now on
          if (r.ok) text = ((await r.json()) as { text?: string }).text ?? "";
        } catch {}
        if (!text && fallback) text = fallback;
        if (!text && blob.size > 4000) setError("Couldn't transcribe that recording. Please try again or type your answer.");
        if (text) cb.current(text);
        setState("idle");
      };
      recRef.current = rec;
      rec.start(1000);
      timer.current = setTimeout(() => {
        if (rec.state !== "recording") return;
        reportSpoken();
        rec.stop();
      }, MAX_RECORD_MS);
    }
    if (sr.supported) sr.start();
    else if (!useWhisper) return;
    startedAt.current = Date.now();
    setState("recording");
  }, [canRecord, sr]);

  const stop = useCallback(() => {
    reportSpoken();
    sr.stop();
    const rec = recRef.current;
    if (rec && rec.state === "recording") rec.stop();
    else setState("idle");
    recRef.current = null;
  }, [sr]);

  // Browser-only mode: recognition can end by itself (e.g. permission denied).
  useEffect(() => {
    if (state === "recording" && modeRef.current === "browser" && !sr.listening) {
      reportSpoken();
      setState("idle");
    }
  }, [state, sr.listening]);

  const preview =
    state !== "recording" ? "" : modeRef.current === "browser" ? sr.interim : [...live.current, sr.interim].filter(Boolean).join(" ");
  return { supported, state, preview, error, engine, start, stop };
}

export function speak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang === "en-IN") || voices.find((v) => v.lang.startsWith("en")) || null;
  u.rate = 1;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => typeof window !== "undefined" && window.speechSynthesis?.cancel();
