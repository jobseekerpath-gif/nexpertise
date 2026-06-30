/**
 * GET /api/jobs/search  — real-time job search for Indian candidates
 *
 * Query params:
 *   q         — keyword / role (e.g. "software developer")
 *   city      — city or state filter (e.g. "Bangalore")
 *   experience — fresher | junior | mid | senior
 *   skills    — comma-separated skills
 *   sector    — government | private | startup
 *   industry  — industry slug (e.g. "technology")
 *   page      — 1-based page (default 1)
 *
 * Sources (in order of preference):
 *   1. Adzuna India API  — if ADZUNA_APP_ID + ADZUNA_APP_KEY are set
 *   2. Google News India RSS  — always available, no key needed, real India listings
 *   3. Remotive API     — free remote-job listings, tech-focused
 *
 * Returns items in RozgarLiveItem format (compatible with enrichJob / filterJobs).
 */
import { Router, type Request, type Response } from "express";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

type LiveItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  company?: string;
  location?: string;
  jobType?: string;
  remote?: boolean;
  salary?: string;
  kind?: "vacancy" | "news" | "update";
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { expiresAt: number; items: LiveItem[] }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return text
    .replace(/&#(\d+);/g, (_m, c: string) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, c: string) => String.fromCharCode(Number.parseInt(c, 16)))
    .replace(/&([a-z]+);/gi, (m, n: string) => named[n.toLowerCase()] ?? m);
}

function clean(text: string): string {
  return decodeHtmlEntities(cleanText(text)).replace(/\s+/g, " ").trim();
}

const FETCH_TIMEOUT_MS = 12_000;

async function fetchText(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduBharat/1.0)",
        Accept: "text/html, application/rss+xml, application/xml;q=0.9, */*;q=0.8",
        ...extraHeaders,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, extraHeaders?: Record<string, string>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduBharat/1.0)",
        Accept: "application/json",
        ...extraHeaders,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ─── RSS parser (from rozgar.ts) ─────────────────────────────────────────────

function textFromTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? clean(m[1] ?? "") : "";
}

function extractLink(block: string): string {
  const m1 = [...block.matchAll(/<link>([\s\S]*?)<\/link>/gi)];
  if (m1[0]) return clean(m1[0][1] ?? "");
  const m2 = block.match(/<link[^>]*href="([^"]+)"/i);
  return m2 ? clean(m2[1] ?? "") : "";
}

function parseRss(xml: string): LiveItem[] {
  const results: LiveItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const b = m[1] ?? "";
    const title = textFromTag(b, "title");
    const link = extractLink(b);
    if (!title || !link) continue;
    results.push({
      title,
      link,
      source: textFromTag(b, "source") || "Google News",
      summary: textFromTag(b, "description"),
      publishedAt: textFromTag(b, "pubDate") || null,
      kind: "vacancy",
    });
  }
  return results;
}

// ─── India-relevance filter ───────────────────────────────────────────────────

const NON_INDIA_SIGNALS = [
  "latam", "latin america", "portuguese", "español", "emea", "apac",
  "dach", "benelux", "nordics", "mena", "gcc", "cis", "cee",
  "europe only", "european only", "americas only", "uk only", "us only",
  "australia only", "canada only",
];

function isIndiaRelevant(item: LiveItem): boolean {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  return !NON_INDIA_SIGNALS.some(s => haystack.includes(s));
}

// ─── Source 1: Google News India RSS (no API key required) ───────────────────

