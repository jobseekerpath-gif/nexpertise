---
name: Credit-based access system
description: How EduBharat meters/charges credits, tops up via UPI, and the money-safety invariants to preserve.
---

EduBharat gates only *live* features on credits; everything else is free.

## Model
- 1 credit = ₹1. Signed-in accounts get a one-time 20-credit signup grant (`SIGNUP_GRANT`). Guests get a device-local time trial only (no credits) and are prompted to sign in.
- Live conversation (English Guru): 1 credit per 60-minute block = 5 credits/5 hours. First block charged at start; a client interval charges each subsequent block and ends the session gracefully on 402.
- Mock interview: flat 5 credits per session regardless of duration, charged once when the interview actually starts (after the opening question generates, before entering the session) so a failed opening never charges.
- Non-live learning (lessons, grammar, writing, vocab, jobs, news) is free.

## Money-safety invariants (do not regress)
- Every grant/spend is one DB transaction with a row lock; balance can never go negative (insufficient → 402).
- Idempotency is enforced by a UNIQUE index on `credit_transactions (type, reference)`. Signup reference = `signup:<userId>`; purchase reference = `upi:<paymentId>`. Re-running a grant is a no-op returning `already:true`.
- A grant failure must be surfaced, never swallowed: if `grantCredits` returns not-ok and not-already, respond 500 and tell the user to contact support — do NOT report the top-up as successful.

## Top-ups are UPI, NOT Stripe
- There is **no payment SDK in the codebase** (no `stripe` import anywhere in app code). The user pays out-of-band over UPI, then submits the transaction UTR.
- `POST /credits/upi/submit { credits, utr }` validates range (min 49, max 100000 credits), inserts an `upi_payments` row as **status "approved" immediately** (auto-approve, no manual review), then calls `grantCredits({ type:"purchase", reference:"upi:<paymentId>" })`.
- `GET /credits/upi/status/:id` lets the client poll one payment; admin routes list/approve/reject payments (admin gated by `req.session.isAdmin`, never email alone).

**Why:** any change to pricing, metering, or the top-up flow must keep grants idempotent and must never double-charge or silently drop a paid top-up. The historical Stripe checkout / confirm-on-return flow has been fully replaced by UPI+UTR; do not reintroduce Stripe assumptions.
