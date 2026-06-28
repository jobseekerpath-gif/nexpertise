import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

type RozgarSection =
  | "top_jobs"
  | "govt_jobs"
  | "private_jobs"
  | "internships"
  | "scholarships"
  | "skill_trends"
  | "career_growth"
  | "ai_news"
  | "tech_news"
  | "business_news"
  | "govt_schemes"
  | "salary_insights"
  | "interview_qs"
  | "english_corner"
  | "vocab"
  | "quiz"
  | "jokes"
  | "success_stories"
  | "motivation";

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

type FeedSource = {
  name: string;
  query: string;
};

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const VALID_SECTIONS = new Set<RozgarSection>([
  "top_jobs",
  "govt_jobs",
  "private_jobs",
  "internships",
  "scholarships",
  "skill_trends",
  "career_growth",
  "ai_news",
  "tech_news",
  "business_news",
  "govt_schemes",
  "salary_insights",
  "interview_qs",
  "english_corner",
  "vocab",
  "quiz",
  "jokes",
  "success_stories",
  "motivation",
]);

const CACHE_MS = 8 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const FETCH_TIMEOUT_MS = 12000;

function stripTags(text: string) {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return text
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function cleanText(text: string) {
  return decodeHtmlEntities(stripTags(text)).replace(/\s+/g, " ").trim();
}

function textFromTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1] ?? "") : "";
}

function extractLinks(itemBlock: string) {
  const matches = [...itemBlock.matchAll(/<link>([\s\S]*?)<\/link>/gi)];
  const link = matches[0] ? cleanText(matches[0][1] ?? "") : "";
  if (link) return link;

  const alt = itemBlock.match(/<link[^>]*href="([^"]+)"/i);
  return alt ? cleanText(alt[1] ?? "") : "";
}

function parseRss(xml: string): LiveItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return items
    .map((match) => {
      const block = match[1] ?? "";
      const title = textFromTag(block, "title");
      const link = extractLinks(block);
      const source = textFromTag(block, "source") || "Google News";
      const summary = textFromTag(block, "description");
      const publishedAt = textFromTag(block, "pubDate") || null;

      return title && link
        ? { title, link, source, summary, publishedAt }
        : null;
    })
    .filter((item): item is LiveItem => Boolean(item));
}

