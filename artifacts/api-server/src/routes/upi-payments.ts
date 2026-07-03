import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, upiPaymentsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "./profile.js";
import { grantCredits } from "../lib/credits.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const ADMIN_EMAIL = "admin@edubharat.in";
const MIN_PURCHASE = 49;
const MAX_PURCHASE = 100_000;

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // isAdmin is set only by the admin-login route after password-hash verification.
  // Never rely on userEmail alone — OTP dev-mode allows minting any session email.
  if (!req.session.userId || !req.session.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// POST /api/credits/upi/submit { credits, utr } → { ok, paymentId }
router.post("/credits/upi/submit", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { credits: rawCredits, utr: rawUtr } = req.body as { credits?: number; utr?: string };
  const credits = Math.floor(Number(rawCredits));
  const utr = (rawUtr ?? "").trim().toUpperCase();

  if (!Number.isFinite(credits) || credits < MIN_PURCHASE || credits > MAX_PURCHASE) {
    res.status(400).json({ error: `Choose between ${MIN_PURCHASE} and ${MAX_PURCHASE} credits` });
    return;
  }
  if (!utr || utr.length < 6) {
    res.status(400).json({ error: "Please enter a valid UTR number (at least 6 characters)" });
    return;
  }

  try {
    const [payment] = await db
      .insert(upiPaymentsTable)
      .values({ userId, credits, amountInr: credits, utr, status: "pending" })
      .returning();
    res.json({ ok: true, paymentId: payment!.id });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "UPI payment submit error");
    res.status(500).json({ error: "Could not record payment. Please try again." });
  }
});

// GET /api/credits/upi/status/:id → { status, credits, rejectionReason? }
router.get("/credits/upi/status/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const paymentId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const [payment] = await db
    .select()
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);

  if (!payment || payment.userId !== userId) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  res.json({ status: payment.status, credits: payment.credits, rejectionReason: payment.rejectionReason });
});

// GET /api/credits/upi/pending — admin: list all payments
router.get("/credits/upi/pending", requireAdmin, async (_req: Request, res: Response) => {
  const payments = await db
    .select({
      id: upiPaymentsTable.id,
      userId: upiPaymentsTable.userId,
      credits: upiPaymentsTable.credits,
      amountInr: upiPaymentsTable.amountInr,
      utr: upiPaymentsTable.utr,
      status: upiPaymentsTable.status,
      rejectionReason: upiPaymentsTable.rejectionReason,
      createdAt: upiPaymentsTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(upiPaymentsTable)
    .leftJoin(usersTable, eq(upiPaymentsTable.userId, usersTable.id))
    .orderBy(desc(upiPaymentsTable.createdAt))
    .limit(200);

  res.json({ payments });
});

// POST /api/credits/upi/approve/:id — admin: approve and grant credits
router.post("/credits/upi/approve/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const [payment] = await db
    .select()
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  if (payment.status !== "pending") {
    res.status(409).json({ error: "Payment already processed" });
    return;
  }

  // Grant credits (idempotent via reference)
  const result = await grantCredits({
    userId: payment.userId,
    amount: payment.credits,
    type: "purchase",
    description: `UPI top-up — ₹${payment.amountInr} (UTR: ${payment.utr})`,
    reference: `upi:${payment.id}`,
  });

  if (!result.ok && !result.already) {
    logger.error({ paymentId, userId: payment.userId }, "Credit grant failed on UPI approval");
    res.status(500).json({ error: "Credit grant failed. Please try again." });
    return;
  }

  await db
    .update(upiPaymentsTable)
    .set({ status: "approved", approvedBy: req.session.userId, updatedAt: new Date() })
    .where(eq(upiPaymentsTable.id, paymentId));

  logger.info({ paymentId, userId: payment.userId, credits: payment.credits }, "UPI payment approved");
  res.json({ ok: true });
});

// POST /api/credits/upi/reject/:id { reason? } — admin: reject
router.post("/credits/upi/reject/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const reason = ((req.body as { reason?: string }).reason ?? "").trim() || null;

  const [payment] = await db
    .select()
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);

  if (!payment) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  if (payment.status !== "pending") {
    res.status(409).json({ error: "Payment already processed" });
    return;
  }

  await db
    .update(upiPaymentsTable)
    .set({ status: "rejected", rejectionReason: reason, approvedBy: req.session.userId, updatedAt: new Date() })
    .where(eq(upiPaymentsTable.id, paymentId));

  logger.info({ paymentId, reason }, "UPI payment rejected");
  res.json({ ok: true });
});

export default router;