function buildGoogleNewsUrl(query: string): string {
  const params = new URLSearchParams({ q: query, hl: "en-IN", gl: "IN", ceid: "IN:en" });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/**
 * Build several targeted search queries for the requested keyword + city.
 * Returning multiple queries gets us more diverse listings.
 */
function buildSearchQueries(q: string, city: string, sector: string, experience: string): string[] {
  const place = city || "India";
  const role = q || "jobs";
  const exp = experience !== "all" ? experience : "";
  const queries: string[] = [];

  // Primary: targeted hiring search
  queries.push(`${role} ${place} hiring jobs 2024 2025`);

  // Secondary: sector-specific
  if (sector === "government") {
    queries.push(`government jobs ${role} ${place} recruitment notification`);
  } else if (sector === "startup") {
    queries.push(`startup jobs ${role} ${place} hiring`);
  } else {
    queries.push(`${role} jobs ${place} company careers`);
  }

  // Tertiary: experience-specific
  if (exp === "fresher") {
    queries.push(`${role} fresher jobs ${place} 0-1 year`);
  } else if (exp === "junior") {
    queries.push(`${role} junior ${place} 1-3 years hiring`);
  } else if (exp === "senior") {
    queries.push(`${role} senior ${place} 5+ years`);
  }

  return queries.slice(0, 3);
}

async function fetchGoogleNewsJobs(q: string, city: string, sector: string, experience: string): Promise<LiveItem[]> {
  const queries = buildSearchQueries(q, city, sector, experience);

  const results = await Promise.allSettled(
    queries.map(async (query) => {
      const xml = await fetchText(buildGoogleNewsUrl(query));
      return parseRss(xml);
    })
  );

  const items: LiveItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

  // Add location context from query to items that don't have it
  const inferredLocation = city ? `${city}, India` : "India";
  return items.map(item => ({
    ...item,
    location: item.location || inferredLocation,
  }));
}

// ─── Source 2: Adzuna India (premium — needs ADZUNA_APP_ID + ADZUNA_APP_KEY) ─

type AdzunaJob = {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  redirect_url: string;
  created: string;
  description: string;
  contract_type?: string;
  category?: { label: string };
};

type AdzunaResponse = { results: AdzunaJob[]; count: number };

function formatSalaryLpa(min?: number, max?: number): string | undefined {
  const minL = min ? Math.round(min / 100_000) : 0;
  const maxL = max ? Math.round(max / 100_000) : 0;
  if (minL <= 0 && maxL <= 0) return undefined;
  if (!maxL || maxL === minL) return `₹${minL}+ LPA`;
  return `₹${minL}-${maxL} LPA`;
}

function normalizeAdzuna(job: AdzunaJob): LiveItem {
  return {
    title: job.title,
    link: job.redirect_url,
    source: "Adzuna",
    publishedAt: job.created,
    summary: clean(job.description).slice(0, 220),
    company: job.company.display_name,
    location: job.location.display_name,
    salary: formatSalaryLpa(job.salary_min, job.salary_max),
    jobType: job.contract_type ?? job.category?.label,
    remote: /remote|wfh|work from home/i.test(`${job.title} ${job.location.display_name}`),
    kind: "vacancy",
  };
}

async function fetchAdzuna(q: string, city: string, page: number): Promise<LiveItem[]> {
  const appId = process.env["ADZUNA_APP_ID"];
  const appKey = process.env["ADZUNA_APP_KEY"];
  if (!appId || !appKey) return [];

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "20",
    content_type: "application/json",
  });
  if (q) params.set("what", q);
  if (city) params.set("where", city);

  const url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params.toString()}`;
  const data = await fetchJson<AdzunaResponse>(url);
  return (data.results ?? []).map(normalizeAdzuna);
}

// ─── Source 3: Remotive (free remote jobs, no key required) ──────────────────

type RemotiveJob = {
  id: number;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  salary?: string;
  publication_date: string;
  description: string;
  job_type?: string;
  category?: string;
  tags?: string[];
};

type RemotiveResponse = { jobs: RemotiveJob[]; "job-count": number };

function normalizeRemotive(job: RemotiveJob): LiveItem {
  const candidateLoc = job.candidate_required_location?.toLowerCase() ?? "";
  // Only include if worldwide / Asia / India
  const isRelevant =
    !candidateLoc ||
    candidateLoc.includes("worldwide") ||
    candidateLoc.includes("anywhere") ||
    candidateLoc.includes("india") ||
    candidateLoc.includes("asia") ||
    !candidateLoc.includes("usa") && !candidateLoc.includes("europe") && !candidateLoc.includes("uk");

  if (!isRelevant) return null as unknown as LiveItem;

  return {
    title: job.title,
    link: job.url,
    source: "Remotive",
    publishedAt: job.publication_date,
    summary: clean(job.description).slice(0, 220),
    company: job.company_name,
    location: job.candidate_required_location ?? "Remote",
    salary: job.salary || undefined,
    jobType: job.job_type,
    remote: true,
    kind: "vacancy",
  };
}

async function fetchRemotive(q: string): Promise<LiveItem[]> {
  const params = new URLSearchParams({ limit: "20" });
  if (q) params.set("search", q);

  const data = await fetchJson<RemotiveResponse>(
    `https://remotive.com/api/remote-jobs?${params.toString()}`
  );
  return (data.jobs ?? [])
    .map(normalizeRemotive)
    .filter((item): item is LiveItem => Boolean(item));
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

