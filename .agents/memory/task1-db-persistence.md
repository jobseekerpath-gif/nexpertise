---
name: Task 1 — DB persistence & unified user profile
description: How DB schema, API routes, and frontend hooks are wired for server-side persistence.
---

## Schema layout (lib/db/src/schema/users.ts)
All profile fields live in the **single** `usersTable` (no separate profile table).
New fields added: `gender`, `degree`, `branch`, `graduationYear`, `university`, `skills` (JSON text), `preferredRole`, `preferredCity`, `expectedSalary`, `experienceLevel`, `englishLevel`, `voiceGender`, `voiceStyle`, `preferredInterviewer`, `preferredTutor`.

Existing tables extended:
- `learningProgressTable`: added `duration`, `tutorId`, `mode`
- `interviewSessionsTable`: added `interviewType`, `durationSeconds`, `feedbackJson`, `communicationScore`, `grammarScore`, `confidenceScore`, `technicalScore`

New tables: `savedJobsTable`, `historyItemsTable`.

## API routes pattern
All protected routes use `requireAuth` from `profile.ts` (shared middleware).
- `GET/PUT /api/profile` — full user profile with skills parsed from JSON
- `GET /api/profile/stats` — aggregated counts + streak
- `POST/GET /api/sessions/learning` — English Guru sessions
- `POST/GET /api/sessions/interview` — Interview Ace sessions
- `POST/DELETE/GET /api/jobs/save[/:jobId]` — saved jobs
- `POST/DELETE/GET /api/history/items[/:id]` — history items

**Why:** requireAuth is in profile.ts and re-exported; other route files import it from there.

## Frontend hooks pattern
All three hooks (`use-student-profile`, `use-progress`, `use-history`) + new `use-saved-jobs`:
- `localStorage` is the immediate write/read target (works logged out)
- On login: fetch from server once, merge into local state, set `syncedRef` to avoid re-fetching
- On logout: reset `syncedRef` so next login re-fetches
- On update: update local state first, then POST to server (throw on failure so UI can surface errors)

**Why:** Offline-first UX; no loading spinners on initial render.

## Profile pre-population in modules
- **English Guru**: `tutorId` initialised from `profile.preferredTutor` (falls back to voiceStyle match). `level` mapped from `profile.englishLevel` via `mapEnglishLevel()` helper.
- **Interview Ace**: `experience` mapped from `profile.experienceLevel`; `type` guessed from `profile.preferredRole`.
- **Rozgar Samachar**: local Profile state synced from studentProfile on login via `useEffect` watching individual profile fields.

## Declaration rebuild procedure
When schema changes, must rebuild lib/db declarations so api-server TypeScript picks them up:
```
cd lib/db && npx tsc   # regenerates dist/schema/users.d.ts
rm -f artifacts/api-server/.tsbuildinfo   # force fresh api-server check
```
**Why:** api-server tsconfig references lib/db as a project reference (composite: true); stale dist/ means stale types.

## Security fix
`DELETE /api/history/items/:id` must scope to `and(eq(id), eq(userId))` or an authenticated user can delete any item (IDOR).
