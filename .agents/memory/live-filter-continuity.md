---
name: Live AI conversation — mid-session setting changes
description: How to apply setting/filter changes (helper language, level, etc.) during a live AI voice conversation without breaking continuity.
---

# Rule
When the user changes a setting mid-conversation during a LIVE voice session (helper language, difficulty level, name, tutor…), let it take effect on the NEXT turn — never interrupt the turn that's in flight.

- Make the value a dependency of the turn handler so the handler (and the ref the recognition loop calls) is rebuilt with the new value; the next generated reply then uses it. That IS the "apply immediately" mechanism.
- Recognition language: the recognizer reads the current language on each fresh spawn, so the next spawn switches automatically. If you want the mic to switch during the user's turn, soft-restart it (stop the current instance so the loop respawns) — keep the loop's "should continue" flag true. Never restart the mic while the AI is speaking, or it captures the coach's own voice.

# Anti-pattern (the actual bug)
Do NOT force a setting to "apply now" by stopping TTS and aborting the in-flight AI stream from the filter handler.
**Why:** an aborted stream resolves to empty, so the reply is dropped and the user's message is left with no answer — the conversation visibly breaks. Cutting off speech mid-sentence is also jarring. Finishing the current turn and applying the change on the next one is smoother and correct.

# Watch for
- A value read inside the turn handler but absent from its deps = a silent "doesn't apply until some later re-render" bug.
- Filters that live only on a pre-session setup screen (e.g. Interview Ace) are frozen once the session starts, so they carry no mid-session continuity risk by design.
