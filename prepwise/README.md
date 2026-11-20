# PrepWise — Self-Directed AI-Assisted Interview Practice (IIT Gandhinagar)

CS 435 (HCI) group project. A high-fidelity prototype that lets students run realistic, structured,
personalised mock interviews on their own, with follow-up questions and actionable feedback.

## Problem → design response

| Gap in existing tools (from the problem statement) | What PrepWise does |
|---|---|
| Practice depends on mentors/peers who aren't always available | Fully self-serve, 24×7, runs in the browser |
| Tools just generate questions or judge answers | Interviewer asks **follow-ups on what you actually said** (max 2 per question), then moves on |
| Feedback is generic / focused on easy metrics (fillers, pace) | 5-dimension rubric (structure, depth, specificity, communication, delivery) with **answer-specific** strengths, fixes and a better-answer outline; delivery metrics are just one dimension |
| Not adaptable to different interview contexts | 6 tracks (SWE, ML/DS, Core engg, PM, Consulting, HR), role/company/level, resume + JD personalisation, interviewer style |
| Not self-directed | Student chooses focus skills, feedback timing (after each answer vs end-only), voice on/off, and can ask for **Hint / Clarify / Repeat / Skip** at any time |
| Interview anxiety | Supportive persona option, hideable live stats, calm UI, private (data stays in the browser) |

## Tech stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS v4** — UI and API routes, deployed on **Vercel**
- **Agentic interviewer** (`src/lib/agent/`): Planner → per-turn Assess → Decide (explicit policy) → Act loop, plus a Coach for the report; memory = plan + transcript + assessments + difficulty
- **Free LLM APIs** — a pool of **Groq** free models (gpt-oss-120b, llama-3.3-70b, gpt-oss-20b, llama-3.1-8b) rotated on rate limits, with **Google Gemini** Flash-Lite as backup; JSON validated with **Zod** (`src/lib/llm.ts`)
- **Web Speech API** — speech-to-text for answers (`en-IN`), text-to-speech for the interviewer (Chrome/Edge)
- **localStorage** — session history & progress, no database, no login
- **Offline fallback engine** — curated IITGN-relevant question bank + rule-based feedback, used when no API key is set or the AI call fails

## Run locally

```bash
npm install
npm run dev
```

Optional: copy `.env.example` to `.env.local` and add a free key to enable the AI interviewer.

## Free API keys

- Gemini: https://aistudio.google.com/apikey → `GEMINI_API_KEY`
- Groq: https://console.groq.com/keys → `GROQ_API_KEY`

Either one is enough; with both, Gemini is used when Groq fails or hits its free-tier limit.
Model pools can be changed with `GROQ_MODELS_SMART`, `GROQ_MODELS_FAST`, `GEMINI_MODELS` (comma-separated).

## Enable AI on Vercel

Project → Settings → Environment Variables → add the key(s) → redeploy.

## Structure

- `src/app/setup` — session configuration
- `src/app/interview/[id]` — live interview (voice/text, hints, follow-ups, live stats)
- `src/app/report/[id]` — feedback report
- `src/app/progress` — history and trends
- `src/lib/agent/agent.ts` — agent orchestrator (plan → assess → decide → act, per-step fallback)
- `src/lib/agent/policy.ts` — decision policy (probe / redirect / deepen / next / close, adaptive difficulty)
- `src/lib/agent/brain-llm.ts` — LLM planner, assessor, interviewer, coach
- `src/lib/agent/brain-offline.ts` — rule-based brain used when AI is unavailable
- `src/lib/llm.ts` — free model pool with rate-limit rotation
- `src/lib/api.ts` — client requests with timeout + automatic retry
- `src/lib/tracks.ts` — tracks, rubric, question bank
- `src/lib/metrics.ts` — filler words, hedges, WPM
