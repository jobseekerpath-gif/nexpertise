import { Router, type IRouter, type Request, type Response } from "express";
import type Stripe from "stripe";
import { requireAuth } from "./profile.js";
import { getUncachableStripeClient } from "../lib/stripe-client.js";
import {
  getBalance,
  getRecentTransactions,
  grantCredits,
  spendCredits,
  interviewCreditCost,
  LIVE_BLOCK_COST,
  LIVE_BLOCK_SECONDS,
} from "../lib/credits.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const CREDIT_UNIT_AMOUNT = 100; // ₹1.00 in paise
const CREDIT_CURRENCY = "inr";
const MIN_PURCHASE = 49;
const MAX_PURCHASE = 100_000;

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

// ---- Stripe checkout (variable amount: 1 credit = ₹1, min 49, never expires) ----

let cachedPriceId: string | null = null;
async function getCreditPriceId(stripe: Stripe): Promise<string> {
  if (cachedPriceId) return cachedPriceId;
  const found = await stripe.products.search({ query: "active:'true' AND name:'EduBharat Credits'" });
  let product = found.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: "EduBharat Credits",
      description: "Learning credits for EduBharat. 1 credit = ₹1. Credits never expire.",
    });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  let price = prices.data.find(
    (p) => p.currency === CREDIT_CURRENCY && p.unit_amount === CREDIT_UNIT_AMOUNT && !p.recurring,
  );
  if (!price) {
    price = await stripe.prices.create({ product: product.id, unit_amount: CREDIT_UNIT_AMOUNT, currency: CREDIT_CURRENCY });
  }
  cachedPriceId = price.id;
  return price.id;
}

/**
 * Only allow post-payment redirects back to this deployment's own domains.
 * Matches strictly against the server-side REPLIT_DOMAINS allowlist — never the
 * client-supplied Origin header, which is spoofable and would weaken this check.
 */
function isAllowedReturnUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const allowed = new Set(
      (process.env["REPLIT_DOMAINS"] ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    );
    return allowed.has(u.host);
  } catch {
    return false;
  }
}

// POST /api/credits/checkout { credits, successUrl, cancelUrl } → { url }
router.post("/credits/checkout", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const body = req.body as { credits?: number; successUrl?: string; cancelUrl?: string };
  const credits = Math.floor(Number(body.credits));
  if (!Number.isFinite(credits) || credits < MIN_PURCHASE || credits > MAX_PURCHASE) {
    res.status(400).json({ error: `Choose between ${MIN_PURCHASE} and ${MAX_PURCHASE} credits` });
    return;
  }
  if (
    !body.successUrl ||
    !body.cancelUrl ||
    !isAllowedReturnUrl(body.successUrl) ||
    !isAllowedReturnUrl(body.cancelUrl)
  ) {
    res.status(400).json({ error: "Invalid return URLs" });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const priceId = await getCreditPriceId(stripe);
    const sSep = body.successUrl.includes("?") ? "&" : "?";
    const cSep = body.cancelUrl.includes("?") ? "&" : "?";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: credits }],
      metadata: { userId: String(userId), credits: String(credits), kind: "credit_topup" },
      payment_intent_data: { metadata: { userId: String(userId), credits: String(credits) } },
      customer_email: req.session.userEmail,
      success_url: `${body.successUrl}${sSep}status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${body.cancelUrl}${cSep}status=cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Stripe checkout error");
    res.status(503).json({ error: "payment_unavailable", message: "Payments aren't available yet. Please try again shortly." });
  }
});

// POST /api/credits/confirm { sessionId } → grants credits once the session is paid (idempotent).
router.post("/credits/confirm", requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const sessionId = (req.body as { sessionId?: string }).sessionId;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId required" });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      res.json({ ok: false, status: session.payment_status, balance: await getBalance(userId) });
      return;
    }
    if (Number(session.metadata?.["userId"]) !== userId) {
      res.status(403).json({ error: "This purchase does not belong to your account" });
      return;
    }
    const credits = Number(session.metadata?.["credits"]);
    if (!Number.isFinite(credits) || credits <= 0) {
      res.status(400).json({ error: "Invalid purchase" });
      return;
    }
    const result = await grantCredits({
      userId,
      amount: credits,
      type: "purchase",
      description: `Purchased ${credits} credits`,
      reference: session.id,
    });
    if (!result.ok) {
      // Payment succeeded but crediting failed — do NOT report success. The
      // client keeps the session id and can retry; the unique (type, reference)
      // index keeps a later retry idempotent.
      logger.error({ userId, sessionId }, "Credit grant failed after paid checkout");
      res.status(500).json({ ok: false, error: "grant_failed", balance: result.balance });
      return;
    }
    res.json({ ok: true, credited: result.already ? 0 : credits, already: result.already ?? false, balance: result.balance });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Stripe confirm error");
    res.status(503).json({ error: "payment_unavailable" });
  }
});

export default router;
