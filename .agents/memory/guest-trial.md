---
name: Guest trial (device-local free showcase) + auth-readiness gating
description: How the no-signup free trial works and the money-safety rule for any guest-vs-paid branch.
---

# Pattern
To showcase paid features without signup, EduBharat gives guests a device-local trial via
localStorage (cumulative live-conversation seconds + a small number of interviews). It is a soft
friction-reducer, not a hard paywall — resettable by clearing storage, which is acceptable for a
showcase. Guests run the feature WITHOUT charging credits; signed-in users keep the unchanged
credit-charge path. AI (`/ai/*`) and TTS (`/tts`) routes are public, so guest trials work end-to-end.

# Money-safety rule: gate on auth readiness before branching guest vs paid
`useAuth()` returns `user = null` while `/api/auth/me` is still loading. Any action that decides
"guest (free) vs signed-in (charge)" MUST first check `isLoading` and bail out (e.g. toast
"one moment…") — otherwise a signed-in user who clicks quickly is transiently seen as a guest and
gets the feature FOR FREE, skipping the credit charge.
**How to apply:** destructure `const { user, isLoading: authLoading } = useAuth()`; add
`if (authLoading) return;` before the guest/paid branch; and add `authLoading` to the memoized
callback's deps (omitting it captures a stale `authLoading=true` and can freeze the action).
**Why:** this was a real HIGH review finding — the null-during-load window is a money leak, not a
cosmetic race.
