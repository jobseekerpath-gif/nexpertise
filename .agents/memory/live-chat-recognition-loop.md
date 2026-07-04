---
name: English Guru live-chat recognition loop
description: One startContinuous call only — blockFor() resumes it; calling stop()+startContinuous in TTS onEnd breaks multi-turn conversation.
---

## Rule
English Guru live conversation must have exactly ONE `startContinuous` call — in `toggleLiveChat` only. The TTS `onEnd` callback must only call `speech.blockFor(N)` to lift the pause. Never call `speech.stop()` + `speech.startContinuous()` inside `onEnd`.

## Why
`speech.pause()` (called in `handleConvPhrase`) sets a 10-minute block. The single recognition loop started by `toggleLiveChat` then polls every 250ms waiting for the block to lift. `blockFor(300)` in the TTS `onEnd` overrides that 10-minute block with 300ms — the existing poll loop naturally resumes after 300ms.

If you call `speech.stop()` in `onEnd`, it kills the poll loop AND triggers a stale `recognition.onend` event. If you then call `startContinuous()`, it starts a NEW loop — but the stale `onend` fires and tries to spawn recognition too. Two competing loops race, one cancels the other, and the mic never properly restarts after the 2nd turn.

## How to apply
- `toggleLiveChat` → `speech.startContinuous(p => handleConvPhraseRef.current?.(p))` (via ref, not direct callback)
- `handleConvPhrase` TTS `onEnd` → `speech.blockFor(300); setConvFlowState("user-speaking");` ONLY
- "No AI response" fallback → `speech.blockFor(150); setConvFlowState("user-speaking");` ONLY
- tutor-switch greeting `onEnd` → `speech.blockFor(300);` ONLY
- Never add `stop()` or `startContinuous()` inside TTS `onEnd` again
- The `speak` wrapper accepts 4th `opts: { rate? }` arg — pass `{ rate: 1.0–1.1 }` for live conversation to sound natural (1.2 felt clipped/abrupt)

## blockFor direct-wakeup (isSpawningRef + wakeTimerRef pattern)

`use-speech-recognition.ts` has a direct-wakeup system to cut post-TTS dead-mic time from ~1200ms to ~360ms:

- `wakeTimerRef` — stores the pending direct-wakeup timer so `blockFor()` can cancel a stale one before scheduling new. Also cleared in `stop()` and `pause()`.
- `isSpawningRef` — set true from the moment `spawnRecognition` calls `recognition.start()` until `onstart`, `onerror`, or `onend` fires. Acts as single-flight guard so the poll loop and a direct timer can't both spawn recognition instances in the same ~20ms window.
- `spawnRecognitionRef` — set inside `spawnRecognition` so `blockFor`'s direct timer can call back into the correct closure.

**Race condition**: without `isSpawningRef`, when `blockFor(300)` fires a direct timer at T+360ms, the poll loop also fires at T+500ms (because poll re-schedules every 250ms even after the direct timer fires), creating a double-spawn. `isSpawningRef` prevents the second call.

**Adding new `useRef` calls to `useSpeechRecognition` causes transient HMR "more hooks" errors** in all pages that use it (EnglishGuruContent, InterviewAceContent). They self-resolve on next full page load — they are HMR artifacts, not real bugs.

## Re-entry guard (prevents AI cut off mid-sentence)
Any handler that triggers TTS through the **global-singleton** `speak()` (`use-edge-tts.ts`) must guard against re-entry for the WHOLE think+speak window, not just `isStreaming`. A late/echoed recognition `final` can fire the handler again during TTS playback; the new `speak()` runs `globalStop()` first and cuts the in-progress audio off abruptly.

- Use a module-scoped/ref busy flag (`aiBusyRef`): set true right after the input guard, reset false in the TTS `onEnd`, the no-response branch, AND a `try/catch` around the async body (so an unexpected throw never latches it).
- `synth.stop()` / `globalStop()` do NOT fire the per-call `onEnd`. So any manual stop path (e.g. `toggleLiveChat` OFF) must reset the busy flag itself, or the next session's first turn is silently blocked.

## isStreaming must NOT gate live-chat phrases
`handleConvPhrase` guard: `if (!phrase.trim() || (!liveChatRef.current && isStreaming) || aiBusyRef.current)`.

In **live chat** mode, only `aiBusyRef.current` is used (not `isStreaming`). Reason: `isStreaming` is React state captured in a `useCallback` closure; `handleConvPhraseRef.current` is updated via `useEffect` which fires AFTER render. If the micrestarts (via `blockFor` wakeup) and the next phrase arrives in the narrow window before that effect commits, the stale closure has `isStreaming=true` and silently drops the phrase. `aiBusyRef.current` is a ref — always current — and already covers the full think+speak window. In **typed** mode `isStreaming` is still correct (no `aiBusy` cycle).
