import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { getConsent } from "./analytics";

const ANALYTICS_BASE = (import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "") + "/api/analytics";
const ANON_ID_KEY = "edubharat_anon_id";

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

function report(metric: Metric) {
  if (getConsent() !== "granted") return;
  const payload = {
    anonymousId: getAnonId(),
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
    path: window.location.pathname + window.location.search,
  };
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });
  const sent = navigator.sendBeacon?.(`${ANALYTICS_BASE}/web-vitals`, blob);
  if (!sent) {
    fetch(`${ANALYTICS_BASE}/web-vitals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => { /* ignore */ });
  }
}

export function reportWebVitals() {
  onCLS(report);
  onFCP(report);
  onINP(report);
  onLCP(report);
  onTTFB(report);
}
