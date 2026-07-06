---
name: English Guru live-chat recognition loop
description: One startContinuous call only — blockFor() resumes it; calling stop()+startContinuous in TTS onEnd breaks multi-turn conversation.
---

## Rule
The TTS `onEnd` callback must only call `speech.blockFor(N)` to lift the pause — NEVER `speech.stop()` + `speech.startContinuous()` inside `onEnd`. `startContinuous` is now idempotent (single-flight guard, see below), so re-kicking it is safe and the continuity watchdog does exactly that; but calling `stop()` in `onEnd` still kills the poll loop and triggers a stale `onend` race.

## Why
`speech.pause()` (called in `handleConvPhrase`) sets a 10-minute block. The single recognition loop started by `toggleLiveChat` then polls every 250ms waiting for the block to lift. `blockFor(300)` in the TTS `onEnd` overrides that 10-minute block with 300ms — the existing poll loop naturally resumes after 300ms.

If you call `speech.stop()` in `onEnd`, it kills the poll loop AND triggers a stale `recognition.onend` event. If you then call `startContinuous()`, it starts a NEW loop — but the stale `onend` fires and tries to spawn recognition too. Two competing loops race, one cancels the other, and the mic never properly restarts after the 2nd turn.

## How to apply
- `toggleLiveChat` → `speech.startContinuous(p => handleConvPhraseRef.current?.(p))` (via ref, not direct callback)
- `handleConvPhrase` TTS `onEnd` → `speechRef.current.blockFor(800); setConvFlowState("user-speaking");` ONLY
- "No AI response" fallback → `speechRef.current.blockFor(800); setConvFlowState("user-speaking");` ONLY
- tutor-switch greeting `onEnd` → `speechRef.current.blockFor(800);` ONLY
- **800ms NOT 300ms** — 300ms was too short; speaker reverb reaches the mic within 360ms (blockFor + wakeup delay), causing a spurious recognition result to lock aiBusyRef=true before the real user speech

## speechRef / speakRef pattern (English Guru)
`speech` (hook return object) and `speak` (depends on `synth.isSpeaking`) are recreated every render. Putting them in `handleConvPhrase` deps caused the callback to be re-created on every render, leaving a brief window where `handleConvPhraseRef.current` pointed to a stale version.

Fix: mirror both via refs (`speechRef`, `speakRef`) updated by `useEffect`, then remove `speech`/`speak` from `handleConvPhrase` deps. Always use `speechRef.current.*` and `speakRef.current(...)` inside the callback. `uiLang` stays in deps and is passed explicitly to `speakRef.current(text, uiLang, onEnd)` so language is always current.
- Never add `stop()` or `startContinuous()` inside TTS `onEnd` again
- The `speak` wrapper accepts 4th `opts: { rate? }` arg — pass `{ rate: 1.0–1.1 }` for live conversation to sound natural (1.2 felt clipped/abrupt)

## Single-flight recognizer guard (recognitionActiveRef + generation token + lease)

`use-speech-recognition.ts` has TWO spawn triggers — the 250ms poll loop AND `blockFor()`'s direct-wakeup timer (`wakeTimerRef`, cleared in `blockFor`/`stop`/`pause`; `spawnRecognitionRef` lets the timer call back into the live closure). Both cut post-TTS dead-mic time to ~360ms. Because there are two triggers, the guard is critical.

**The guard must cover the ENTIRE spawn→listen lifetime, not just start→onstart.** `recognitionActiveRef` is set true just before `recognition.start()` and stays true until `onend`/`onerror`/lease-break. An earlier version cleared it in `onstart`; once a recognizer was merely LISTENING the guard was down, so the other trigger spawned a SECOND overlapping recognizer. Two Web Speech recognizers abort each other and the mic silently dies. This fired on every `pause()`+`blockFor()` cycle → "AI stops responding after ~2 questions" AND "changing native language / teacher breaks the conversation" (both paths call pause()+blockFor()). One guard fix cured all three symptoms.

**Callbacks must be instance-scoped (generation token).** Each real spawn does `const myGen = ++recognitionGenRef.current` and every callback bails `if (myGen !== recognitionGenRef.current)`. Without this, a LATE `onend` from a recognizer that pause() already stopped can fire AFTER the replacement is live, clear the shared flag, and reschedule → a second overlapping recognizer. `pause()` deliberately does NOT bump the generation: in a normal turn its stop()→onend fires before the next spawn, and that (still-current) onend is what keeps the poll loop alive through the AI-speaking block.

