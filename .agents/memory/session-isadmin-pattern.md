---
name: Session isAdmin flag — sticky privilege pattern
description: How to safely manage isAdmin in express-session across multiple login paths
---

## Rule
Every non-admin login path (OTP verify, Google OAuth callback) must explicitly `delete req.session.isAdmin` when setting the new userId. Omitting this lets a previously-admin session retain admin privilege after re-auth as a regular user.

**Why:** express-session persists all session fields across requests. If a session was used for admin login (`isAdmin = true`), then the user logs in again via OTP/Google without clearing `isAdmin`, `requireAdmin` passes for the regular user.

**How to apply:**
- `/auth/admin-login` — sets `req.session.isAdmin = true` (only path that should do this)
- `/auth/otp/verify` — must have `delete req.session.isAdmin` before setting userId
- `/auth/google/callback` — must have `delete req.session.isAdmin` before setting userId  
- `requireAdmin` — checks `req.session.isAdmin === true` (not email string, which OTP can spoof in dev mode)
