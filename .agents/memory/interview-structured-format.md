---
name: Interview Ace — structured agenda & professional tone
description: Mock interviews must follow a fixed competency-assessment agenda and speak in a formal, non-chatty register.
---

# Fixed agenda (do not revert to free-form)
Mock interviews follow a FIXED, ordered set of assessment stages (see `lib/interview-format.ts`): Introduction & Educational Background → Functional/Domain Knowledge (largest slice) → Collaboration → IT & Digital Skills → Adaptability → Motivation/Commitment & Closing.
**Why:** modelled on a client HR competency-assessment sheet; the user explicitly asked interviews to "stick to a particular direction". An earlier version told the model to "pivot naturally / vary your approach / don't follow a predictable pattern" — that is the opposite of the requirement. Do NOT reintroduce random pivoting.
**How to apply:** functional-knowledge topics are role-specific via `functionalKnowledgeFor(type,label)`; Banking and Insurance mirror the sheet exactly (Retail Assets & Liabilities / KYC / Underwriting; Risk & Insurance concept / retail products / channels / KYC). Other roles get domain-appropriate topics; unmapped types fall back to a generic role-relevant prompt.

# Ordered, no-skip stage progression
The current stage advances IN ORDER, at most one stage per question, and never backward — tracked in a ref, not derived purely from time.
**Why:** pure elapsed-time staging lets a long candidate answer make the clock jump several stages, silently skipping one (e.g. Collaboration). Time still drives the pace, but the +1-per-question cap guarantees coverage.
**How to apply:** progress is scaled against the *questioning window* `(duration-2)*60`, not full duration, because the interview signs off when `remainingMin <= 2` — scaling this way makes the closing stage actually reachable for 10/15/25-min interviews. Reset the stage ref to 0 when a session starts; commit the advance only once a valid question is produced (so an errored/aborted turn doesn't skip a stage).

# Professional tone (no "chatting")
Both the opening and per-answer prompts, plus the coach system prompts and the spoken sign-off lines, forbid casual/chatty language: no "Hey", "good to see you", "chatting", "let's dive in", "so tell me", small talk, or effusive praise. Acknowledgements are ≤4 neutral words. Fallback ack/question strings must also stay professional.
**Why:** the user explicitly asked to remove chatty greetings like "Hey, good to see you here! I'm Priya, and I'll be chatting with you today…".

# Scope
The live AI interview lives ONLY in the web app (`artifacts/edubharat/src/pages/interview-ace.tsx`). The Expo mobile `interviews/*` screens only LIST past sessions — they do not generate questions, so interview-prompt changes there are N/A.
