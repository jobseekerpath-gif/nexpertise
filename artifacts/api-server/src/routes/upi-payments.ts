import { Router, type IRouter, type Request, type Response } from "express";
import { db, upiPaymentsTable, usersTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "./profile.js";
import { requireAdmin } from "../lib/guards.js";
import { grantCreditsTx, reverseCreditsTx } from "../lib/credits.js";
import { sendPaymentEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const MIN_PURCHASE = 49;
const MAX_PURCHASE = 100_000;

async function userEmail(userId: number): Promise<string | null> {
  const [u] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return u?.email ?? null;
}

/** Parse the numeric :id route param (normalises the string | string[] param type). */
function idParam(req: Request): number {
  const raw = req.params.id;
  return parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
}

// POST /api/credits/upi/submit { credits, utr } → { ok, paymentId, status }
// Records the request as PENDING — credits are granted only after an admin verifies
// the money actually arrived (see /approve). This is what blocks fake-UTR fraud.
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

    logger.info({ paymentId: payment!.id, userId, credits }, "UPI payment submitted (pending review)");

    // Best-effort acknowledgement email.
    const email = req.session.userEmail ?? (await userEmail(userId));
    if (email) void sendPaymentEmail(email, "received", { credits, utr });

    res.json({ ok: true, paymentId: payment!.id, status: "pending" });
  } catch (err) {
    // Duplicate UTR (unique index) → friendly message instead of a 500.
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This UTR has already been submitted." });
      return;
    }
    logger.error({ err: (err as Error).message }, "UPI payment submit error");
    res.status(500).json({ error: "Could not record payment. Please try again." });
  }
});

// GET /api/credits/upi/status/:id → { status, credits, rejectionReason? }
router.get("/credits/upi/status/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const paymentId = idParam(req);
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

// GET /api/credits/upi/pending — admin: list all payments (newest first).
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
      reversedAt: upiPaymentsTable.reversedAt,
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

// POST /api/credits/upi/approve/:id — admin: approve a pending payment and grant credits.
// The pending→approved flip and the credit grant run in ONE transaction with the
// row conditionally matched (WHERE status='pending'), so concurrent approve/reject
// calls can't both win and a failed grant rolls the approval back.
router.post("/credits/upi/approve/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const [existing] = await db
    .select({ id: upiPaymentsTable.id })
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const [payment] = await tx
        .update(upiPaymentsTable)
        .set({ status: "approved", approvedBy: req.session.userId, updatedAt: new Date() })
        .where(and(eq(upiPaymentsTable.id, paymentId), eq(upiPaymentsTable.status, "pending")))
        .returning();
      if (!payment) return { kind: "conflict" as const };

      // Grant credits atomically with the approval (idempotent via reference).
      const grant = await grantCreditsTx(tx, {
        userId: payment.userId,
        amount: payment.credits,
        type: "purchase",
        description: `UPI top-up — ₹${payment.amountInr} (UTR: ${payment.utr})`,
        reference: `upi:${payment.id}`,
      });
      if (!grant.ok && !grant.already) throw new Error("GRANT_FAILED");
      return { kind: "ok" as const, payment };
    });

    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "Payment already processed" });
      return;
    }

    const { payment } = outcome;
    logger.info({ paymentId, userId: payment.userId, credits: payment.credits }, "UPI payment approved");

    const email = await userEmail(payment.userId);
    if (email) void sendPaymentEmail(email, "approved", { credits: payment.credits, utr: payment.utr });

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message, paymentId }, "Credit grant failed on UPI approval");
    res.status(500).json({ error: "Credit grant failed. Please try again." });
  }
});

// POST /api/credits/upi/reject/:id { reason? } — admin: reject a pending payment.
// Conditional update (WHERE status='pending') so it can never clobber a payment
// that was concurrently approved (which would strand already-granted credits).
router.post("/credits/upi/reject/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const reason = ((req.body as { reason?: string }).reason ?? "").trim() || null;

  const [existing] = await db
    .select({ id: upiPaymentsTable.id })
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  const [payment] = await db
    .update(upiPaymentsTable)
    .set({ status: "rejected", rejectionReason: reason, approvedBy: req.session.userId, updatedAt: new Date() })
    .where(and(eq(upiPaymentsTable.id, paymentId), eq(upiPaymentsTable.status, "pending")))
    .returning();
  if (!payment) {
    res.status(409).json({ error: "Payment already processed" });
    return;
  }

  logger.info({ paymentId, reason }, "UPI payment rejected");

  const email = await userEmail(payment.userId);
  if (email) void sendPaymentEmail(email, "rejected", { credits: payment.credits, utr: payment.utr, reason });

  res.json({ ok: true });
});

// POST /api/credits/upi/reverse/:id { reason? } — admin: claw back an APPROVED
// payment when the money never actually arrived (fake UTR found after approval).
// The approved→reversed flip and the claw-back run in ONE transaction with the
// row conditionally matched (WHERE status='approved'), so a double-submit can't
// reverse twice and a failed claw-back rolls the status change back.
router.post("/credits/upi/reverse/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  if (isNaN(paymentId)) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  const reason = ((req.body as { reason?: string }).reason ?? "").trim() || null;

  const [existing] = await db
    .select({ id: upiPaymentsTable.id })
    .from(upiPaymentsTable)
    .where(eq(upiPaymentsTable.id, paymentId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }

  try {
    const outcome = await db.transaction(async (tx) => {
      const [payment] = await tx
        .update(upiPaymentsTable)
        .set({
          status: "reversed",
          rejectionReason: reason,
          reversedBy: req.session.userId,
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(upiPaymentsTable.id, paymentId), eq(upiPaymentsTable.status, "approved")))
        .returning();
      if (!payment) return { kind: "conflict" as const };

      // Claw back atomically with the reversal (idempotent; never drives balance negative).
      const rev = await reverseCreditsTx(tx, {
        userId: payment.userId,
        amount: payment.credits,
        description: `Reversed UPI top-up — ₹${payment.amountInr} (UTR: ${payment.utr})`,
        reference: `reverse:upi:${payment.id}`,
      });
      if (!rev.ok) throw new Error("REVERSE_FAILED");
      return { kind: "ok" as const, payment, recovered: rev.recovered };
    });

    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "Only approved payments can be reversed" });
      return;
    }

    const { payment, recovered } = outcome;
    logger.info({ paymentId, recovered }, "UPI payment reversed");

    const email = await userEmail(payment.userId);
    if (email) void sendPaymentEmail(email, "reversed", { credits: payment.credits, utr: payment.utr, reason });

    res.json({ ok: true, recovered });
  } catch (err) {
    logger.error({ err: (err as Error).message, paymentId }, "Credit reversal failed");
    res.status(500).json({ error: "Reversal failed. Please try again." });
  }
});

export default router;
