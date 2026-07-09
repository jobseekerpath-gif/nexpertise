---
name: B2B recruiter portal
description: Architecture, security rules, and credit accounting for the EduBharat B2B company dashboard.
---

## Architecture
- B2B companies are entirely separate from student users: own table (`b2b_companies`), own session keys (`b2bCompanyId`, `b2bCompanyEmail`, `b2bCompanyName`), own credit ledger (`b2b_credit_transactions`).
- Session isolation: every student login path deletes B2B session keys; every B2B login path deletes student session keys. Mixing must never happen.
- Interview cost: **2 credits flat per completed interview** (constant `B2B_INTERVIEW_COST = 2` in `b2b-credits.ts`).

## Database tables (all in `lib/db/src/schema/b2b.ts`)
`b2b_companies`, `b2b_campaigns`, `b2b_invites`, `b2b_credit_transactions`, `b2b_upi_payments`.
`interviewSessionsTable` (in `users.ts`) has a nullable `b2bInviteId` column.

## Credit accounting (`artifacts/api-server/src/lib/b2b-credits.ts`)
- Mirrors the student credit system but scoped to B2B companies.
- `spendB2BCreditsTx(tx, args)` — tx-scoped spend, used inside the completion transaction so credits and invite status change atomically. **Never call the non-tx `spendB2BCredits` from inside a transaction.**
- `grantB2BCreditsTx(tx, args)` — used in admin UPI approval.
- Idempotency key for interview completion: `b2b_invite:<inviteId>` — prevents double-charge on retries.

## Critical security rules (hard-won)

### `/complete` endpoint must be fully atomic
`POST /api/b2b/invite/:token/complete` does ALL of the following in a SINGLE transaction:
1. `FOR UPDATE` lock on invite row
2. Status precondition (only pending/started/sent can complete)
3. Minimum duration check (>= 60 seconds)
4. `spendB2BCreditsTx` — fails the whole tx if balance is insufficient
5. Insert interview session
6. Update invite status with original-status precondition (blocks race conditions)

**Why:** Without the single-tx approach, a concurrent double-submit creates duplicate session rows and races on the invite status update. Without the status precondition on the UPDATE, two racing transactions both pass the SELECT check and both commit.

### B2B token validation in interview-ace
`interview-ace.tsx` calls `GET /api/b2b/invite/:token/info` at the START of `startSession` (before any credit/trial bypass) to verify the token is real. A fake token must not bypass `chargeInterview` or `consumeGuestInterview`.

**Why:** Any `?b2bToken=fake-uuid` in the URL would otherwise grant unlimited free interviews to guests.

## Invite lifecycle
`pending` → `sent` (email dispatched) → `started` (candidate clicked link) → `completed` (interview submitted).  
`expired` = cancelled by recruiter.

## URL pattern for B2B interview landing
`/b2b-interview/:token` → `B2BInterviewLanding` → calls `/start` → redirects to `/interview-ace?b2bToken=xxx&b2bType=xxx&b2bDuration=xxx&b2bCoach=xxx`

## Admin approval
B2B UPI payments: `GET /api/admin/b2b/upi/pending`, `POST /api/admin/b2b/upi/approve/:id`, `POST /api/admin/b2b/upi/reject/:id`, `POST /api/admin/b2b/upi/reverse/:id`. Admin tab "B2B" in `admin-nav.tsx`, page `admin-b2b.tsx`.

## Password hashing
PBKDF2-SHA256, 100,000 iterations, 64-byte key, stored as hex. No extra npm dependencies (uses Node built-in `crypto.pbkdf2Sync`). Salt stored separately in `password_salt` column.
