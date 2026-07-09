/**
 * Credit accounting for B2B companies.
 * Mirrors the student credit system but operates on b2b_companies +
 * b2b_credit_transactions tables.
 */
import { db, b2bCompaniesTable, b2bCreditTransactionsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "./logger";

export const B2B_INTERVIEW_COST = 2; // credits charged per completed B2B interview

export async function getB2BBalance(companyId: number): Promise<number> {
  const rows = await db
    .select({ credits: b2bCompaniesTable.credits })
    .from(b2bCompaniesTable)
    .where(eq(b2bCompaniesTable.id, companyId))
    .limit(1);
  return rows[0]?.credits ?? 0;
}

export async function getB2BTransactions(companyId: number, limit = 50) {
  return db
    .select()
    .from(b2bCreditTransactionsTable)
    .where(eq(b2bCreditTransactionsTable.companyId, companyId))
    .orderBy(desc(b2bCreditTransactionsTable.createdAt))
    .limit(limit);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type MutateArgs = {
  companyId: number;
  amount: number; // signed
  type: string;
  description?: string;
  reference?: string | null;
  idempotent?: boolean;
};

type MutateResult =
  | { ok: true; balance: number; already?: boolean }
  | { ok: false; reason: "insufficient" | "not_found"; balance: number };

async function mutateTx(tx: Tx, args: MutateArgs): Promise<MutateResult> {
  const { companyId, amount, type, description, reference = null, idempotent = false } = args;

  const locked = await tx
    .select({ credits: b2bCompaniesTable.credits })
    .from(b2bCompaniesTable)
    .where(eq(b2bCompaniesTable.id, companyId))
    .for("update")
    .limit(1);

  if (locked.length === 0) return { ok: false, reason: "not_found", balance: 0 };
  const current = locked[0]!.credits;

  if (idempotent && reference) {
    const existing = await tx
      .select({ id: b2bCreditTransactionsTable.id })
      .from(b2bCreditTransactionsTable)
      .where(
        and(
          eq(b2bCreditTransactionsTable.type, type),
          eq(b2bCreditTransactionsTable.reference, reference),
        ),
      )
      .limit(1);
    if (existing.length > 0) return { ok: true, balance: current, already: true };
  }

  const next = current + amount;
  if (next < 0) return { ok: false, reason: "insufficient", balance: current };

  await tx
    .update(b2bCompaniesTable)
    .set({ credits: next, updatedAt: new Date() })
    .where(eq(b2bCompaniesTable.id, companyId));

  await tx.insert(b2bCreditTransactionsTable).values({
    companyId,
    amount,
    balanceAfter: next,
    type,
    description: description ?? null,
    reference,
  });

  return { ok: true, balance: next };
}

/**
 * Spend credits within an existing transaction — use this when the spend must
 * be atomic with invite completion so the two can never diverge.
 */
export async function spendB2BCreditsTx(
  tx: Tx,
  args: { companyId: number; amount: number; type?: string; description?: string; reference: string },
): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await mutateTx(tx, {
    ...args,
    type: args.type ?? "spend_interview",
    amount: -Math.abs(args.amount),
    idempotent: true,
  });
  return { ok: r.ok, balance: r.balance, already: r.ok ? r.already : undefined };
}

/** Spend credits (negative mutation). Returns { ok, balance }. */
export async function spendB2BCredits(args: {
  companyId: number;
  amount: number;
  type?: string;
  description?: string;
  reference?: string | null;
  idempotent?: boolean;
}): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await db.transaction((tx) =>
    mutateTx(tx, {
      ...args,
      type: args.type ?? "spend_interview",
      amount: -Math.abs(args.amount),
      idempotent: args.idempotent ?? false,
    }),
  );
  return { ok: r.ok, balance: r.balance, already: r.ok ? r.already : undefined };
}

/** Grant credits (positive mutation, idempotent by reference). */
export async function grantB2BCredits(args: {
  companyId: number;
  amount: number;
  type: string;
  description?: string;
  reference?: string | null;
}): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await db.transaction((tx) =>
    mutateTx(tx, { ...args, amount: Math.abs(args.amount), idempotent: true }),
  );
  if (!r.ok) {
    logger.warn({ companyId: args.companyId, reason: (r as { reason: string }).reason }, "grantB2BCredits failed");
    return { ok: false, balance: r.balance };
  }
  return { ok: true, balance: r.balance, already: r.already };
}

/** Grant within an existing transaction (for atomic UPI approval). */
export async function grantB2BCreditsTx(
  tx: Tx,
  args: { companyId: number; amount: number; type: string; description?: string; reference?: string | null },
): Promise<{ ok: boolean; balance: number; already?: boolean }> {
  const r = await mutateTx(tx, { ...args, amount: Math.abs(args.amount), idempotent: true });
  if (!r.ok) return { ok: false, balance: r.balance };
  return { ok: true, balance: r.balance, already: r.already };
}

/** Claw back (reverse) credits within an existing transaction. */
export async function reverseB2BCreditsTx(
  tx: Tx,
  args: { companyId: number; amount: number; description?: string; reference: string },
): Promise<{ ok: boolean; recovered: number; balance: number }> {
  const { companyId, amount, description, reference } = args;
  const type = "adjustment";

  const locked = await tx
    .select({ credits: b2bCompaniesTable.credits })
    .from(b2bCompaniesTable)
    .where(eq(b2bCompaniesTable.id, companyId))
    .for("update")
    .limit(1);
  if (locked.length === 0) return { ok: false, recovered: 0, balance: 0 };
  const current = locked[0]!.credits;

  const existing = await tx
    .select({ id: b2bCreditTransactionsTable.id })
    .from(b2bCreditTransactionsTable)
    .where(
      and(
        eq(b2bCreditTransactionsTable.type, type),
        eq(b2bCreditTransactionsTable.reference, reference),
      ),
    )
    .limit(1);
  if (existing.length > 0) return { ok: true, recovered: 0, balance: current };

  const recovered = Math.max(0, Math.min(Math.abs(amount), current));
  const next = current - recovered;
  await tx
    .update(b2bCompaniesTable)
    .set({ credits: next, updatedAt: new Date() })
    .where(eq(b2bCompaniesTable.id, companyId));
  await tx.insert(b2bCreditTransactionsTable).values({
    companyId,
    amount: -recovered,
    balanceAfter: next,
    type,
    description: description ?? "Reversed UPI top-up",
    reference,
  });
  return { ok: true, recovered, balance: next };
}
