import type { DeliveryMetrics } from "./types";

const FILLERS = [
  "um",
  "uh",
  "umm",
  "uhh",
  "like",
  "you know",
  "basically",
  "actually",
  "literally",
  "kind of",
  "sort of",
  "i mean",
  "so yeah",
];

const HEDGES = [
  "i think",
  "i guess",
  "maybe",
  "probably",
  "not sure",
  "i'm not sure",
  "i feel like",
  "might be",
];

function countPhrase(text: string, phrase: string) {
  const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return (text.match(re) || []).length;
}

export function computeMetrics(text: string, seconds: number, usedVoice: boolean): DeliveryMetrics {
  const clean = text.toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean).length;
  const fillerList: Record<string, number> = {};
  let fillers = 0;
  for (const f of FILLERS) {
    const n = countPhrase(clean, f);
    if (n) {
      fillerList[f] = n;
      fillers += n;
    }
  }
  let hedges = 0;
  for (const h of HEDGES) hedges += countPhrase(clean, h);
  const secs = Math.max(1, Math.round(seconds));
  return {
    words,
    seconds: secs,
    wpm: Math.round((words / secs) * 60),
    fillers,
    fillerList,
    hedges,
    usedVoice,
  };
}

export function paceLabel(wpm: number, usedVoice: boolean) {
  if (!usedVoice) return "typed";
  if (wpm < 100) return "slow";
  if (wpm > 170) return "fast";
  return "good";
}
