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
- The `speak` wrapper accepts 4th `opts: { rate? }` arg — pass `{ rate: 1.15 }` for live conversation to sound natural speed
