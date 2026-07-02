---
name: AI provider fallback (Claude primary → Gemini fallback)
description: Why Claude is the primary AI provider and Gemini only a fallback, and how routes must call AI.
---

# AI provider fallback (Claude primary → Gemini fallback)

Every AI feature route in `api-server` MUST go through the shared
`generateTextWithFallback` helper (streaming) or the shared chat helpers in
`routes/ai.ts` — never a hand-rolled single-provider loop.

**Order: Claude is PRIMARY, Gemini is the FALLBACK.** `/ai/stream` tries Claude
first and only falls back to Gemini if Claude produced nothing (a
`state:{wrote}` flag guards this); `generateTextWithFallback` is Claude-first too.

**Why:** There is no working `GEMINI_API_KEY` in this project. Every Gemini call
returns `429 RESOURCE_EXHAUSTED` (free-tier quota effectively 0) or `404 NOT_FOUND`
(`gemini-1.5-flash` is gone). When Gemini was tried first, every AI call wasted
~3-5s failing through dead models before falling back to Claude — the real cause
of the "AI not responding / stops mid-reply / robotic / empty stream" symptoms
across English Guru, Interview Ace, and the 30-day plan. Flipping to Claude-first
dropped `/ai/stream` from 5+s to ~1.7s and made responses reliable.
`ANTHROPIC_API_KEY` is present and healthy.

**Model chain:** keep `ANTHROPIC_MODEL_CHAIN` to REAL models only
(`claude-haiku-4-5`, `claude-sonnet-4-5`). Do NOT invent names like
"claude-sonnet-4-6" — a non-existent model 404s and burns a retry.

**How to apply:** `generateTextWithFallback({ prompt, system, maxTokens, onDelta, log })`
tries Claude, then Gemini, calling `onDelta` per fragment so SSE `content` events
still stream. If Gemini is ever given a real key and made primary again, that is a
deliberate reversal of this decision — update this note.

**Related parsing rule:** never set `responseMimeType: "application/json"` with
gemini-2.5-flash — it suppresses streamed text entirely. Isolate the JSON object
on both client and server before parsing: strip ``` fences, then slice from the
first `{` to the last `}` before `JSON.parse`.
