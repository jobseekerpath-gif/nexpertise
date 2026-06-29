---
name: Learning Journey — SM-2 spaced repetition
description: How the /api/journey/* routes work and the priority contract for lesson ordering
---

## Routes
- `GET  /api/journey/next?userId=<id>` — next 5 interleaved lessons
- `POST /api/journey/submit-result`   — { lesson_id, score(0-100), userId }
- `GET  /api/journey/progress?userId=<id>` — full lesson state

## Priority contract (critical)
Due reviews ALWAYS come before new lessons in the queue — even if new lessons span more skill types.
Interleaving is applied WITHIN each group separately, then groups are concatenated:
  `[...interleaveBySkillType(due), ...interleaveBySkillType(newLessons)]`
Mixing them in one pool before interleaving breaks the priority.

**Why:** SM-2's value is in scheduling reviews at the forgetting curve — surfacing new material before
a due review defeats the algorithm.

## State
In-memory `Map<userId, Record<lessonId, LessonState>>`. Not persisted across server restarts.
Replace with DB table `(user_id, lesson_id)` for production.

## Frontend
- `artifacts/edubharat/src/pages/learning-journey.tsx`
- Guest userId stored in `localStorage("edubharat_guest_id")` so SM-2 state survives page reload
- Route: `/learning-journey` in App.tsx + "My Journey" in navbar

## Also added (from same Python reference file)
- `POST /api/jobs/search`  — personalized job scoring (skills 50pts, exp 20pts, location 15pts, sector 10pts, recency 5pts)
- `POST /api/news/feed`   — news scoring (sector interest 40pts + recency decay)
- Sector matching normalised to `.toLowerCase()` on both sides to prevent case mismatch
