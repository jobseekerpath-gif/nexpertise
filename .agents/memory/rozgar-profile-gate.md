---
name: Rozgar profile gate
description: Gate requires both name AND location; gate data must persist to useStudentProfile store.
---

The Rozgar page shows a profile setup gate to first-time users before revealing the job feed.

**Gate condition:** `!gateComplete && !profile.name && !profile.location` — both fields must be missing. If either is set (user already has a profile), skip the gate.

**Persistence rule:** On gate submit, data must go to TWO places:
1. Local component `profile` state (instant UI update)
2. Durable `updateStudentProfile({ name, preferredCity, location, careerGoal, experienceLevel })` (survives refresh)

**Why:** Failing to call `updateStudentProfile` means the gate is skipped on next visit (localStorage flag) but profile data is lost, breaking personalization.

**Gate dismissed:** `localStorage.setItem("rozgar_gate_done", "1")` after successful submit.
