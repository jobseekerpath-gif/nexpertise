---
name: TTS autoplay unlock
description: How to reliably unlock Chrome autoplay for async TTS audio on freshly-visited deployed origins.
---

## The rule
`unlockAudio()` uses two parallel strategies and must be called synchronously from the click handler that starts live chat or an interview.

**Layer 1 — AudioContext:** Resume (or create-and-resume) an AudioContext. Chrome's sticky-activation propagates to all HTMLAudioElement plays on the same origin once the context is running. Reuse `_audioCtx`; do NOT recreate on every call — suspended contexts accumulate.

**Layer 2 — Pre-blessed element:** Create a silent HTMLAudioElement and call `play()` in the gesture. Store the element as `_unlockedEl`. In `speak()`, reuse `_unlockedEl` (set new `src`, call `play()`) — Chrome's element-level blessing survives `src` changes. After reuse, set `_unlockedEl = null` so the next `speak()` gets a fresh element.

**Why:** On deployed/freshly-visited Replit origins, Chrome's Media Engagement Index (MEI) is low. A single `new Audio().play()` after an async delay (TTS fetch) gets `NotAllowedError` even after a user click. The two-layer approach covers both the origin-level (AudioContext) and element-level (blessed element) restrictions.

**Blob size guard:** After TTS fetch, check `blob.size < 512`. If the Edge TTS WebSocket drops mid-stream after headers are sent, the server pipes an empty body with status 200. An `<512-byte` blob is always corrupt; skip `audio.play()` and fire `onEnd()` to keep the conversation moving.

## How to apply
- In english-guru.tsx `toggleLiveChat`: call `unlockAudio()` as the very FIRST synchronous statement.
- In interview-ace.tsx `startSession`: same.
- Any new feature using TTS: same pattern.
- Do NOT create `_audioCtx` or `_unlockedEl` outside of `unlockAudio()`. They are module-level singletons in `use-edge-tts.ts`.

## Race condition note
`_unlockedEl` is populated in `a.play().then(...)` which is async. If `speak()` is called within milliseconds of the gesture (before `.then()` resolves), it falls back to `new Audio()`. In practice, TTS has 1-4s of AI + fetch latency, so this race is low probability in real use, but not zero.
