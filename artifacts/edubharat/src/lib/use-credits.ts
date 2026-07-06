import { useCallback, useEffect, useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Minimum top-up and suggested quick-pick amounts (1 credit = ₹1). */
export const CREDIT_MIN_PURCHASE = 49;
export const CREDIT_QUICK_PICKS = [49, 99, 199, 499, 999];

/** Live conversation: 1 credit per 12-minute block = 5 credits/hour. */
export const LIVE_BLOCK_SECONDS = 12 * 60;
export const LIVE_HOURLY_COST = 5;

/** Interviews are metered per block: 1 credit each, first block charged at start. */
export const INTERVIEW_BLOCK_COST = 1;
/** A full interview is 5 blocks, so it costs at most 5 credits (the old flat price). */
export const INTERVIEW_MAX_BLOCKS = 5;

/** Maximum credits a full interview can cost (all blocks). Used for display. */
export function interviewCreditCost(_durationMinutes: number): number {
  return INTERVIEW_BLOCK_COST * INTERVIEW_MAX_BLOCKS;
}
/** Seconds per interview block for a session of the given length (min 30s). */
export function interviewBlockSeconds(durationMinutes: number): number {
  return Math.max(30, Math.round((durationMinutes * 60) / INTERVIEW_MAX_BLOCKS));
}

export type CreditsState = { balance: number | null; authenticated: boolean; loaded: boolean };

// Module-level store so the navbar badge and every page share one live balance.
let state: CreditsState = { balance: null, authenticated: false, loaded: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<CreditsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return state;
}

let inflight: Promise<void> | null = null;
export function refreshCredits(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${BASE}/api/credits/balance`, { credentials: "include" });
      const data = (await res.json()) as { authenticated?: boolean; balance?: number | null };
      setState({ balance: data.balance ?? null, authenticated: !!data.authenticated, loaded: true });
    } catch {
      setState({ loaded: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export type SpendResult = {
  ok: boolean;
  status: number;
  balance: number | null;
  charged?: number;
  required?: number;
  blockSeconds?: number;
  interviewId?: string;
  error?: string;
};

async function post(path: string, body?: unknown): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty body */
  }
  return { res, data };
}

function applyBalance(data: Record<string, unknown>) {
  if (typeof data["balance"] === "number") {
    setState({ balance: data["balance"] as number, authenticated: true, loaded: true });
  }
}

async function spend(path: string): Promise<SpendResult> {
  const { res, data } = await post(path);
  applyBalance(data);
  return {
    ok: res.ok,
    status: res.status,
    balance: (data["balance"] as number) ?? state.balance,
    charged: data["charged"] as number | undefined,
    required: data["required"] as number | undefined,
    error: data["error"] as string | undefined,
  };
}

async function spendBody(path: string, body: unknown): Promise<SpendResult> {
  const { res, data } = await post(path, body);
  applyBalance(data);
  return {
    ok: res.ok,
    status: res.status,
    balance: (data["balance"] as number) ?? state.balance,
    charged: data["charged"] as number | undefined,
    required: data["required"] as number | undefined,
    blockSeconds: data["blockSeconds"] as number | undefined,
    interviewId: data["interviewId"] as string | undefined,
    error: data["error"] as string | undefined,
  };
}

export function chargeInterview(durationMinutes: number): Promise<SpendResult> {
  return spendBody("/api/credits/interview/charge", { durationMinutes });
}

export function startLiveBlock(): Promise<SpendResult> {
  return spend("/api/credits/live/start");
}
export function tickLiveBlock(): Promise<SpendResult> {
  return spend("/api/credits/live/tick");
}
export function tickInterview(block: number, interviewId?: string): Promise<SpendResult> {
  return spendBody("/api/credits/interview/tick", { block, interviewId });
}
/** Release the server-side interview meter (call when the interview ends). Only
 * clears it if this interview id still owns the meter, so one tab can't wipe
 * another tab's in-progress interview. */
export function endInterview(interviewId?: string): Promise<SpendResult> {
  return spendBody("/api/credits/interview/end", { interviewId });
}

// ── UPI payment helpers ──────────────────────────────────────────────────────

export async function submitUpiPayment(credits: number, utr: string): Promise<{ ok: boolean; paymentId?: number; error?: string }> {
  try {
    const { res, data } = await post("/api/credits/upi/submit", { credits, utr });
    return { ok: res.ok, paymentId: data["paymentId"] as number | undefined, error: data["error"] as string | undefined };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function pollUpiPaymentStatus(paymentId: number): Promise<{ status: string; credits?: number; rejectionReason?: string | null } | null> {
  try {
    const res = await fetch(`${BASE}/api/credits/upi/status/${paymentId}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json() as { status: string; credits?: number; rejectionReason?: string | null };
    if (data.status === "approved") {
      // Refresh balance so the UI immediately reflects the new credits
      void refreshCredits();
    }
    return data;
  } catch {
    return null;
  }
}

export type CreditTx = {
  id: number;
  amount: number;
  balanceAfter: number;
  type: string;
  description: string | null;
  createdAt: string;
};
export async function fetchTransactions(): Promise<CreditTx[]> {
  try {
    const res = await fetch(`${BASE}/api/credits/transactions`, { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { transactions: CreditTx[] };
    return data.transactions ?? [];
  } catch {
    return [];
  }
}

export function useCredits() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!state.loaded) void refreshCredits();
  }, []);
  const refetch = useCallback(() => refreshCredits(), []);
  return { ...snap, refetch };
}