function buildGoogleNewsFeed(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-IN",
    gl: "IN",
    ceid: "IN:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EduBharat/1.0)",
        Accept: "application/json, text/plain, */*",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function sectionContext(params: URLSearchParams) {
  return {
    location: params.get("location")?.trim() || "India",
    industry: params.get("industry")?.trim() || "technology",
    status: params.get("status")?.trim() || "candidate",
    goal: params.get("goal")?.trim() || "Private Job",
    skills: params.get("skills")?.trim() || "communication, Excel",
  };
}

function feedSourcesForSection(section: RozgarSection, ctx: ReturnType<typeof sectionContext>): FeedSource[] {
  const region = `${ctx.location} India`;
  const skills = ctx.skills.split(",").map((s) => s.trim()).filter(Boolean).join(" ");
  const industry = ctx.industry;

  const map: Record<RozgarSection, FeedSource[]> = {
    top_jobs: [
      { name: "India hiring", query: `${region} hiring jobs openings` },
      { name: "Career news", query: `${region} job openings recruitment` },
    ],
    govt_jobs: [
      { name: "Government recruitment", query: `site:gov.in recruitment vacancy India` },
      { name: "Employment news", query: `site:ncs.gov.in jobs India government` },
    ],
    private_jobs: [
      { name: "Private hiring", query: `${region} private jobs hiring ${industry}` },
      { name: "Company careers", query: `${region} company careers hiring` },
    ],
    internships: [
      { name: "Internships", query: `${region} internships apprenticeship` },
      { name: "Student jobs", query: `${region} internship opening freshers` },
    ],
    scholarships: [
      { name: "Scholarships", query: `${region} scholarship fellowship` },
      { name: "Education funding", query: `${region} scholarship india` },
    ],
    skill_trends: [
      { name: "Skills news", query: `${industry} skills hiring India` },
      { name: "Hiring market", query: `${region} skill trends jobs` },
    ],
    career_growth: [
      { name: "Career advice", query: `${region} career growth salary jobs` },
      { name: "Upskilling", query: `${industry} upskilling India` },
    ],
    ai_news: [
      { name: "AI news", query: `${region} AI jobs hiring` },
      { name: "AI market", query: `India AI hiring layoffs jobs` },
    ],
    tech_news: [
      { name: "Tech news", query: `${region} technology jobs hiring` },
      { name: "Software careers", query: `India software engineering hiring` },
    ],
    business_news: [
      { name: "Business news", query: `${region} business hiring salary` },
      { name: "Career market", query: `India employment salary trends` },
    ],
    govt_schemes: [
      { name: "Government schemes", query: `${region} skilling scheme employment` },
      { name: "Public programs", query: `India employment scheme training` },
    ],
    salary_insights: [
      { name: "Salary news", query: `${region} salary hiring market` },
      { name: "Compensation", query: `India salary trends jobs` },
    ],
    interview_qs: [
      { name: "Interview prep", query: `${region} interview hiring tips` },
      { name: "Career advice", query: `${industry} interview questions India` },
    ],
    english_corner: [
      { name: "English learning", query: `${region} english communication jobs` },
      { name: "Workplace English", query: `India workplace english interview` },
    ],
    vocab: [
      { name: "Workplace language", query: `${industry} vocabulary career` },
      { name: "Interview language", query: `${region} interview language tips` },
    ],
    quiz: [
      { name: "Career quiz", query: `${industry} quiz jobs India` },
      { name: "Skills practice", query: `${region} aptitude interview quiz` },
    ],
    jokes: [
      { name: "Work culture", query: `${region} office culture career` },
      { name: "Professional humor", query: `${region} work humor` },
    ],
    success_stories: [
      { name: "Career stories", query: `${region} career success story` },
      { name: "Industry stories", query: `${industry} success story India` },
    ],
    motivation: [
      { name: "Motivation", query: `${region} job motivation career` },
      { name: "Career inspiration", query: `${industry} career inspiration India` },
    ],
  };

  return map[section];
}

function normalizeJobicy(job: Record<string, unknown>): LiveItem | null {
  const title = typeof job["jobTitle"] === "string" ? job["jobTitle"] : "";
  const link = typeof job["url"] === "string" ? job["url"] : "";
  if (!title || !link) return null;

  const company = typeof job["companyName"] === "string" ? job["companyName"] : undefined;
  const location = typeof job["jobGeo"] === "string" ? job["jobGeo"] : undefined;
  const summaryRaw = typeof job["jobExcerpt"] === "string" ? job["jobExcerpt"] : "";
  const publishedAt = typeof job["pubDate"] === "string" ? job["pubDate"] : null;
  const jobType = Array.isArray(job["jobType"]) ? job["jobType"].filter((v): v is string => typeof v === "string").join(", ") : undefined;
  const kind: LiveItem["kind"] = "vacancy";

  return {
    title,
    link,
    source: "Jobicy API",
    publishedAt,
    summary: cleanText(summaryRaw).slice(0, 220),
    company,
    location,
    jobType,
    remote: Boolean(String(location ?? "").toLowerCase().includes("remote")),
    kind,
  };
}

function normalizeArbeitnow(job: Record<string, unknown>): LiveItem | null {
  const title = typeof job["title"] === "string" ? job["title"] : "";
  const link = typeof job["url"] === "string" ? job["url"] : "";
  if (!title || !link) return null;

  const company = typeof job["company_name"] === "string" ? job["company_name"] : undefined;
  const location = typeof job["location"] === "string" ? job["location"] : undefined;
  const summaryRaw = typeof job["description"] === "string" ? job["description"] : "";
  const createdAt = typeof job["created_at"] === "string" ? job["created_at"] : null;
  const remote = typeof job["remote"] === "boolean" ? job["remote"] : undefined;
  const jobType = Array.isArray(job["job_types"]) ? job["job_types"].filter((v): v is string => typeof v === "string").join(", ") : undefined;

  return {
    title,
    link,
    source: "Arbeitnow API",
    publishedAt: createdAt,
    summary: cleanText(summaryRaw).slice(0, 220),
    company,
    location,
    jobType,
    remote,
    kind: "vacancy",
  };
}

async function fetchFeedItems(source: FeedSource): Promise<LiveItem[]> {
  const url = buildGoogleNewsFeed(source.query);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; EduBharat/1.0)",
      Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseRss(xml).slice(0, 6);
}

async function fetchJobicyItems(): Promise<LiveItem[]> {
  const json = await fetchJson<{ jobs?: Array<Record<string, unknown>> }>(
    "https://jobicy.com/api/v2/remote-jobs?count=20",
  );
  return (json.jobs ?? []).map(normalizeJobicy).filter((item): item is LiveItem => Boolean(item));
}

async function fetchArbeitnowItems(): Promise<LiveItem[]> {
  const json = await fetchJson<{ data?: Array<Record<string, unknown>> }>(
    "https://www.arbeitnow.com/api/job-board-api",
  );
  return (json.data ?? []).map(normalizeArbeitnow).filter((item): item is LiveItem => Boolean(item));
}

