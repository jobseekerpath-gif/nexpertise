const ANALYTICS_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api/analytics";
const CONSENT_KEY = "edubharat_analytics_consent";
const ANON_ID_KEY = "edubharat_anon_id";

export type Consent = "granted" | "denied" | "pending";

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "anon-unknown";
  }
}

export function getConsent(): Consent {
  try {
    return (localStorage.getItem(CONSENT_KEY) as Consent) ?? "pending";
  } catch {
    return "denied";
  }
}

export function setConsent(value: Consent) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* ignore */ }
}

export function canTrack(): boolean {
  return getConsent() === "granted";
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!canTrack()) return;
  const path = window.location.pathname + window.location.search;
  const payload = {
    anonymousId: getAnonId(),
    event,
    path,
    properties,
  };
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });
  const sent = navigator.sendBeacon?.(`${ANALYTICS_BASE}/events`, blob);
  if (!sent) {
    fetch(`${ANALYTICS_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }
}

export function trackPageView(path?: string) {
  track("page_view", { path: path ?? window.location.pathname });
}

export function trackToolEvent(tool: string, action: string, data?: Record<string, unknown>) {
  track("tool_event", { tool, action, ...data });
}
