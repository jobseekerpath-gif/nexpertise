import { useSyncExternalStore } from "react";

/**
 * Free "try before you sign up" allowance, tracked per-device in localStorage.
 * This lets visitors experience the live tools without an account. It is a
 * friction-reducer for showcasing the product, not a hard paywall — clearing
 * browser storage resets it, which is acceptable for a trial. Once a visitor
 * signs in they get 99 real credits and this trial no longer applies.
 */
const KEY = "edubharat_guest_trial_v1";

/** Guests get 15 minutes of live conversation, total, across sessions. */
export const GUEST_LIVE_SECONDS = 15 * 60;
/** Guests get 2 free mock interviews, total. */
export const GUEST_INTERVIEWS = 2;

export type GuestTrial = { liveSecondsUsed: number; interviewsUsed: number };

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

function load(): GuestTrial {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<GuestTrial>;
      return {
        liveSecondsUsed: clamp(Number(p.liveSecondsUsed), GUEST_LIVE_SECONDS),
        interviewsUsed: clamp(Number(p.interviewsUsed), GUEST_INTERVIEWS),
      };
    }
  } catch {
    /* corrupt/unavailable storage — start fresh */
  }
  return { liveSecondsUsed: 0, interviewsUsed: 0 };
}

let state: GuestTrial = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function guestLiveSecondsLeft(): number {
  return Math.max(0, GUEST_LIVE_SECONDS - state.liveSecondsUsed);
}
export function guestInterviewsLeft(): number {
  return Math.max(0, GUEST_INTERVIEWS - state.interviewsUsed);
}

/** Burn down live-conversation trial time (called by the live metering timer). */
export function addGuestLiveSeconds(seconds: number) {
  state = { ...state, liveSecondsUsed: clamp(state.liveSecondsUsed + seconds, GUEST_LIVE_SECONDS) };
  persist();
}
/** Consume one free interview (called when a guest interview actually starts). */
export function consumeGuestInterview() {
  state = { ...state, interviewsUsed: clamp(state.interviewsUsed + 1, GUEST_INTERVIEWS) };
  persist();
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

/** Reactive view of the guest trial so button hints update live. */
export function useGuestTrial() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snap,
    liveSecondsLeft: Math.max(0, GUEST_LIVE_SECONDS - snap.liveSecondsUsed),
    interviewsLeft: Math.max(0, GUEST_INTERVIEWS - snap.interviewsUsed),
  };
}
