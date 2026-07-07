---
name: Interview Ace — diversified competency coverage, 2-attempt rule & warm tone
description: Mock interviews must cover the whole competency framework via a diversified beat rotation (breadth, NOT single-topic chains, NOT random pivoting), with a warm-professional register, a 2-attempt rule, and ~5s candidate think time.
---

# Diversify across competencies — rotate; don't drill one topic; don't pivot randomly
Each question targets a DIFFERENT competency area than the previous one, via a deterministic "beat rotation" (`lib/interview-format.ts`: `areaForBeat` / `INTERVIEW_AREAS`): beat 0 = intro/education (once), then a rotation interleaving Functional/Domain (the core — recurs but NEVER back-to-back), Collaboration, IT & Digital skills, Adaptability, Integrity/Commitment, Education depth, Motivation. Exactly one beat advances per answered question.
**Why:** this reconciles two complaints made across sessions. First the user rejected "pivot naturally / vary your approach / don't follow a predictable pattern" (random pivoting) and asked interviews to "stick to a particular direction" → we built a fixed, ordered, single-stage agenda. But that agenda spent MANY consecutive questions inside one stage, so the user then complained it was "unidirectional — a chain of the same leading questions, then jumps to the next type." The resolution is STRUCTURED BREADTH: deterministic coverage of every area, interleaved so consecutive questions differ. This is NOT random pivoting (order is fixed, functional never repeats adjacently, all areas covered) and NOT single-topic drilling.
**How to apply:** functional topics stay role-specific via `functionalKnowledgeFor(type,label)` (Banking/Insurance mirror the client HR sheet exactly: Retail Assets & Liabilities / KYC / Underwriting; Risk & Insurance / retail products / channels / KYC). Do NOT collapse the rotation back to "one stage at a time", and do NOT tell the model to "stay WITHIN this stage / cover it thoroughly" — that recreates the chain the user disliked. The old `INTERVIEW_STAGES` / `stageIndexForProgress` still exist in the file but are UNUSED; the app now drives on beats.

# 2-attempt rule (don't dwell on an unanswered question)
If a candidate can't answer (explicit "I don't know" / skip phrasing, or a very short answer), give ONE gentle retry on the SAME area (rephrase / hint / example), then move on to a NEW area — never ask the same question a third time.
**Why:** the user asked for exactly this; drilling an unanswerable question felt punishing.
**How to apply:** `retryRef` counts retries on the current beat; a weak answer with `retryRef < 1` re-asks the same beat, otherwise it advances and resets to 0. Commit `beatIdxRef`/`retryRef` ONLY after a valid question is produced (after the deliberate think-pause and the `endingRef`/`phaseRef` re-check) so an aborted/errored/ended turn never skips an area or mis-counts a retry. Reset both refs to 0 when a session starts.

# Warm-but-professional tone with light humour (tone evolved — softened)
The interviewer is warm, encouraging and human, and MAY use brief, tasteful humour to relax the candidate. Acknowledgements stay short (~6 words); no effusive flattery.
**Why:** the user asked to add light humour so candidates relax. This SOFTENS the earlier strict "formal, businesslike, no small talk, ≤4-word neutral ack" register — but the original bans still hold on exactly what the user hated: cheesy greetings ("Hey, good to see you here"), small-talk openers ("let's dive in"), and gushing praise. Warmth/humour ≠ chatty greeting.
**How to apply:** keep bans on markdown, *action* words, cheesy greetings and flattery; allow warmth + a light aside. Applies to the opening prompt, the per-turn prompt, and the coach system prompts.

# Candidate think time
Auto-submit fires after ~5s of silence (was ~2.5s), giving 4–5s to think and answer in continuous speech with natural mid-sentence pauses without being cut off. The Submit button stays enabled during recording as a manual override.
**Why:** the user wanted room to construct answers while speaking continuously.

# Scope
The live AI interview lives ONLY in the web app (`artifacts/edubharat/src/pages/interview-ace.tsx`). Expo `interviews/*` screens only LIST past sessions — they do not generate questions, so interview-prompt changes there are N/A.
