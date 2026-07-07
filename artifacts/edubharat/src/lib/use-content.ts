import { useSyncExternalStore } from "react";

// Fetches admin content overrides once and shares them across the app via a
// module-level store. Pages call `useContent(key, fallback)` — the fallback (the
// hardcoded default) shows until overrides load and whenever a key isn't
// overridden, so the UI is never blank and migration stays page-by-page safe.

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

let overrides: Record<string, string> = {};
const listeners = new Set<() => void>();
let fetchStarted = false;

function emit() {
  for (const l of listeners) l();
}

async function loadContent(): Promise<void> {
  if (fetchStarted) return;
  fetchStarted = true;
  try {
    const res = await fetch(`${BASE}/api/content`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { content?: Record<string, string> };
      overrides = data.content ?? {};
      emit();
    }
  } catch {
    // Keep defaults on any failure — overrides are an enhancement, not required.
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  void loadContent();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Record<string, string> {
  return overrides;
}

/** Returns the admin override for `key` if set and non-empty, else `fallback`. */
export function useContent(key: string, fallback: string): string {
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const v = store[key];
  return v !== undefined && v !== "" ? v : fallback;
}

/** Re-fetch overrides (used by the admin editor after a save so the app updates live). */
export async function refreshContent(): Promise<Record<string, string>> {
  fetchStarted = false;
  await loadContent();
  return overrides;
}
