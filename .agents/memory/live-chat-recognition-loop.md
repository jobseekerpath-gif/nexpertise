---
name: English Guru live-chat recognition loop
description: One startContinuous call only — blockFor() resumes it; calling stop()+startContinuous in TTS onEnd breaks multi-turn conversation.
---

## Rule
English Guru live conversation must have exactly ONE `startContinuous` call — in `toggleLiveChat` only. The TTS `onEnd` callback must only call `speech.blockFor(N)` to lift the pause. Never call `speech.stop()` + `speech.startContinuous()` inside `onEnd`.

## Why
`speech.pause()` (called in `handleConvPhrase`) sets a 10-minute block. The single recognition loop started by `toggleLiveChat` then polls every 250ms waiting for the block to lift. `blockFor(1200)` in the TTS `onEnd` overrides that 10-minute block with 1200ms — the existing poll loop naturally resumes after 1200ms.

If you call `speech.stop()` in `onEnd`, it kills the poll loop AND triggers a stale `recognition.onend` event. If you then call `startContinuous()`, it starts a NEW loop — but the stale `onend` fires and tries to spawn recognition too. Two competing loops race, one cancels the other, and the mic never properly restarts after the 2nd turn.

## How to apply
- `toggleLiveChat` → `speech.startContinuous(p => handleConvPhraseRef.current?.(p))` (via ref, not direct callback)
- `handleConvPhrase` TTS `onEnd` → `speech.blockFor(1200); setConvFlowState("user-speaking");` ONLY
- "No AI response" fallback → same: `speech.blockFor(400); setConvFlowState("user-speaking");` ONLY
- Never add `stop()` or `startContinuous()` inside TTS `onEnd` again
- The `speak` wrapper accepts 4th `opts: { rate? }` arg — pass `{ rate: 1.0–1.1 }` for live conversation to sound natural (1.2 felt clipped/abrupt)

## Re-entry guard (prevents AI cut off mid-sentence)
Any handler that triggers TTS through the **global-singleton** `speak()` (`use-edge-tts.ts`) must guard against re-entry for the WHOLE think+speak window, not just `isStreaming`. A late/echoed recognition `final` can fire the handler again during TTS playback; the new `speak()` runs `globalStop()` first and cuts the in-progress audio off abruptly.

- Use a module-scoped/ref busy flag (`aiBusyRef`): set true right after the input guard, reset false in the TTS `onEnd`, the no-response branch, AND a `try/catch` around the async body (so an unexpected throw never latches it).
- `synth.stop()` / `globalStop()` do NOT fire the per-call `onEnd`. So any manual stop path (e.g. `toggleLiveChat` OFF) must reset the busy flag itself, or the next session's first turn is silently blocked.
