import { db, usersTable, creditTransactionsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "./logger";

/** Free credits granted once per account on first sign-in. */
export const SIGNUP_GRANT = 20;

/** Live conversation is metered in 12-minute blocks → 1 credit each = 5 credits/hour. */
export const LIVE_BLOCK_SECONDS = 12 * 60;
export const LIVE_BLOCK_COST = 1;

/**
 * Interviews are metered by actual usage: each session is split into 5 equal
 * blocks and 1 credit is charged per block entered (the first block upfront).
 * Leaving early costs only for the blocks used; a full session still costs at
 * most 5 credits — the previous flat price.
 */
export const INTERVIEW_BLOCK_COST = 1;
export const INTERVIEW_MAX_BLOCKS = 5;

/** Seconds per interview block for a session of the given length (min 30s). */
export function interviewBlockSeconds(durationMinutes: number): number {
  return Math.max(30, Math.round((durationMinutes * 60) / INTERVIEW_MAX_BLOCKS));
}

export type CreditType =
  | "signup_grant"
  | "purchase"
  | "spend_interview"
  | "spend_live"
  | "refund"
  | "adjustment";

/** Maximum credits a full interview can cost (all blocks). Used for display. */
export function interviewCreditCost(_durationMinutes: number): number {
  return INTERVIEW_BLOCK_COST * INTERVIEW_MAX_BLOCKS;
}

export async function getBalance(userId: number): Promise<number> {
  const rows = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return rows[0]?.credits ?? 0;
}

export async function getRecentTransactions(userId: number, limit = 50) {
  return db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, userId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(limit);
}

type MutateArgs = {
  userId: number;
  amount: number; // signed: positive = credit, negative = debit
  type: CreditType;
  description?: string;
  reference?: string | null;
  idempotent?: boolean;
};

type MutateResult =
  | { ok: true; balance: number; already?: boolean }
  | { ok: false; reason: "insufficient" | "no_user"; balance: number };

/** A drizzle transaction handle — the object passed to `db.transaction(cb)`. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Core balance mutation, run against an existing transaction handle. Locks the
 * user row (FOR UPDATE) so concurrent spends/grants can't double-count.
 */
async function mutateTx(
  tx: Tx,
  { userId, amount, type, description, reference = null, idempotent = false }: MutateArgs,
): Promise<MutateResult> {
  const locked = await tx
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .for("update")
    .limit(1);

  if (locked.length === 0) return { ok: false, reason: "no_user", balance: 0 };
  const current = locked[0]!.credits;

  // Idempotency guard for grants/purchases: same (type, reference) is applied once.
  if (idempotent && reference) {
    const existing = await tx
      .select({ id: creditTransactionsTable.id })
      .from(creditTransactionsTable)
      .where(and(eq(creditTransactionsTable.type, type), eq(creditTransactionsTable.reference, reference)))
      .limit(1);
    if (existing.length > 0) return { ok: true, balance: current, already: true };
  }

  const next = current + amount;
  if (next < 0) return { ok: false, reason: "insufficient", balance: current };

  await tx.update(usersTable).set({ credits: next, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  await tx.insert(creditTransactionsTable).values({
    userId,
    amount,
    balanceAfter: next,
    type,
    description: description ?? null,
    reference,
  });
  return { ok: true, balance: next };
}

/**
 * Atomically change a user's balance and append a ledger row, in its own transaction.
 */
async function mutate(args: MutateArgs): Promise<MutateResult> {
  return db.transaction((tx) => mutateTx(tx, args));
}

export async function grantCredits(args: {
  userId: number;
  amount: number;
  type: CreditType;
  description?: string;
  reference?: string | null;
}): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await mutate({ ...args, amount: Math.abs(args.amount), idempotent: true });
  if (!r.ok) {
    logger.warn({ userId: args.userId, reason: r.reason }, "grantCredits failed");
    return { ok: false, balance: r.balance };
  }
  return { ok: true, balance: r.balance, already: r.already };
}

/**
 * Grant credits within an existing transaction — used when the grant must commit
 * or roll back atomically with another change (e.g. flipping a UPI payment to
 * "approved", so the status and the credit mint can never diverge).
 */
export async function grantCreditsTx(
  tx: Tx,
  args: { userId: number; amount: number; type: CreditType; description?: string; reference?: string | null },
): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await mutateTx(tx, { ...args, amount: Math.abs(args.amount), idempotent: true });
  if (!r.ok) return { ok: false, balance: r.balance };
  return { ok: true, balance: r.balance, already: r.already };
}

export async function spendCredits(args: {
  userId: number;
  amount: number;
  type: CreditType;
  description?: string;
  reference?: string | null;
  idempotent?: boolean;
}): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await mutate({ ...args, amount: -Math.abs(args.amount), idempotent: args.idempotent ?? false });
  return { ok: r.ok, balance: r.balance, already: r.ok ? r.already : undefined };
}

/**
 * Claw back credits from a previously-granted (now reversed) UPI top-up, within
 * an existing transaction. Deducts up to the granted amount but never drives the
 * balance negative — if the user already spent some, we recover only what
 * remains. Idempotent via (type, reference), so re-reversing is a safe no-op.
 */
export async function reverseCreditsTx(
  tx: Tx,
  args: { userId: number; amount: number; description?: string; reference: string },
): Promise<{ ok: boolean; recovered: number; balance: number; already?: boolean }> {
  const { userId, amount, description, reference } = args;
  const type: CreditType = "adjustment";
  const locked = await tx
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .for("update")
    .limit(1);
  if (locked.length === 0) return { ok: false, recovered: 0, balance: 0 };
  const current = locked[0]!.credits;

  // Idempotency: a reversal for this payment is applied at most once.
  const existing = await tx
    .select({ id: creditTransactionsTable.id })
    .from(creditTransactionsTable)
    .where(and(eq(creditTransactionsTable.type, type), eq(creditTransactionsTable.reference, reference)))
    .limit(1);
  if (existing.length > 0) return { ok: true, recovered: 0, balance: current, already: true };

  const recovered = Math.max(0, Math.min(Math.abs(amount), current));
  const next = current - recovered;
  await tx.update(usersTable).set({ credits: next, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  await tx.insert(creditTransactionsTable).values({
    userId,
    amount: -recovered,
    balanceAfter: next,
    type,
    description: description ?? "Reversed UPI top-up (payment not confirmed)",
    reference,
  });
  return { ok: true, recovered, balance: next };
}

/** Claw back credits in its own transaction (see reverseCreditsTx). */
export async function reverseCredits(args: {
  userId: number;
  amount: number;
  description?: string;
  reference: string;
}): Promise<{ ok: boolean; recovered: number; balance: number; already?: boolean }> {
  return db.transaction((tx) => reverseCreditsTx(tx, args));
}

/** Grant the one-time welcome bonus. Idempotent per user (reference = signup:<id>). */
export async function ensureSignupGrant(userId: number): Promise<void> {
  try {
    await grantCredits({
      userId,
      amount: SIGNUP_GRANT,
      type: "signup_grant",
      description: "Welcome bonus — 20 free credits",
      reference: `signup:${userId}`,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message, userId }, "ensureSignupGrant failed");
  }
}

/** One-time backfill so existing accounts also receive their welcome credits. Idempotent. */
export async function backfillSignupGrants(): Promise<void> {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable);
    for (const u of users) {
      await ensureSignupGrant(u.id);
    }
    logger.info({ users: users.length }, "Signup credit backfill complete");
  } catch (err) {
    logger.error({ err: (err as Error).message }, "backfillSignupGrants failed");
  }
}
