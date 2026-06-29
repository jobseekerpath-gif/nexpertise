---
name: AI provider fallback (Gemini → Claude)
description: Why every AI feature route must fall back to Claude, not just chain Gemini models.
---

# AI provider fallback (Gemini → Claude)

Any feature route in `api-server` that calls Gemini MUST use the shared
`generateTextWithFallback` helper (in `routes/ai.ts`), not a hand-rolled Gemini
model loop.

**Why:** The project's `GEMINI_API_KEY` is on a free tier whose quota is
frequently exhausted — `gemini-2.5-flash` and `gemini-2.0-flash-lite` return
`429 RESOURCE_EXHAUSTED` (free-tier limit literally 0 at times) and
`gemini-1.5-flash` is gone (`404 NOT_FOUND`). A Gemini-only route then streams
*no text*, so the client's `JSON.parse` blows up with "Unexpected end of JSON
input" and the feature looks broken intermittently. The chat endpoints already
worked only because they fall back to Claude (`ANTHROPIC_API_KEY` is present).

**How to apply:** `generateTextWithFallback({ prompt, system, maxTokens, onDelta, log })`
tries the Gemini chain (skipping empty/errored models) then the Anthropic chain,
calling `onDelta` per fragment so SSE `content` events still stream. Returns the
full accumulated text. Resume analyse/improved routes use it.

**Related parsing rule:** never set `responseMimeType: "application/json"` with
gemini-2.5-flash — it suppresses streamed text entirely. Instead isolate the
JSON object on both client and server before parsing: strip ``` fences, then
slice from the first `{` to the last `}` before `JSON.parse`.
