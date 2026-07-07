---
name: Interview Ace Selected / Not Selected verdict
description: How the hiring verdict is derived and shown across the report screen, transcript, and saved-report detail.
---

Interview Ace shows a "Selected" / "Not Selected" result on the interview report.

**Rule:** the label is derived DETERMINISTICALLY from `overallScore` via `interviewVerdict(score)` in `src/lib/interview-verdict.ts` (pass bar `INTERVIEW_PASS_THRESHOLD = 60`). The AI does NOT choose the label — it only supplies a 1-2 sentence rationale (`verdictReason`, parsed from the report JSON with a `recommendation` key fallback).

**Why:** an AI-chosen label can contradict the score the candidate sees ("72% but Not Selected"), which reads as a bug. Deriving the label from the same score guarantees consistency. 60 aligns with grade()'s "Average" band and the common Indian first-class / pass mark.

**How to apply / where it appears (keep in lockstep):**
- Report screen badge + reason (interview-ace.tsx report phase).
- Downloadable transcript "Result:" line (downloadReport).
- Saved-report detail on the Progress page (components/progress/interviews-tab.tsx) — reads `verdictReason` out of `feedbackJson`.
- `verdictReason` persists automatically because `saveSession` stores the whole report object as `feedbackJson` (no DB schema change).
- Both surfaces import the shared helper — never re-inline the `>= 60` check, or the report screen and progress detail will drift.
