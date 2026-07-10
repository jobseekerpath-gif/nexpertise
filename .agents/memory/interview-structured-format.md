---
name: Interview Ace — weighted scorecard coverage, 2-attempt rule & warm tone
description: Mock interviews are conducted and scored against a weighted NINE-competency BFSI assessment scorecard (every parameter assessed every interview — no length-gating), with breadth-first question coverage, a warm-professional register, a 2-attempt rule, and ~5s candidate think time.
---

# Weighted nine-competency BFSI scorecard (NO length-gating) — the framework
Mock interviews follow a real BFSI hiring assessment scorecard: NINE weighted competencies, each rated 1–5 — Functional Knowledge 25% (the core), Communication Skills 15%, Problem-Solving & Analytical 12%, Adaptability & Learning Agility 10%, Ownership & Work Ethic 10%, Collaboration & Cultural Fit 10%, Personality & Disposition 8%, Educational Background 5%, IT Skills 5% (weights sum to 1.0). EVERY competency is scored in EVERY interview — `coveredCompetencies()` returns all nine regardless of duration (all `minMinutes: 0` in `lib/interview-format.ts`). Duration changes DEPTH (how many questions get asked), NOT which parameters are scored. Communication AND Personality are judged from HOW every answer is delivered (no dedicated question stage); Educational Background is covered by the opening question.
**Why:** the user pasted this exact BFSI rubric and explicitly demanded the interview "cover ALL the parameters" and give complete feedback accordingly. This REVERSES the earlier length-gating decision (which caused their complaint: a 10-min interview scored functional/domain only). There is no `depthProbe` competency anymore.

# Diversify across ALL competencies — breadth-first rotation; don't drill one topic; don't pivot randomly
Live questions target the assessable competencies EXCEPT Communication & Personality (delivery-judged) and Educational Background (the opening), via a deterministic beat rotation (`areaForBeat(index, ctx)`): beat 0 = Introduction & Educational Background (once), then `questionRotation()` interleaves Functional Knowledge (the recurring core — NEVER back-to-back, ~1 in 3) with Problem-Solving, Ownership, Adaptability, Collaboration and IT Skills. Exactly one beat advances per answered question; the cycle repeats until time runs out, so longer interviews reach more areas and probe deeper.
**Why:** reconciles the user's complaints — rejected random "pivot naturally" pivoting AND a "unidirectional chain about functional knowledge only." The resolution is STRUCTURED BREADTH: deterministic coverage across the whole scorecard, interleaved so consecutive questions differ and Functional never repeats adjacently (except the intentional 2-attempt retry, which re-probes the SAME area once).
**How to apply:** `areaForBeat` REQUIRES a ctx object `{ durationMin, experience, type, roleLabel }` (keep the call site passing full ctx even though durationMin/experience are no longer read inside it). Functional stays role-specific via `functionalKnowledgeFor(type, roleLabel)` (Banking/Insurance mirror the client sheet: Retail Assets & Liabilities / KYC / Underwriting; Risk & Insurance / retail products / channels / KYC). Do NOT collapse the rotation to "one stage at a time." Only `interview-ace.tsx` imports this module.

# 2-attempt rule (don't dwell on an unanswered question)
If a candidate can't answer (explicit "I don't know" / skip phrasing, or a very short answer), give ONE gentle retry on the SAME area (rephrase / hint / example), then move on to a NEW area — never ask the same question a third time.
**Why:** the user asked for exactly this; drilling an unanswerable question felt punishing.
**How to apply:** `retryRef` counts retries on the current beat; a weak answer with `retryRef < 1` re-asks the same beat, otherwise it advances and resets to 0. Commit `beatIdxRef`/`retryRef` ONLY after a valid question is produced (after the deliberate think-pause and the `endingRef`/`phaseRef` re-check) so an aborted/errored/ended turn never skips an area or mis-counts a retry. Reset both refs to 0 when a session starts.

# Warm-but-professional tone with light humour (tone evolved — softened)
The interviewer is warm, encouraging and human, and MAY use brief, tasteful humour to relax the candidate. Acknowledgements stay short (~6 words); no effusive flattery.
**Why:** the user asked to add light humour so candidates relax. This SOFTENS the earlier strict "formal, businesslike, no small talk, ≤4-word neutral ack" register — but the original bans still hold on exactly what the user hated: cheesy greetings ("Hey, good to see you here"), small-talk openers ("let's dive in"), and gushing praise. Warmth/humour ≠ chatty greeting.
**How to apply:** keep bans on markdown, *action* words, cheesy greetings and flattery; allow warmth + a light aside. Applies to the opening prompt, the per-turn prompt, and the coach system prompts.

# Candidate think time
Auto-submit fires after ~5s of silence, giving room to think in continuous speech without being cut off. The Submit button stays enabled as a manual override.
**Why:** the user wanted room to construct answers while speaking continuously.

# Interviewer (coach) response delay — strict 3–5 s with deadline + fallback
Hard rule: interviewer MUST start speaking within 5 s of the candidate finishing. Pause must be at least 3 s. Effective range 3–5 s varies by answer length.

Implementation (all in `submitCurrentAnswer`, all declared BEFORE the stream call):
1. `naturalPauseMs` IIFE: short <15 words → 3.0–3.8 s; medium 15–50 → 3.5–4.5 s; long >50 → 4.0–5.0 s; hesitation +0–400 ms. Clamped [3000, 5000].
2. `FALLBACK_QUESTIONS` array declared here (used by timeout AND parsing fallback paths).
3. `minWaitPromise` (3000 ms, `Promise<void>`) kicked off IN PARALLEL with `stream()`.
4. `streamDeadlinePromise` (4500 ms, `Promise<string>`) — `Promise.race([stream(...), deadline])`.
5. On timeout (`streamTimedOut=true`) OR empty/error: `resetStream()` + inject `"Ack: I see.\nNext: <fallback>"` so interview always continues.
6. After stream: `await minWaitPromise` (3 s floor), then guard `endingRef/phaseRef`, then wait `min(wallRemaining, targetRemaining)` using absolute wall-clock budget (5000 - elapsed) to prevent drift.
7. Guard `endingRef/phaseRef` after EACH await (minWait and remainder).

**Why:** sequential "stream then wait" broke the 3 s minimum on fast streams, exceeded 5 s on slow streams, and dropped turns silently on errors. Parallel timer + hard deadline + fallback injection fixes all three. User demanded "strictly within 5 seconds."
**How to apply:** naturalPauseMs, FALLBACK_QUESTIONS, minWaitPromise, streamDeadlinePromise must ALL be declared BEFORE the try/stream block. Never move them after — the parallel guarantee breaks.

# Scope
The live AI interview lives ONLY in the web app (`artifacts/edubharat/src/pages/interview-ace.tsx`). Expo `interviews/*` screens only LIST past sessions — they do not generate questions, so interview-prompt changes there are N/A.
