---
name: Credit-based access system
description: How EduBharat meters/charges credits, and the money-safety invariants to preserve.
---

EduBharat gates only *live* features on credits; everything else is free.

## Model
- 1 credit = ₹1. Signed-in accounts get a one-time 20-credit signup grant. Guests get nothing and are prompted to sign in.
- Live conversation (English Guru): 1 credit per 60-minute block = 5 credits/5 hours. First block charged at start; a client interval charges each subsequent block and ends the session gracefully on 402.
- Mock interview: flat 5 credits per session regardless of duration, charged once when the interview actually starts (after the opening question generates, before entering the session) so a failed opening never charges.
- Non-live learning (lessons, grammar, writing, vocab, jobs, news) is free.

## Money-safety invariants (do not regress)
- Every grant/spend is one DB transaction with a row lock; balance can never go negative (insufficient → 402).
- Idempotency is enforced by a UNIQUE index on `credit_transactions (type, reference)`. Signup reference = per-user key; purchase reference = the Stripe checkout **session id**. Re-running a grant is a no-op returning `already:true`.
- Purchase is **confirm-on-return** (client POSTs `session_id` to `/credits/confirm`), not webhook-dependent. Confirm must verify `session.payment_status === "paid"` AND `session.metadata.userId === caller`, and must NOT report success unless `grantCredits` returned `ok`.
- Client confirm-on-return only clears `?session_id` from the URL after a confirmed grant; on any failure it keeps the id and offers Retry (idempotent, so retry is safe). Never lose a paid session id.

## Stripe wiring
- One "EduBharat Credits" product/price (₹1, `unit_amount:100`, `inr`); variable amount via checkout line-item `quantity = credits`. Price is memoized find-or-create at runtime (no seed script).
- All Stripe init is guarded: if the Stripe connector isn't added, the server still boots and free-credits + gating work; only checkout is disabled (503 `payment_unavailable`).

## Redirect safety
- `isAllowedReturnUrl` matches success/cancel URLs strictly against `REPLIT_DOMAINS`. **Never** trust the client `Origin` header for this — it is spoofable.

**Why:** any change to pricing, metering, or the purchase flow must keep grants idempotent and confirm-on-return lossless, or users can be double-charged or lose paid credits.
