import { useCallback, useEffect, useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Minimum top-up and suggested quick-pick amounts (1 credit = ₹1). */
export const CREDIT_MIN_PURCHASE = 49;
export const CREDIT_QUICK_PICKS = [49, 99, 199, 499, 999];

/** Live conversation: 1 credit per 60-minute block = 5 credits/5 hours. */
export const LIVE_BLOCK_SECONDS = 60 * 60;
export const LIVE_HOURLY_COST = 1;

/** Interview cost is a flat 5 credits per session (mirrors the server). */
export function interviewCreditCost(_durationMinutes: number): number {
  return 5;
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

export function chargeInterview(durationMinutes: number): Promise<SpendResult> {
  return (async () => {
    const { res, data } = await post("/api/credits/interview/charge", { durationMinutes });
    applyBalance(data);
    return {
      ok: res.ok,
      status: res.status,
      balance: (data["balance"] as number) ?? state.balance,
      charged: data["charged"] as number | undefined,
      required: data["required"] as number | undefined,
      error: data["error"] as string | undefined,
    };
  })();
}

export function startLiveBlock(): Promise<SpendResult> {
  return spend("/api/credits/live/start");
}
export function tickLiveBlock(): Promise<SpendResult> {
  return spend("/api/credits/live/tick");
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
