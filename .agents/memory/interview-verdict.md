---
name: Interview Ace recommendation band + Selected / Not Selected verdict
description: How the hiring recommendation and the Selected/Not Selected verdict are derived from the weighted scorecard and shown consistently across the report screen, transcript, and saved-report detail.
---

Interview Ace shows a weighted 1–5 score (primary), a hiring RECOMMENDATION band, and a Selected / Not Selected result — all derived, never AI-chosen.

**Recommendation bands (on the 1–5 Total Weighted Score):** Strong Hire 4.3–5.0 · Hire 3.5–4.2 · Hold 2.5–3.4 · No Hire <2.5 (`recommendationForWeighted` in `src/lib/interview-verdict.ts`). Surfaces that only have the stored 0–100 overall use `recommendationForScore(score) = recommendationForWeighted(score / 20)` — the SAME bands.

**Selected / Not Selected:** derived deterministically from `overallScore` via `interviewVerdict(score)`, pass bar `INTERVIEW_PASS_THRESHOLD = 70`. 70 = 3.5 × 20 = the Hire line, so "Selected" ⟺ recommendation ∈ {Hire, Strong Hire}. The AI supplies ONLY a 1–2 sentence rationale (`verdictReason`), never the label.

**Why:** an AI-chosen label/band can contradict the score the candidate sees ("72% but Not Selected"), which reads as a bug. Deriving both from the same weighted score guarantees consistency. Because a 1-decimal weighted score × 20 is always an integer, `overallScore / 20` reproduces the weighted score exactly — so `recommendationForWeighted(weighted)` (report screen) and `recommendationForScore(overallScore)` (Progress tab) can never disagree. NOTE the pass bar moved 60 → 70 when the scorecard was adopted; old reports re-map at render time because the verdict is computed, not stored.

**How to apply / where it appears (keep in lockstep):**
- Report screen: weighted score /5 + recommendation badge + Selected/Not Selected + reason (interview-ace.tsx report phase).
- Downloadable transcript "Result:" / recommendation line (downloadReport).
- Saved-report detail + latest-card on the Progress page (components/progress/interviews-tab.tsx) — uses `recommendationForScore(overallScore)` and `interviewVerdict(overallScore)`; guard on `overallScore !== null` for legacy rows.
- Recommendation colour classes are STATIC strings in `RECOMMENDATION_STYLES` (Tailwind JIT can't see dynamically built class names — never construct them).
- Every surface imports the shared helpers — never re-inline the band cutoffs or the `>= 70` check, or the surfaces will drift.
