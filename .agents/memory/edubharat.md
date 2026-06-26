---
name: EduBharat
description: India's AI Career Ecosystem — full stack platform with 3 products, auth, Gemini AI, voice, progress tracking.
---

## Stack
- Frontend: React + Vite + TypeScript + TailwindCSS (`artifacts/edubharat`)
- Backend: Express 5 (`artifacts/api-server`)
- DB: PostgreSQL + Drizzle ORM (`lib/db`) — tables: users, otps, learning_progress, interview_sessions
- AI: Gemini 2.5 Flash via `@google/genai` SDK (user provides own `GEMINI_API_KEY`)
- Auth: passport-google-oauth20 + custom Email OTP via Resend (`RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`)
- Voice: Web Speech API (input) + SpeechSynthesis (output, Indian-accented)

## Key decisions

**Indian voice TTS:** `use-speech-synthesis.ts` uses async `getVoices()` (voices load async in browsers). Prefers named Indian voices (Heera, Ravi, Neerja), then `en-IN` locale, then `en-GB` as fallback. Rate 0.88, pitch 1.05.

**Streaming:** Backend SSE endpoint `/api/ai/stream` — frontend `useGeminiStream` hook parses SSE via ReadableStream. Non-streaming fallback at `/api/ai/chat` for simple calls.

**Progress tracking:** `useProgress` hook + `edubharat_progress` localStorage key. Tracks sessions per tool, interview scores (0-100), daily activity for streak calculation.

**Avatar abstraction:** `src/components/avatar/` — CSS/SVG animated avatar now (`AnimatedAvatar`), interface ready for HeyGen/D-ID plug-in. Priya Ma'am (female, English Guru) + Raj Sir (male, Interview Ace).

**Google OAuth callback:** Uses `REPLIT_DOMAINS` env var to find `.replit.app` domain for callback URL. User must register this URL in Google Cloud Console for Google login to work.

**OTP dev mode:** If `RESEND_API_KEY` not set, OTP code is returned in the API response for dev testing. Never do this in prod.

## Products
1. **English Guru** — 7 modes: Grammar Fix, Write Better, Vocabulary, Pronunciation, Conversation, Daily Lesson, Interview English
2. **Interview Ace** — 12 types: HR, Software, Sales, Marketing, Customer Service, Banking, Insurance, Operations, Data Analytics, Finance, Freshers, Government
3. **Rozgar Samachar** — Personalized AI newspaper with 19 sections, profile-based generation

## Routes (frontend)
`/`, `/english-guru`, `/interview-ace`, `/rozgar-samachar`, `/history`, `/login`, `/progress`

## Why
- Gemini over Anthropic: user provided their own GEMINI_API_KEY; Gemini 2.5 Flash is cost-effective and fast.
- SSE streaming over polling: real-time text appearance is critical for voice sync with avatar.
- localStorage for progress: works without auth, no server round-trip needed.

## Gotchas

**Secret changes need a restart:** after adding or updating secrets in this repl, restart the backend workflow before testing them.

**Why:** the running server does not always pick up secret changes until it restarts, which can look like a bad key or missing env var.

**How to apply:** whenever a new secret is added or changed, restart the API workflow first, then verify the route again before debugging the app itself.
