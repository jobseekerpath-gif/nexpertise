---
name: Learning Journey progression (no dead-end + mastery level)
description: How the SM-2 journey avoids an empty-queue dead-end and how CEFR level advances from study.
---

# Learning Journey progression

Two rules keep the Learning Journey from feeling "stuck at 100%":

1. **No dead-end queue.** SM-2 gives every studied lesson a future due date, so
   once all lessons are studied both the "due" and "new" buckets go empty and the
   queue dead-ends ("You're all caught up, come back tomorrow"). Instead,
   `/journey/next` returns a `mode:"ahead"` set (the lessons whose due date is
   soonest) plus `next_due_date`. The client shows a "practice ahead" banner and
   treats those lessons as reviews on submit (so studied-count / streak are not
   double-counted). Reviewing early just re-locks the memory — pedagogically fine.

2. **Mastery-based CEFR advancement.** The learner's stage is NOT only the level
   declared in their profile. Compute `effectiveStage = max(profile-declared
   stage, first-CEFR-level-not-fully-studied)`; finishing a level unlocks the
   next. Guard the mastery calc so empty progress falls back to A1 — otherwise you
   unlock everything for a split second before lesson data loads.

**Gotcha:** the Learning Journey locks levels in TWO separate places — the "All
Lessons" tile grid AND the "Roadmap" timeline — each with its own
isCurrent / isPast / isLocked logic. Both must use `effectiveStage` /
`effectiveStageIdx`, not the profile stage. It is easy to fix one and miss the
other (a code review caught exactly this).
