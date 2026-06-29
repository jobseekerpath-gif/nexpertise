/**
 * /api/jobs/search  — personalized job scoring
 *
 * POST body: { skills: string[], preferred_location?: string,
 *               years_experience?: number, interested_sectors?: string[] }
 *
 * Returns jobs ranked by weighted match score.
 * MOCK_JOBS is sample data — swap for a real job feed once connected.
 */
import { Router, type Request, type Response } from "express";

const router = Router();

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  sector: string;
  required_skills: string[];
  min_experience: number;
  max_experience: number;
  days_since_posted: number;
};

// Sample dataset — replace with a real job feed / DB query
const MOCK_JOBS: Job[] = [
  {
    id: "j1", title: "Data Entry Operator", company: "Sahara Infotech",
    location: "Kanpur", remote: false, sector: "government",
    required_skills: ["typing", "ms office", "communication"],
    min_experience: 0, max_experience: 2, days_since_posted: 1,
  },
  {
    id: "j2", title: "Bank PO", company: "State Bank Recruitment",
    location: "Lucknow", remote: false, sector: "banking",
    required_skills: ["banking", "communication", "reasoning"],
    min_experience: 0, max_experience: 3, days_since_posted: 3,
  },
  {
    id: "j3", title: "Junior Software Developer", company: "TechNova",
    location: "Bengaluru", remote: true, sector: "technology",
    required_skills: ["python", "sql", "git"],
    min_experience: 0, max_experience: 2, days_since_posted: 0,
  },
  {
    id: "j4", title: "Customer Support Executive", company: "Vodafone Idea",
    location: "Kanpur", remote: false, sector: "telecom",
    required_skills: ["communication", "english", "crm"],
    min_experience: 0, max_experience: 4, days_since_posted: 2,
  },
  {
    id: "j5", title: "Sales Associate", company: "Reliance Retail",
    location: "Kanpur", remote: false, sector: "retail",
    required_skills: ["sales", "communication", "customer service"],
    min_experience: 0, max_experience: 3, days_since_posted: 5,
  },
  {
    id: "j6", title: "Content Writer", company: "DigiMedia India",
    location: "Mumbai", remote: true, sector: "media",
    required_skills: ["writing", "english", "seo"],
    min_experience: 0, max_experience: 3, days_since_posted: 1,
  },
  {
    id: "j7", title: "HR Executive", company: "HCL Technologies",
    location: "Noida", remote: false, sector: "technology",
    required_skills: ["communication", "excel", "recruitment"],
    min_experience: 1, max_experience: 5, days_since_posted: 2,
  },
  {
    id: "j8", title: "Railway Group D", company: "RRB Recruitment Board",
    location: "Pan India", remote: false, sector: "government",
    required_skills: ["general knowledge", "reasoning", "maths"],
    min_experience: 0, max_experience: 0, days_since_posted: 0,
  },
];

type Profile = {
  skills?: string[];
  preferred_location?: string;
  years_experience?: number;
  interested_sectors?: string[];
};

function scoreJob(profile: Profile, job: Job): number {
  let score = 0;

  const userSkills = new Set((profile.skills ?? []).map(s => s.toLowerCase()));
  const jobSkills = job.required_skills.map(s => s.toLowerCase());

  if (jobSkills.length > 0) {
    const overlap = jobSkills.filter(s => userSkills.has(s)).length / jobSkills.length;
    score += overlap * 50; // skill match dominates ranking
  }

  const years = profile.years_experience ?? 0;
  if (job.min_experience <= years && years <= job.max_experience + 2) {
    score += 20;
  }

  const loc = (profile.preferred_location ?? "").toLowerCase();
  if (loc && job.location.toLowerCase().includes(loc)) {
    score += 15;
  } else if (job.remote) {
    score += 10;
  }

  if ((profile.interested_sectors ?? []).map(s => s.toLowerCase()).includes(job.sector.toLowerCase())) {
    score += 10;
  }

  score += Math.max(0, 5 - job.days_since_posted); // small recency boost

  return Math.round(score * 10) / 10;
}

router.post("/jobs/search", (req: Request, res: Response) => {
  const profile = (req.body ?? {}) as Profile;

  const scored = MOCK_JOBS.map(job => ({
    ...job,
    score: scoreJob(profile, job),
  })).sort((a, b) => b.score - a.score);

  res.json({ results: scored });
});

export default router;
