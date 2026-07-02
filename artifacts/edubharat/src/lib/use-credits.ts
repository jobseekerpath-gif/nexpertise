import { useCallback, useEffect, useSyncExternalStore } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Minimum top-up and suggested quick-pick amounts (1 credit = ₹1). */
export const CREDIT_MIN_PURCHASE = 49;
export const CREDIT_QUICK_PICKS = [49, 99, 199, 499, 999];

/** Live conversation: 1 credit per 12-minute block = 5 credits/hour. */
export const LIVE_BLOCK_SECONDS = 12 * 60;
export const LIVE_HOURLY_COST = 5;

/** Interview cost by duration: ~1 credit per 5 min, clamped 2–5 (mirrors the server). */
export function interviewCreditCost(durationMinutes: number): number {
  const cost = Math.round(durationMinutes / 5);
  return Math.max(2, Math.min(5, cost));
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

export async function startCheckout(credits: number): Promise<{ ok: boolean; error?: string; status: number }> {
  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const creditsUrl = `${origin}${base}/credits`;
  const { res, data } = await post("/api/credits/checkout", {
    credits,
    successUrl: creditsUrl,
    cancelUrl: creditsUrl,
  });
  if (res.ok && typeof data["url"] === "string") {
    window.location.href = data["url"] as string;
    return { ok: true, status: res.status };
  }
  return {
    ok: false,
    status: res.status,
    error: (data["message"] as string) || (data["error"] as string) || "Checkout could not be started.",
  };
}

export async function confirmCheckout(
  sessionId: string,
): Promise<{ ok: boolean; credited?: number; already?: boolean; balance?: number; status?: string }> {
  try {
    const { res, data } = await post("/api/credits/confirm", { sessionId });
    applyBalance(data);
    return {
      ok: res.ok && data["ok"] === true,
      credited: data["credited"] as number | undefined,
      already: data["already"] as boolean | undefined,
      balance: data["balance"] as number | undefined,
      status: data["status"] as string | undefined,
    };
  } catch {
    // Network/transient error — treat as "not confirmed yet" so the caller can retry
    // without losing the paid session id (crediting is idempotent server-side).
    return { ok: false };
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
