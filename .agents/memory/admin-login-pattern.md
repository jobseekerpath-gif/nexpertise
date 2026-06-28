---
name: Admin login pattern
description: /auth/admin-login uses SHA-256 hash vs ADMIN_USERNAME + ADMIN_PASSWORD_HASH env vars.
---

EduBharat backend has a `/api/auth/admin-login` endpoint for username+password auth.

**How it works:**
1. POST `{ username, password }` to `/api/auth/admin-login`
2. Server reads `ADMIN_USERNAME` (default: "admin") and `ADMIN_PASSWORD_HASH` from env
3. Computes `SHA-256(password)` and compares hex strings
4. On match: seeds `admin@edubharat.in` user in DB if not exists, sets session

**Env vars needed:**
- `ADMIN_USERNAME` = "admin" (shared secret)
- `ADMIN_PASSWORD_HASH` = SHA-256 hex of the password (shared secret)

**Why SHA-256 not bcrypt:** bcrypt wasn't available as a dependency. SHA-256 is a known weakness for password storage — upgrade to bcrypt/argon2 if hardening.

**Admin user:** seeds as `email: admin@edubharat.in`, `authProvider: "local"`.
