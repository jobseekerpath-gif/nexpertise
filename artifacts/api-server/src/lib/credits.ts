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

/**
 * Atomically change a user's balance and append a ledger row.
 * Locks the user row (FOR UPDATE) so concurrent spends/grants can't double-count.
 */
async function mutate({
  userId,
  amount,
  type,
  description,
  reference = null,
  idempotent = false,
}: MutateArgs): Promise<MutateResult> {
  return db.transaction(async (tx) => {
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
  });
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
