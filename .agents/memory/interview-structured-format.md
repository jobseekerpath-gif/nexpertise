---
name: Interview Ace — weighted scorecard coverage, 2-attempt rule & warm tone
description: Mock interviews are conducted and scored against a weighted NINE-competency BFSI assessment scorecard (every parameter assessed every interview — no length-gating), with a warm one-time opening (hobbies ×2, motivation-for-the-role, best-fit-role) before breadth-first question coverage, a warm-professional register, a 2-attempt rule, a flat 5s max mid-answer silence auto-submit, a 33s no-reply auto-conclude, an interviewer reply within 4s, and simple-English-by-default question wording that adapts up to the candidate's demonstrated English.
---

# Weighted nine-competency BFSI scorecard (NO length-gating) — the framework
Mock interviews follow a real BFSI hiring assessment scorecard: NINE weighted competencies, each rated 1–5 — Functional Knowledge 25% (the core), Communication Skills 15%, Problem-Solving & Analytical 12%, Adaptability & Learning Agility 10%, Ownership & Work Ethic 10%, Collaboration & Cultural Fit 10%, Personality & Disposition 8%, Educational Background 5%, IT Skills 5% (weights sum to 1.0). EVERY competency is scored in EVERY interview — `coveredCompetencies()` returns all nine regardless of duration (all `minMinutes: 0` in `lib/interview-format.ts`). Duration changes DEPTH (how many questions get asked), NOT which parameters are scored. Communication is judged from HOW every answer is delivered (no dedicated question stage); Personality & Disposition is likewise delivery-judged BUT also gets warm one-time opening beats (hobbies ×2, plus motivation-for-the-role and strengths/best-fit-role); Educational Background is covered by the opening question.
**Why:** the user pasted this exact BFSI rubric and explicitly demanded the interview "cover ALL the parameters" and give complete feedback accordingly. This REVERSES the earlier length-gating decision (which caused their complaint: a 10-min interview scored functional/domain only). There is no `depthProbe` competency anymore.

# Diversify across ALL competencies — breadth-first rotation; don't drill one topic; don't pivot randomly
Live questions follow a deterministic beat rotation (`areaForBeat(index, ctx)`): beat 0 = Introduction & Educational Background (opening prompt, not areaForBeat); beats 1–4 = a one-time warm "getting to know you" opening — 1 Hobbies & Interests ice-breaker, 2 a deeper hobbies follow-up, 3 Motivation for the Role (why this domain + this role, uses ctx.roleLabel), 4 Strengths & Best-Fit Role — all marked `kind:"warmup"`; beat 5+ = `questionRotation()[(index-5) % len]` interleaving Functional Knowledge (the recurring core — NEVER back-to-back, ~1 in 3) with Problem-Solving, Ownership, Adaptability, Collaboration and IT Skills. The warm-up beats are intentionally NOT in the recurring rotation (never asked twice). Exactly one beat advances per answered question; the cycle repeats until time runs out, so longer interviews reach more areas and probe deeper.
**Why:** reconciles the user's complaints — rejected random "pivot naturally" pivoting AND a "unidirectional chain about functional knowledge only." The resolution is STRUCTURED BREADTH: deterministic coverage across the whole scorecard, interleaved so consecutive questions differ and Functional never repeats adjacently (except the intentional 2-attempt retry, which re-probes the SAME area once).
**How to apply:** `areaForBeat` REQUIRES a ctx object `{ durationMin, experience, type, roleLabel }` (keep the call site passing full ctx even though durationMin/experience are no longer read inside it). Functional stays role-specific via `functionalKnowledgeFor(type, roleLabel)` (Banking/Insurance mirror the client sheet: Retail Assets & Liabilities / KYC / Underwriting; Risk & Insurance / retail products / channels / KYC). Do NOT collapse the rotation to "one stage at a time." Warm-up beats (1–4) carry `kind:"warmup"`; `submitCurrentAnswer` gives them a gentler "keep the conversation warm and flowing" directive instead of the "move to a DIFFERENT area" framing, so the hobbies follow-up isn't pushed away as a topic switch. Only `interview-ace.tsx` imports this module.

# 2-attempt rule (don't dwell on an unanswered question)
If a candidate can't answer (explicit "I don't know" / skip phrasing, or a very short answer), give ONE gentle retry on the SAME area (rephrase / hint / example), then move on to a NEW area — never ask the same question a third time.
**Why:** the user asked for exactly this; drilling an unanswerable question felt punishing.
**How to apply:** `retryRef` counts retries on the current beat; a weak answer with `retryRef < 1` re-asks the same beat, otherwise it advances and resets to 0. Commit `beatIdxRef`/`retryRef` ONLY after a valid question is produced (after the deliberate think-pause and the `endingRef`/`phaseRef` re-check) so an aborted/errored/ended turn never skips an area or mis-counts a retry. Reset both refs to 0 when a session starts.

# Warm-but-professional tone with light humour (tone evolved — softened)
The interviewer is warm, encouraging and human, and MAY use brief, tasteful humour to relax the candidate. Acknowledgements stay short (~6 words); no effusive flattery.
**Why:** the user asked to add light humour so candidates relax. This SOFTENS the earlier strict "formal, businesslike, no small talk, ≤4-word neutral ack" register — but the original bans still hold on exactly what the user hated: cheesy greetings ("Hey, good to see you here"), small-talk openers ("let's dive in"), and gushing praise. Warmth/humour ≠ chatty greeting.
**How to apply:** keep bans on markdown, *action* words, cheesy greetings and flattery; allow warmth + a light aside. Applies to the opening prompt, the per-turn prompt, and the coach system prompts.

