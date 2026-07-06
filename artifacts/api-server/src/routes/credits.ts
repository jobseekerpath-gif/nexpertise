import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "./profile.js";
import {
  getBalance,
  getRecentTransactions,
  spendCredits,
  INTERVIEW_BLOCK_COST,
  INTERVIEW_MAX_BLOCKS,
  interviewBlockSeconds,
  LIVE_BLOCK_COST,
  LIVE_BLOCK_SECONDS,
} from "../lib/credits.js";
const router: IRouter = Router();

// GET /api/credits/balance — public; guests receive authenticated:false.
router.get("/credits/balance", async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    res.json({ authenticated: false, balance: null });
    return;
  }
  const balance = await getBalance(userId);
  res.json({ authenticated: true, balance });
});

// GET /api/credits/transactions — recent ledger for the signed-in user.
router.get("/credits/transactions", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const transactions = await getRecentTransactions(userId, 50);
  res.json({ transactions });
});

// Interviews are metered by actual usage: 1 credit per block, first block at
// start, the rest as the session continues (see /interview/tick below). The meter
// lives in the server session (req.session.interview) — authoritative and not
// forgeable by the client. `interview.id` is a server-minted token used as the
// idempotent ledger reference for every block, so a full session costs at most
// INTERVIEW_MAX_BLOCKS credits no matter how (or how often) the client calls.
// POST /api/credits/interview/charge { durationMinutes } — charges block 1.
router.post("/credits/interview/charge", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const durationMinutes = Number((req.body as { durationMinutes?: number }).durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    res.status(400).json({ error: "durationMinutes required" });
    return;
  }
  // One interview per session at a time. If a meter is still active (not expired),
  // reject rather than overwrite — overwriting would let a second concurrent
  // interview (e.g. another browser tab) collapse onto this meter's block
  // references and be under-charged. An expired meter (abandoned interview) is
  // safe to replace so the user is never locked out.
  const active = req.session.interview;
  if (active && Date.now() < active.expiresAt) {
    res.status(409).json({ error: "interview_in_progress" });
    return;
  }
  // Server-minted id (never sent by the client) → the idempotent ledger reference
  // for THIS interview's blocks; a fresh id per interview means old references
  // can't be replayed for free credits.
  const id = randomUUID();
  const result = await spendCredits({
    userId,
    amount: INTERVIEW_BLOCK_COST,
    type: "spend_interview",
    description: `Interview (block 1 · ${durationMinutes} min session)`,
    reference: `interview:${id}:1`,
    idempotent: true,
  });
  if (!result.ok) {
    req.session.interview = undefined;
    res.status(402).json({ error: "insufficient_credits", balance: result.balance, required: INTERVIEW_BLOCK_COST });
    return;
  }
  // Start a fresh authoritative meter. expiresAt covers the whole session plus a
  // buffer so an abandoned interview auto-frees the slot instead of locking out.
  const now = Date.now();
  const expiresAt = now + interviewBlockSeconds(durationMinutes) * 1000 * INTERVIEW_MAX_BLOCKS + 5 * 60_000;
  req.session.interview = { id, blocksCharged: 1, startedAt: now, expiresAt };
  res.json({
    ok: true,
    interviewId: id,
    balance: result.balance,
    charged: result.already ? 0 : INTERVIEW_BLOCK_COST,
    blockSeconds: interviewBlockSeconds(durationMinutes),
    maxBlocks: INTERVIEW_MAX_BLOCKS,
  });
});

// POST /api/credits/interview/tick { block } — charges 1 credit for the next
// block (2..INTERVIEW_MAX_BLOCKS). Charges are idempotent per (interview id,
// block): mutate() serialises on the user row and dedups by (type, reference), so
// concurrent or retried ticks for the same block charge at most once. Combined
// with the capped block range this hard-guarantees a full session costs at most
// INTERVIEW_MAX_BLOCKS credits.
router.post("/credits/interview/tick", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const meter = req.session.interview;
  if (!meter) {
    res.status(409).json({ error: "no_active_interview" });
    return;
  }
  const body = req.body as { block?: number; interviewId?: string };
  // The tab must present the token it received from /charge. If it doesn't match
  // the active meter, this tab's interview has been superseded (e.g. another tab
  // started one, or the meter was ended) — refuse so its ticks can never bill
  // against a different interview's block references.
  if (body.interviewId !== meter.id) {
    res.status(409).json({ error: "interview_superseded" });
    return;
  }
  const block = Number(body.block);
  if (!Number.isInteger(block) || block < 2 || block > INTERVIEW_MAX_BLOCKS) {
    res.status(400).json({ error: "invalid_block" });
    return;
  }
  // The client only ever advances one block at a time — reject skips. Re-requesting
  // an already-paid block is allowed and becomes a no-op via idempotency below.
  if (block > meter.blocksCharged + 1) {
    res.status(409).json({ error: "block_out_of_order", expected: meter.blocksCharged + 1 });
    return;
  }
  const result = await spendCredits({
    userId,
    amount: INTERVIEW_BLOCK_COST,
    type: "spend_interview",
    description: `Interview (block ${block})`,
    reference: `interview:${meter.id}:${block}`,
    idempotent: true,
  });
  if (!result.ok) {
    res.status(402).json({ error: "insufficient_credits", balance: result.balance, required: INTERVIEW_BLOCK_COST });
    return;
  }
  if (block > meter.blocksCharged) {
    req.session.interview = { ...meter, blocksCharged: block };
  }
  res.json({ ok: true, balance: result.balance, charged: result.already ? 0 : INTERVIEW_BLOCK_COST });
});

// POST /api/credits/interview/end — clears the active interview meter so the next
// interview can start right away. Idempotent; safe to call with no active meter.
router.post("/credits/interview/end", requireAuth, (req: Request, res: Response) => {
  const meter = req.session.interview;
  const { interviewId } = req.body as { interviewId?: string };
  // Only the tab that owns the active interview may clear it, so one tab's
  // cleanup/unmount can't wipe another tab's in-progress meter.
  if (meter && meter.id === interviewId) {
    req.session.interview = undefined;
  }
  res.json({ ok: true });
});

// POST /api/credits/live/start and /tick — one credit per 12-minute block (5 credits/hour).
async function chargeLiveBlock(req: Request, res: Response) {
  const userId = req.session.userId!;
  const result = await spendCredits({
    userId,
    amount: LIVE_BLOCK_COST,
    type: "spend_live",
    description: "Live conversation (12-minute block)",
  });
  if (!result.ok) {
    res.status(402).json({ error: "insufficient_credits", balance: result.balance, required: LIVE_BLOCK_COST });
    return;
  }
  res.json({ ok: true, balance: result.balance, blockSeconds: LIVE_BLOCK_SECONDS, charged: LIVE_BLOCK_COST });
}
router.post("/credits/live/start", requireAuth, chargeLiveBlock);
router.post("/credits/live/tick", requireAuth, chargeLiveBlock);

// Credits are topped up via UPI — see upi-payments route for checkout flow.

export default router;
