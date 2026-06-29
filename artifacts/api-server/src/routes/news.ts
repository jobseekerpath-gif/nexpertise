/**
 * /api/news/feed  — personalized news feed scoring
 *
 * POST body: { interested_sectors?: string[] }
 *
 * Returns news articles ranked by sector interest + recency.
 * MOCK_NEWS is sample data — swap for a real news source / RSS feed.
 */
import { Router, type Request, type Response } from "express";

const router = Router();

type NewsArticle = {
  id: string;
  title: string;
  sector: string;
  days_old: number;
  url?: string;
};

type NewsProfile = {
  interested_sectors?: string[];
};

// Sample dataset — replace with a real news source or the rozgar RSS feed
const MOCK_NEWS: NewsArticle[] = [
  { id: "n1", title: "SBI PO 2026 notification released — apply before July 31",        sector: "banking",    days_old: 0 },
  { id: "n2", title: "UP Police constable recruitment exam date announced",              sector: "government", days_old: 1 },
  { id: "n3", title: "IT hiring rebounds in Q2 2026 as start-ups resume growth",        sector: "technology", days_old: 2 },
  { id: "n4", title: "Retail sector adds 50,000 jobs this festive season",              sector: "retail",     days_old: 4 },
  { id: "n5", title: "Telecom companies expand rural hiring drives in Tier-3 cities",   sector: "telecom",    days_old: 1 },
  { id: "n6", title: "UPSC Civil Services notification 2026 out — 1000+ vacancies",     sector: "government", days_old: 0 },
  { id: "n7", title: "AI-related jobs grow 40% in India — top skills employers want",   sector: "technology", days_old: 3 },
  { id: "n8", title: "RBI Grade B officer recruitment 2026 — eligibility & syllabus",   sector: "banking",    days_old: 2 },
  { id: "n9", title: "Skill India Digital scheme: free online certifications for youth", sector: "government", days_old: 5 },
  { id: "n10",title: "English-fluent candidates get 25% salary premium in metros",       sector: "education",  days_old: 1 },
];

function scoreArticle(profile: NewsProfile, article: NewsArticle): number {
  let score = 0;
  const sectors = (profile.interested_sectors ?? []).map(s => s.toLowerCase());
  if (sectors.includes(article.sector.toLowerCase())) {
    score += 40;
  }
  score += Math.max(0, 10 - article.days_old); // recency decay
  return score;
}

router.post("/news/feed", (req: Request, res: Response) => {
  const profile = (req.body ?? {}) as NewsProfile;

  const scored = MOCK_NEWS.map(article => ({
    ...article,
    score: scoreArticle(profile, article),
  })).sort((a, b) => b.score - a.score);

  res.json({ results: scored });
});

export default router;