function dedup(items: LiveItem[]): LiveItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.title.slice(0, 60)}::${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Match scoring ────────────────────────────────────────────────────────────

function scoreItem(
  item: LiveItem,
  q: string,
  city: string,
  skills: string[],
  sector: string,
  experience: string
): number {
  const text = `${item.title} ${item.company ?? ""} ${item.summary ?? ""} ${item.location ?? ""}`.toLowerCase();
  let score = 0;

  // Keyword (40 pts)
  if (q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const titleHits = words.filter(w => item.title.toLowerCase().includes(w)).length;
    const bodyHits = words.filter(w => text.includes(w)).length;
    score += (titleHits / words.length) * 25 + (bodyHits / words.length) * 15;
  } else {
    score += 20;
  }

  // Location (20 pts)
  if (item.remote) {
    score += 15;
  } else if (city && text.includes(city.toLowerCase())) {
    score += 20;
  } else {
    score += 8;
  }

  // Skills (25 pts)
  if (skills.length > 0) {
    const matched = skills.filter(s => text.includes(s.toLowerCase())).length;
    score += (matched / Math.max(skills.length, 2)) * 25;
  } else {
    score += 10;
  }

  // Experience (10 pts)
  if (experience && experience !== "all" && text.includes(experience)) {
    score += 10;
  } else {
    score += 4;
  }

  // Sector (5 pts)
  if (sector && sector !== "all" && text.includes(sector)) score += 5;
  else score += 2;

  // Recency bonus: items with a recent publishedAt rank higher
  if (item.publishedAt) {
    const daysOld = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 5 - daysOld);
  }

  return Math.min(100, Math.round(score));
}

// ─── Route ───────────────────────────────────────────────────────────────────

router.get("/jobs/search", async (req: Request, res: Response) => {
  const q = ((req.query["q"] as string) || "").trim();
  const city = ((req.query["city"] as string) || "").trim();
  const experience = ((req.query["experience"] as string) || "all").trim();
  const skills = ((req.query["skills"] as string) || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const sector = ((req.query["sector"] as string) || "all").trim();
  const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));

  const key = JSON.stringify({ q, city, experience, sector, skills: skills.join(","), page });
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    res.json({ items: hit.items, source: "cache", total: hit.items.length });
    return;
  }

  const errors: string[] = [];
  const allItems: LiveItem[] = [];
  const sources: string[] = [];

  // Run sources in parallel
  const [adzunaResult, gnewsResult, remotiveResult] = await Promise.allSettled([
    fetchAdzuna(q, city, page),
    fetchGoogleNewsJobs(q, city, sector, experience),
    fetchRemotive(q),
  ]);

  if (adzunaResult.status === "fulfilled" && adzunaResult.value.length > 0) {
    allItems.push(...adzunaResult.value);
    sources.push("adzuna");
  } else if (adzunaResult.status === "rejected") {
    errors.push(`Adzuna: ${String(adzunaResult.reason)}`);
  }

  if (gnewsResult.status === "fulfilled" && gnewsResult.value.length > 0) {
    allItems.push(...gnewsResult.value.filter(isIndiaRelevant));
    sources.push("gnews");
  } else if (gnewsResult.status === "rejected") {
    errors.push(`GNews: ${String(gnewsResult.reason)}`);
  }

  if (remotiveResult.status === "fulfilled" && remotiveResult.value.length > 0) {
    // Only add Remotive for tech/remote queries
    if (!q || /tech|software|developer|engineer|design|product|data|ai|ml|remote/i.test(q)) {
      allItems.push(...remotiveResult.value);
      sources.push("remotive");
    }
  } else if (remotiveResult.status === "rejected") {
    errors.push(`Remotive: ${String(remotiveResult.reason)}`);
  }

  // Score, deduplicate, and sort
  const scored = dedup(allItems)
    .map(item => ({
      item,
      score: scoreItem(item, q, city, skills, sector, experience),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  const source = sources.length > 0 ? sources.join("+") : "none";

  if (scored.length > 0) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, items: scored });
  }

  const errorField =
    errors.length > 0 && scored.length === 0 ? { error: errors.join("; ") } : {};

  res.json({ items: scored, source, total: scored.length, ...errorField });
});

export default router;
