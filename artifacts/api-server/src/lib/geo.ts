import { logger } from "./logger";

/**
 * Best-effort geolocation of an IP address using the free, key-less ipwho.is API.
 * Returns a human string like "Mumbai, Maharashtra, India" or null. Never throws
 * and always times out quickly — geolocation must never block or fail a login.
 */
export async function geolocateIp(ip?: string | null): Promise<string | null> {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, "").trim();
  // Skip localhost / private ranges — they have no public geolocation.
  if (
    !clean ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(clean)
  ) {
    return null;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const resp = await fetch(`https://ipwho.is/${encodeURIComponent(clean)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { success?: boolean; city?: string; region?: string; country?: string };
    if (!data || data.success === false) return null;
    const parts = [data.city, data.region, data.country].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "geolocateIp failed");
    return null;
  }
}