# Candidate think time — flat 5 s max mid-answer silence (NOT adaptive)
Two distinct windows: (1) INITIAL think-before-first-word is UNLIMITED — the auto-submit timer is armed only inside the `startContinuous` phrase callback, so a silent candidate is never auto-submitted; (2) MID-ANSWER silence auto-submit is a flat `silenceMs = 5000` in the auto-listen effect: once the candidate starts talking, 5 s of continuous quiet ends the turn and submits. Submit button stays enabled as a manual override to submit sooner.
**Why:** the user explicitly set the max quiet-before-submit to 5 s. This REVERSED an earlier adaptive attempt (6 s normal / 9 s for reflective questions via a difficulty regex) — the user preferred one simple 5 s cap. Do not reintroduce per-question adaptivity unless they ask.
**How to apply:** change the single `silenceMs` constant; there is no longer a `needsLongThink`/difficulty heuristic. Keep the timer armed only in the phrase callback so initial thinking stays unlimited.

# No-reply auto-conclude — 33 s of total silence on a new question ends the interview
Distinct from the mid-answer 5 s auto-submit: if the candidate NEVER starts answering a freshly-asked question, a 33 s watchdog (`noReplyRef`, armed in the auto-listen effect right after `setIsRecording(true)`) concludes the interview and jumps to the report, so feedback is still generated from whatever was answered. It is cleared the instant any speech arrives (folded into `clearAutoSubmitTimer`, which the phrase callback calls on every chunk) and on every mic-stop / submit / end path. `concludeNoReply` mirrors the clock-runout path (endingRef/phaseRef guard, resetStream, speech.stop, short spoken sign-off, setPhase('report') after 2600 ms) and is invoked via `concludeNoReplyRef` so the timer needs no effect deps.
**Why:** the user asked to end + give feedback when a candidate doesn't reply to a new question for >33 s. Because the initial think-before-first-word is otherwise UNLIMITED, this watchdog is the ONLY thing that ends a fully-silent turn before the overall clock runs out.
**How to apply:** arm the 33 s timer AFTER `setIsRecording(true)` and clear any stale timer first (a watchdog-driven mic restart must not stack two). Do NOT fold it into `silenceMs` — they are different windows (pre-first-word vs mid-answer).

# Question English level — simplest by default, adapt UP to the candidate
Interviewer asks in simple, clear, everyday English by default (candidates are mostly from average English-medium colleges); it may use richer vocabulary / more complex questions ONLY when the candidate demonstrably speaks strong, fluent English, and simplifies further if they struggle. Instruction lives in FOUR places: opening prompt rules (+ `profile.englishLevel` as the initial hint), opening system prompt, per-turn STYLE bullet ("judge their English from answers so far"), and per-turn system prompt.
**Why:** the user said questions were too hard for average English speakers and wanted the level to rise adaptively with the candidate's shown ability.
**How to apply:** the AI self-assesses English from the transcript (no client-side proficiency metric); keep the instruction in all four prompt sites or the opening/first questions drift back to hard English.

# Interviewer (coach) response delay — strict within 4 s with deadline + fallback
Hard rule: interviewer MUST start speaking within 4 s of the candidate finishing. Pause must be at least 3 s. Effective range 3–4 s varies by answer length.

Implementation (all in `submitCurrentAnswer`, all declared BEFORE the stream call):
1. `naturalPauseMs` IIFE: short <15 words → 3.0–3.4 s; medium 15–50 → 3.2–3.7 s; long >50 → 3.4–3.9 s; hesitation +0–300 ms. Clamped [3000, 4000].
2. `FALLBACK_QUESTIONS` array declared here (used by timeout AND parsing fallback paths).
3. `minWaitPromise` (3000 ms, `Promise<void>`) kicked off IN PARALLEL with `stream()`.
4. `streamDeadlinePromise` (3800 ms, `Promise<string>`) — `Promise.race([stream(...), deadline])`; must stay < the 4000 ms cap so an injected fallback still speaks in time.
5. On timeout (`streamTimedOut=true`) OR empty/error: `resetStream()` + inject `"Ack: I see.\nNext: <fallback>"` so interview always continues.
6. After stream: `await minWaitPromise` (3 s floor), then guard `endingRef/phaseRef`, then wait `min(wallRemaining, targetRemaining)` using absolute wall-clock budget (4000 - elapsed) to prevent drift.
7. Guard `endingRef/phaseRef` after EACH await (minWait and remainder).

**Why:** sequential "stream then wait" broke the 3 s minimum on fast streams, exceeded the cap on slow streams, and dropped turns silently on errors. Parallel timer + hard deadline + fallback injection fixes all three. The cap was tightened from 5 s to 4 s at the user's request ("interviewer should reply in 4 seconds"); keep the three deadline/clamp/wall-clock numbers in lockstep (deadline < cap; naturalPauseMs & wallRemaining share the same cap).
**How to apply:** naturalPauseMs, FALLBACK_QUESTIONS, minWaitPromise, streamDeadlinePromise must ALL be declared BEFORE the try/stream block. Never move them after — the parallel guarantee breaks.

# Scope
The live AI interview lives ONLY in the web app (`artifacts/edubharat/src/pages/interview-ace.tsx`). Expo `interviews/*` screens only LIST past sessions — they do not generate questions, so interview-prompt changes there are N/A.
