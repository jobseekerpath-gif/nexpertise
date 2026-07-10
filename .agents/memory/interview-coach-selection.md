---
name: Interview Ace interviewer auto-selection
description: How the mock-interview interviewer (coach) is chosen from the candidate's filters, and the B2B lock rule.
---

# Interview Ace — interviewer (coach) auto-selection

The interviewer shown on the Interview Ace setup screen is **auto-matched to the
interview TYPE** the candidate picks, via `recommendedCoachFor(type)` in
`lib/tutors.ts` (a type→coach-id map over `INTERVIEW_COACHES`, fallback `"raj"`).
The manual "Your Interviewer" grid is an override, and the auto-matched card gets
a "Recommended" badge.

## Decisions
- **Type-driven, not experience-driven.** The coach is picked from the interview
  type only. Experience level already drives question difficulty/calibration and
  the scorecard; duration never affects the coach. **Why:** each coach is a domain
  specialist (HR, technical, sales/marketing, BFSI, freshers), so type is the
  signal that maps to "who should run this". Keep it predictable.
- **Re-match happens in the type dropdown's `onValueChange`** (calls
  `setCoach(recommendedCoachFor(v))`), NOT a `useEffect`. A manual grid pick then
  persists until the candidate changes the type again. **Why:** avoids an effect
  that fights the manual override / double-fires on mount.

## B2B lock — enforce at EVERY mutation point
A recruiter invite carries `b2bCoach` (query param); when present the interviewer
is **locked** to the recruiter's choice (`coachLocked = !!b2bParams.coach`). The
candidate must not be able to swap it.

**Lesson:** a "locked" flag must be checked at *every* place that writes the state
— here that is BOTH the interview-type dropdown handler AND the manual coach grid
buttons. The first implementation guarded only the dropdown, so a candidate could
still click a different interviewer in the grid and override the recruiter. When
locked: grid `onClick` is a no-op, non-selected cards are `disabled` + dimmed
(`opacity-40 cursor-not-allowed`), and the hint reads "Set by the recruiter for
this invite". The recommended-for-type badge still shows (informational) but the
card stays locked.

## Note
`profile.preferredInterviewer` (DB `preferred_interviewer`, default `"raj"`, no
user-facing setter) is no longer read for the default coach — the default is now
filter-driven. No schema change was made.
