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

function mergeItems(items: LiveItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}::${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const results = await Promise.allSettled(sources.map((source) => fetchFeedItems(source)));
    const items = mergeItems(
      results.flatMap((result, index) => {
        if (result.status === "fulfilled") {
          return result.value.map((item) => ({
            ...item,
            source: sources[index]?.name ?? item.source,
          }));
        }
        return [];
      }),
    ).slice(0, 8);

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