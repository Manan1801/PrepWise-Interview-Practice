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
