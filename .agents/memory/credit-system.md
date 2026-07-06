---
name: Credit-based access system
description: How EduBharat meters/charges credits, tops up via UPI, and the money-safety invariants to preserve.
---

EduBharat gates only *live* features on credits; everything else is free.

## Model
- 1 credit = ₹1. Signed-in accounts get a one-time 20-credit signup grant (`SIGNUP_GRANT`). Guests get a device-local time trial only (no credits) and are prompted to sign in.
- Live conversation (English Guru): 1 credit per 60-minute block = 5 credits/5 hours. First block charged at start; a client interval charges each subsequent block and ends the session gracefully on 402.
- Mock interview: metered by usage, mirroring live chat. The session is split into `INTERVIEW_MAX_BLOCKS` (5) equal blocks (block = duration/5). 1 credit per block *entered*: block 1 charged at start (after the opening question generates, so a failed opening never charges), blocks 2..5 charged by a client interval. Leaving early costs less; a full session still costs at most 5 (the old ceiling). On 402 mid-interview the client ends gracefully to the report. `interviewCreditCost` now returns the max (5) for display only.
- Non-live learning (lessons, grammar, writing, vocab, jobs, news) is free.

## Money-safety invariants (do not regress)
- Every grant/spend is one DB transaction with a row lock; balance can never go negative (insufficient → 402).
- Idempotency for **grants** is enforced by a UNIQUE index on `credit_transactions (type, reference)`. Signup reference = `signup:<userId>`; purchase reference = `upi:<paymentId>`. Re-running a grant is a no-op returning `already:true`.
- Interview per-block metering is **server-authoritative and idempotent**: the server mints a per-interview id, keeps the block counter in the server session (never trusts the client), and charges each block against a unique per-(interview, block) ledger reference, so the row-locked dedup makes each block charge at-most-once and hard-caps a full session at the max blocks. Bind *every* meter mutation (advancing a block AND ending) to that server-minted id — treat it as a session-bound nonce the client may echo but never choose — and allow only one active interview per session (reject an overlapping start; auto-expire an abandoned meter so a user is never locked out). **Why:** a client-chosen idempotency key is replayable across interviews (free credits); an *unbound* meter lets concurrent tabs collapse onto one interview's block references (underbilling) or clear each other's meter. The only tolerated residual is a scripted same-instant double-start, which over-charges the attacker, never underbills. Never rely on the client stopping its own meter for a money guarantee.
- A grant failure must be surfaced, never swallowed: if `grantCredits` returns not-ok and not-already, respond 500 and tell the user to contact support — do NOT report the top-up as successful.

## Top-ups are UPI, NOT Stripe
- There is **no payment SDK in the codebase** (no `stripe` import anywhere in app code). The user pays out-of-band over UPI, then submits the transaction UTR.
- `POST /credits/upi/submit { credits, utr }` validates range (min 49, max 100000 credits), inserts an `upi_payments` row as **status "approved" immediately** (auto-approve, no manual review), then calls `grantCredits({ type:"purchase", reference:"upi:<paymentId>" })`.
- `GET /credits/upi/status/:id` lets the client poll one payment; admin routes list/approve/reject payments (admin gated by `req.session.isAdmin`, never email alone).

## Client metering timers must not depend on unstable callbacks
- A per-block billing `setInterval` effect must NOT list an end/stop callback (or the speech/TTS hook objects it closes over) in its deps. Those hooks return fresh object literals every render, and the live/interview pages re-render every second (elapsed timer), so the effect would tear down and recreate the interval before a full block ever elapses — the meter never ticks and users are undercharged.
- Fix: keep the end action in a ref (`endEarlyRef`/`stopLiveRef`) updated by a tiny effect, and depend only on genuinely-stable values (phase, user, duration, toast). Both English Guru and Interview Ace use this ref pattern.

**Why:** any change to pricing, metering, or the top-up flow must keep grants idempotent and must never double-charge or silently drop a paid top-up. The historical Stripe checkout / confirm-on-return flow has been fully replaced by UPI+UTR; do not reintroduce Stripe assumptions.
