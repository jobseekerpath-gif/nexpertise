---
name: Interview Ace timed end + in-flight stream race
description: How Interview Ace must end when the clock runs out, and why async turn handlers must re-check an "ended" ref after every await.
---

## Rule — end at time-up even while recording
Interview Ace must end when `elapsedSeconds >= duration*60` EVEN IF the mic is still recording. End path: set `endingRef=true`, abort the in-flight AI stream (`resetStream()`), clear timers, stop mic, disable auto-listen, capture any pending `answerRef.current` into the current unanswered question, speak a short sign-off via `speakCoach`, then `setPhase("report")` after ~2.6s.

**Why:** the old auto-end effect was gated on `!isRecording`, so if the candidate went silent near the end the session hung past its duration and NEVER produced feedback. "Generate complete feedback" is really fixed by ensuring the interview reliably ends — the report generator itself was already robust (fallbacks, per-question follow-up call, index-based mapping).

## Async turn handlers must re-check "ended" after every await
`submitCurrentAnswer` awaits `stream(...)`. After that await it MUST short-circuit if `endingRef.current || phaseRef.current !== "interview"`.

**Why:** without the guard, a slow stream that resolves AFTER the timeout (or after the user clicks End) still appends a new question, advances `currentIdx`, and calls `speakCoach` — so the coach asks another question and talks over the closing sign-off. `endingRef` (set by the timeout effect AND `endEarly`) + `phaseRef` (a ref mirror of `phase`, because the `phase` captured in the async closure is stale) are both refs so they read current inside the async body. Do NOT reset `coachSpeaking` in this early-return — the end sign-off owns that flag.

**How to apply:** reset `endingRef.current = false` in `startSession`; set it true in the timeout effect AND `endEarly`. Any future post-`await` state mutation inside an interview turn handler needs the same ended-guard.

## Non-reentrancy: a turn must finish before the next starts
`submitCurrentAnswer` includes a deliberate multi-second "thinking" pause before the coach speaks (so the interviewer doesn't reply the instant the candidate stops). That pause happens AFTER the stream resolves, so `isStreaming` is already false while the turn is still in flight — which re-opened a re-entrancy hole: the Submit button (disabled only on `isStreaming`) went live again and a manual submit could start an overlapping turn and double-advance the stage.

**Fix:** a synchronous `turnInFlightRef` set at the very TOP of `submitCurrentAnswer` (before any await/state update, so even a same-tick double-submit is blocked), released reactively via `useEffect([coachSpeaking])` when `coachSpeaking` goes false. `coachSpeaking` stays true for the WHOLE turn (through the thinking pause and while speaking) and only clears on TTS-end / error / safety paths, so tying release to it covers every exit with ONE line — no per-return reset. Also gate manual paths: `submitAnswer` short-circuits on the ref and the Submit button disables on `coachSpeaking || coachThinking || isStreaming`.

**Why:** the auto-listen submit path is already safe (it only fires when the mic yields a final result, which requires `coachSpeaking` false), so the only new vector was the manual button during the artificial pause.

## Pacing
Don't cut candidates off: auto-submit only after a LONG silence window (continuous speech keeps resetting the timer). Use most of the selected duration — sign off only in the last ~60s (`elapsedSeconds >= duration*60 - 60`), not minutes early.
