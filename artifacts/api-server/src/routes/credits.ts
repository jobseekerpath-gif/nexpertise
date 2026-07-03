import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "./profile.js";
import {
  getBalance,
  getRecentTransactions,
  spendCredits,
  interviewCreditCost,
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

// POST /api/credits/interview/charge { durationMinutes } — charged once at interview start.
router.post("/credits/interview/charge", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const durationMinutes = Number((req.body as { durationMinutes?: number }).durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    res.status(400).json({ error: "durationMinutes required" });
    return;
  }
  const cost = interviewCreditCost(durationMinutes);
  const result = await spendCredits({
    userId,
    amount: cost,
    type: "spend_interview",
    description: `Interview (${durationMinutes} min)`,
  });
  if (!result.ok) {
    res.status(402).json({ error: "insufficient_credits", balance: result.balance, required: cost });
    return;
  }
  res.json({ ok: true, balance: result.balance, charged: cost });
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