**A lifetime-long guard needs a zombie breaker.** If `onstart` fires but `onend`/`onerror` never do (OS/tab suspension), the flag stays true forever and the loop is dead. Fix: heartbeat `recognitionActivityRef` (stamped on claim/onstart/onresult) + a lease check inside the guard — if active but idle > `RECOGNITION_LEASE_MS` (15s, must exceed the ~5-8s browser silence auto-end so healthy quiet recognizers aren't force-broken), bump the generation, stop the zombie, release the flag, and respawn. The breaker only runs when something RE-ENTERS the guard — which is exactly what the continuity watchdog's periodic `startContinuous()` provides.

**Adding new `useRef` calls to `useSpeechRecognition` causes transient HMR "more hooks" errors** in pages that use it (EnglishGuruContent, InterviewAceContent). They self-resolve on next full page load — HMR artifacts, not real bugs. (Renaming a ref or reusing existing refs does NOT trigger this.)

## Unmount cleanup is mandatory (cross-page recognizer leak)
`useSpeechRecognition` MUST stop the loop on unmount: `useEffect(() => stop, [stop])` (`stop` is a []-dep useCallback, stable). Without it, navigating away from English Guru or Interview Ace leaves the recognition loop alive in the background.

**Why:** a leaked loop keeps the mic and can make the page you just left emit a second AI reply (the "two AIs at once" bug spanning English Guru + Interview Ace), AND it competes with the destination page's fresh recognizer, throwing silent InvalidStateErrors that break multi-turn continuity ("teacher answers once then goes quiet"). This one missing cleanup was the root cause of TWO separately-reported bugs.

## Phrase-level echo guard (belt-and-suspenders, on top of blockFor)
The 800ms mic block after TTS is the PRIMARY echo defense; a secondary phrase-similarity guard in `handleConvPhrase` drops a captured phrase arriving within ~2.5s of the AI finishing that closely matches the AI's last spoken text. Track `lastAiSpeechRef` (text) + `lastAiSpeechEndRef` (ts): set text before speaking + in greeting; set ts in `releaseTurn` (live branch) + greeting onEnd.

**Why thresholds matter:** match only LONG fragments (substring needs phrase len ≥10) OR multi-word high overlap (≥4 words, ratio ≥0.85). Loose thresholds (substring len≥4, overlap≥0.8) wrongly drop legit short replies like "yes" / "okay tell me more". Echo-guard must NEVER swallow a real answer.

## Continuity watchdog (English Guru)
While `liveChat` is on, a 4s interval unconditionally re-kicks `speechRef.current.startContinuous(...)` whenever `liveChatRef.current && !aiBusyRef.current`. This is safe BECAUSE `startContinuous` is now idempotent (the single-flight guard above no-ops it when a recognizer is live) — and it is ALSO the periodic tick that drives zombie lease-recovery, so it is what fulfils "conversation continues until the user ends it." Do NOT re-add the old `isContinuous === false` gate: `isContinuous` returns `shouldContinueRef.current`, a stale render snapshot that stays true for the whole live session, so that gate made the watchdog effectively dead code (it never restarted anything).

## Re-entry guard (prevents AI cut off mid-sentence)
Any handler that triggers TTS through the **global-singleton** `speak()` (`use-edge-tts.ts`) must guard against re-entry for the WHOLE think+speak window, not just `isStreaming`. A late/echoed recognition `final` can fire the handler again during TTS playback; the new `speak()` runs `globalStop()` first and cuts the in-progress audio off abruptly.

- Use a module-scoped/ref busy flag (`aiBusyRef`): set true right after the input guard, reset false in the TTS `onEnd`, the no-response branch, AND a `try/catch` around the async body (so an unexpected throw never latches it).
- `synth.stop()` / `globalStop()` do NOT fire the per-call `onEnd`. So any manual stop path (e.g. `toggleLiveChat` OFF) must reset the busy flag itself, or the next session's first turn is silently blocked.

## isStreaming must NOT gate live-chat phrases
`handleConvPhrase` guard: `if (!phrase.trim() || (!liveChatRef.current && isStreaming) || aiBusyRef.current)`.

In **live chat** mode, only `aiBusyRef.current` is used (not `isStreaming`). Reason: `isStreaming` is React state captured in a `useCallback` closure; `handleConvPhraseRef.current` is updated via `useEffect` which fires AFTER render. If the micrestarts (via `blockFor` wakeup) and the next phrase arrives in the narrow window before that effect commits, the stale closure has `isStreaming=true` and silently drops the phrase. `aiBusyRef.current` is a ref — always current — and already covers the full think+speak window. In **typed** mode `isStreaming` is still correct (no `aiBusy` cycle).