function mergeItems(items: LiveItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}::${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns true if a job is relevant to an India-based candidate.
 * Filters out jobs with explicit non-India locations (Australia, USA, Germany, etc.)
 * unless the job is explicitly marked remote.
 */
function isIndiaRelevantJob(item: LiveItem): boolean {
  // Explicitly remote jobs are universally applicable
  if (item.remote === true) return true;
  // Unknown location — allow through
  if (!item.location) return true;
  const loc = item.location.toLowerCase().trim();
  if (!loc || loc === "remote" || loc === "worldwide" || loc.includes("india")) return true;
  // Exclude jobs with clearly non-India locations
  // Word-boundary match so "uk" inside "kolkata" doesn't false-positive
  const tokens = loc.split(/[\s,\/\-]+/).map(t => t.trim()).filter(Boolean);
  const nonIndiaTokens = new Set([
    "australia", "aus", "usa", "us", "united", "states", "canada", "ca",
    "uk", "germany", "de", "france", "netherlands", "nl", "zealand",
    "brazil", "mexico", "japan", "jp", "china", "cn", "korea", "kr",
    "dubai", "uae", "hongkong", "taiwan", "tw", "sweden", "norway",
    "denmark", "finland", "switzerland", "austria", "spain", "italy",
    "portugal", "poland", "czech", "singapore", "sg", "malaysia", "my",
    "thailand", "th", "philippines", "ph", "indonesia", "id",
  ]);
  // Check compound phrases too (e.g. "new zealand", "united states")
  const nonIndiaPhrases = ["new zealand", "united states", "united kingdom", "hong kong", "south africa"];
  if (nonIndiaPhrases.some(p => loc.includes(p))) return false;
  return !tokens.some(t => nonIndiaTokens.has(t));
}

router.get("/rozgar/live", async (req: Request, res: Response) => {
  const rawSection = req.query["section"] as string | undefined;
  const section: RozgarSection = rawSection && VALID_SECTIONS.has(rawSection as RozgarSection)
    ? (rawSection as RozgarSection)
    : "top_jobs";
  const ctx = sectionContext(new URLSearchParams(req.query as Record<string, string>));
  const cacheKey = `${section}:${ctx.location}:${ctx.industry}:${ctx.status}:${ctx.goal}:${ctx.skills}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.payload);
    return;
  }

  const sources = feedSourcesForSection(section, ctx);

  try {
    const vacancySections = new Set<RozgarSection>([
      "top_jobs",
      "govt_jobs",
      "private_jobs",
      "internships",
      "scholarships",
    ]);

    const itemGroups = await Promise.allSettled(
      section === "top_jobs"
        ? [fetchJobicyItems(), fetchArbeitnowItems(), Promise.all(sources.map((source) => fetchFeedItems(source))).then((groups) => groups.flat())]
        : section === "private_jobs"
          ? [fetchArbeitnowItems(), fetchJobicyItems()]
          : section === "internships"
            ? [fetchJobicyItems()]
            : section === "govt_jobs" || section === "scholarships"
              ? [Promise.all(sources.map((source) => fetchFeedItems(source))).then((groups) => groups.flat())]
              : [Promise.all(sources.map((source) => fetchFeedItems(source))).then((groups) => groups.flat())],
    );

    const rawItems = itemGroups.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

    const items = mergeItems(
      rawItems.filter((item) => {
        // For job/vacancy sections from external APIs, filter to India-relevant only
        if (vacancySections.has(section) && (item.source === "Jobicy API" || item.source === "Arbeitnow API")) {
          if (!isIndiaRelevantJob(item)) return false;
        }

        if (!vacancySections.has(section)) return true;

        const haystack = `${item.title} ${item.company ?? ""} ${item.location ?? ""} ${item.summary ?? ""}`.toLowerCase();
        if (section === "top_jobs") return true;
        if (section === "private_jobs") return !haystack.includes("government") && !haystack.includes("govt");
        if (section === "govt_jobs") return haystack.includes("recruit") || haystack.includes("vacanc") || haystack.includes("notification") || item.source.includes("Google");
        if (section === "internships") return haystack.includes("intern") || haystack.includes("apprent") || haystack.includes("trainee");
        if (section === "scholarships") return haystack.includes("scholarship") || haystack.includes("fellowship") || haystack.includes("grant");
        return true;
      }),
    ).slice(0, 10);

    const payload = {
      section,
      fetchedAt: new Date().toISOString(),
      sources,
      items,
    };

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, payload });
    res.json(payload);
  } catch (err) {
    req.log?.warn?.({ err }, "Rozgar live feed failed");
    res.status(502).json({
      section,
      fetchedAt: new Date().toISOString(),
      sources,
      items: [],
      error: "Live source unavailable right now. Falling back to AI summary.",
    });
  }
});

export default router;