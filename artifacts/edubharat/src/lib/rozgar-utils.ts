import type { RozgarLiveItem } from "./use-rozgar-live";
import type { StudentProfile } from "./use-student-profile";

export type EnrichedJob = RozgarLiveItem & {
  jobId: string;
  workMode: "remote" | "hybrid" | "onsite" | "unknown";
  sector: "government" | "private" | "startup" | "unknown";
  experience: "fresher" | "junior" | "mid" | "senior" | "unknown";
  employmentType: "full-time" | "part-time" | "internship" | "contract" | "unknown";
  requiredSkills: string[];
  salaryMin: number;
  salaryMax: number;
  publishedDate: Date | null;
  matchScore?: number;
};

export type FilterState = {
  keyword: string;
  city: string;
  workMode: "all" | "remote" | "hybrid" | "onsite";
  sector: "all" | "government" | "private" | "startup";
  experience: "all" | "fresher" | "junior" | "mid" | "senior";
  employmentType: "all" | "full-time" | "part-time" | "internship" | "contract";
  salaryMin: string;
  salaryMax: string;
  sort: "relevance" | "newest" | "salary" | "match";
};

export const DEFAULT_FILTERS: FilterState = {
  keyword: "",
  city: "",
  workMode: "all",
  sector: "all",
  experience: "all",
  employmentType: "all",
  salaryMin: "",
  salaryMax: "",
  sort: "match",
};

// Common Indian state/city keywords for location matching
// Note: keep tokens ≥5 chars to avoid false positives (e.g. "up", "mp" would match unrelated words)
const INDIAN_STATES_KEYWORDS = [
  "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "chennai", "pune", "kolkata",
  "ahmedabad", "jaipur", "surat", "lucknow", "kanpur", "nagpur", "visakhapatnam",
  "bhopal", "patna", "vadodara", "ghaziabad", "ludhiana", "agra", "nashik",
  "maharashtra", "gujarat", "rajasthan", "karnataka", "tamil", "telangana", "andhra",
  "uttar pradesh", "west bengal", "bihar", "kerala", "odisha", "assam",
  "chandigarh", "noida", "gurgaon", "gurugram", "coimbatore", "indore", "kochi",
  "remote india", "anywhere india", "pan india", "pan-india",
];

// FNV-1a 32-bit hash — stable job ID from link
export function makeJobId(link: string): string {
  let h = 2166136261;
  for (let i = 0; i < link.length; i++) {
    h ^= link.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h >>>= 0;
  }
  return `r${h.toString(36)}`;
}

const SKILL_BANK = [
  "javascript", "typescript", "react", "node.js", "python", "java", "c++", "c#",
  "sql", "excel", "communication", "sales", "marketing", "accounting", "finance",
  "html", "css", "aws", "docker", "kubernetes", "data analysis", "machine learning",
  "ai", "seo", "content writing", "customer support", "operations", "hr", "recruitment",
  "teaching", "nursing", "digital marketing", "social media", "ui/ux", "figma",
  "project management", "agile", "scrum", "leadership", "team management", "ms office",
  "powerpoint", "word", "photoshop", "illustrator", "video editing", "autocad",
  "mechanical", "electrical", "civil", "electronics", "python", "r", "statistics",
  " tableau", "power bi", "sap", "tally", "gst", "banking", "insurance", "logistics",
  "supply chain", "bpo", "voice process", "non-voice", "back office", "front office",
  "field sales", "telecalling", "counselling", "teaching", "nursing", "pharmacy",
];

function normalizeText(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function inferWorkMode(item: RozgarLiveItem): EnrichedJob["workMode"] {
  const text = normalizeText(item.title, item.summary, item.location, item.jobType);
  if (text.includes("remote") || text.includes("work from home") || text.includes("wfh") || item.remote) return "remote";
  if (text.includes("hybrid")) return "hybrid";
  if (text.includes("onsite") || text.includes("on-site") || text.includes("in-office")) return "onsite";
  return "unknown";
}

export function inferSector(item: RozgarLiveItem): EnrichedJob["sector"] {
  const text = normalizeText(item.title, item.summary, item.source);
  if (text.includes("government") || text.includes("govt") || text.includes("sarkari") || text.includes("public sector") || text.includes("recruitment") || text.includes("vacancy")) return "government";
  if (text.includes("startup")) return "startup";
  if (text.includes("private") || text.includes("company") || text.includes("corporate") || text.includes("mnc")) return "private";
  return "unknown";
}

export function inferExperience(item: RozgarLiveItem): EnrichedJob["experience"] {
  const text = normalizeText(item.title, item.summary, item.jobType);
  if (text.includes("fresher") || text.includes("freshers") || text.includes("entry level") || text.includes("0-1 year") || text.includes("no experience") || text.includes("trainee")) return "fresher";
  if (text.includes("junior") || text.includes("1-3 year") || text.includes("1+ year") || text.includes("2+ year")) return "junior";
  if (text.includes("senior") || text.includes("lead") || text.includes("manager") || text.includes("5+ year") || text.includes("6+ year") || text.includes("10+ year")) return "senior";
  if (text.includes("mid") || text.includes("3-5 year") || text.includes("4+ year") || text.includes("experienced")) return "mid";
  return "unknown";
}

export function inferEmploymentType(item: RozgarLiveItem): EnrichedJob["employmentType"] {
  const text = normalizeText(item.title, item.summary, item.jobType);
  if (text.includes("internship") || text.includes("intern") || text.includes("apprentice") || text.includes("trainee")) return "internship";
  if (text.includes("contract") || text.includes("freelance")) return "contract";
  if (text.includes("part-time") || text.includes("part time")) return "part-time";
  if (text.includes("full-time") || text.includes("full time") || text.includes("permanent")) return "full-time";
  return "unknown";
}

export function extractSkills(item: RozgarLiveItem): string[] {
  const text = normalizeText(item.title, item.summary, item.jobType);
  const found = SKILL_BANK.filter(skill => text.includes(skill.toLowerCase()));
  return [...new Set(found)];
}

function parseSalaryLpa(salary?: string): { min: number; max: number } {
  if (!salary) return { min: 0, max: 0 };
  const text = salary.toLowerCase();
  // Match patterns like ₹3-5 LPA, 5-8 LPA, $50k-80k, 3L-5L, etc.
  const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*lpa/i);
  if (lpaMatch) return { min: Number(lpaMatch[1]), max: Number(lpaMatch[2]) };
  const singleLpa = text.match(/(\d+(?:\.\d+)?)\s*lpa/i);
  if (singleLpa) return { min: Number(singleLpa[1]), max: Number(singleLpa[1]) };
  const lakhsMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*l/i);
  if (lakhsMatch) return { min: Number(lakhsMatch[1]), max: Number(lakhsMatch[2]) };
  const singleLakhs = text.match(/(\d+(?:\.\d+)?)\s*l/i);
  if (singleLakhs) return { min: Number(singleLakhs[1]), max: Number(singleLakhs[1]) };
  return { min: 0, max: 0 };
}

export function enrichJob(item: RozgarLiveItem): EnrichedJob {
  const salary = parseSalaryLpa(item.salary);
  return {
    ...item,
    jobId: makeJobId(item.link),
    workMode: inferWorkMode(item),
    sector: inferSector(item),
    experience: inferExperience(item),
    employmentType: inferEmploymentType(item),
    requiredSkills: extractSkills(item),
    salaryMin: salary.min,
    salaryMax: salary.max,
    publishedDate: item.publishedAt ? new Date(item.publishedAt) : null,
  };
}

export function computeMatchScore(job: EnrichedJob, profile: StudentProfile): number {
  let score = 0;
  const weights = {
    location: 30,
    skills: 30,
    experience: 15,
    sector: 15,
    education: 10,
  };

  // Location (30%)
  const profileCity = (profile.preferredCity || profile.location || "").toLowerCase().trim();
  const jobLocation = (job.location || "").toLowerCase();
  const jobRemote = job.workMode === "remote" || job.workMode === "hybrid";
  const isIndianJob = !jobLocation || jobLocation.includes("india") || INDIAN_STATES_KEYWORDS.some(k => jobLocation.includes(k));
  if (jobRemote || (profileCity && jobLocation.includes(profileCity))) {
    score += weights.location;
  } else if (isIndianJob) {
    // Any Indian job is a reasonable location match for Indian candidates
    score += weights.location * 0.7;
  } else if (jobLocation && profileCity) {
    // Foreign location — very low match for Indian fresher/junior candidates
    score += weights.location * 0.1;
  }

  // Skills (30%)
  const profileSkills = profile.skills.map(s => s.toLowerCase().trim());
  if (job.requiredSkills.length > 0 && profileSkills.length > 0) {
    const matches = job.requiredSkills.filter(s => profileSkills.some(ps => ps.includes(s) || s.includes(ps))).length;
    score += (matches / Math.max(job.requiredSkills.length, 3)) * weights.skills;
  } else if (profileSkills.length > 0) {
    score += weights.skills * 0.4;
  }

  // Experience (15%)
  const profileExp = (profile.experienceLevel || "").toLowerCase();
  const jobExp = job.experience;
  if (jobExp === "unknown") {
    score += weights.experience * 0.5;
  } else if (
    (profileExp.includes("fresher") && jobExp === "fresher") ||
    (profileExp.includes("junior") && jobExp === "junior") ||
    (profileExp.includes("mid") && jobExp === "mid") ||
    (profileExp.includes("senior") && jobExp === "senior")
  ) {
    score += weights.experience;
  } else if (
    (profileExp.includes("fresher") && jobExp === "junior") ||
    (profileExp.includes("junior") && (jobExp === "fresher" || jobExp === "mid")) ||
    (profileExp.includes("mid") && (jobExp === "senior" || jobExp === "junior")) ||
    (profileExp.includes("senior") && (jobExp === "mid"))
  ) {
    score += weights.experience * 0.6;
  }

  // Sector (15%)
  const profileGoal = (profile.careerGoal || "").toLowerCase();
  const profileIndustry = (profile.industryPreference || "").toLowerCase();
  if (job.sector === "government" && profileGoal.includes("government")) score += weights.sector;
  else if (job.sector === "private" && profileGoal.includes("private")) score += weights.sector;
  else if (job.sector === "startup" && profileGoal.includes("startup")) score += weights.sector;
  else if (job.sector === "unknown") score += weights.sector * 0.5;
  else if (profileIndustry && normalizeText(job.title, job.summary).includes(profileIndustry)) score += weights.sector * 0.7;

  // Education (10%)
  const profileDegree = (profile.degree || "").toLowerCase();
  const jobText = normalizeText(job.title, job.summary);
  if (!profileDegree || jobText.includes(profileDegree) || job.experience === "fresher") {
    score += weights.education;
  } else if (jobText.includes("graduate") || jobText.includes("post-graduate")) {
    score += weights.education * 0.5;
  }

  return Math.min(100, Math.round(score));
}

export function filterJobs(jobs: EnrichedJob[], filters: FilterState, profile: StudentProfile): EnrichedJob[] {
  const keyword = filters.keyword.trim().toLowerCase();
  const city = filters.city.trim().toLowerCase();
  const salaryMin = Number(filters.salaryMin) || 0;
  const salaryMax = Number(filters.salaryMax) || Infinity;

  let result = jobs.filter(job => {
    const text = normalizeText(job.title, job.company, job.summary, job.location, job.source, job.jobType);
    if (keyword && !text.includes(keyword)) return false;
    if (city && !(job.location || "").toLowerCase().includes(city)) return false;
    if (filters.workMode !== "all" && job.workMode !== "unknown" && job.workMode !== filters.workMode) return false;
    if (filters.sector !== "all" && job.sector !== "unknown" && job.sector !== filters.sector) return false;
    if (filters.experience !== "all" && job.experience !== "unknown" && job.experience !== filters.experience) return false;
    if (filters.employmentType !== "all" && job.employmentType !== "unknown" && job.employmentType !== filters.employmentType) return false;
    if (job.salaryMax && job.salaryMax < salaryMin) return false;
    if (job.salaryMin && salaryMax && job.salaryMin > salaryMax) return false;
    return true;
  });

  result = result.map(job => ({ ...job, matchScore: computeMatchScore(job, profile) }));

  switch (filters.sort) {
    case "newest":
      result.sort((a, b) => (b.publishedDate?.getTime() ?? 0) - (a.publishedDate?.getTime() ?? 0));
      break;
    case "salary":
      result.sort((a, b) => (b.salaryMax || b.salaryMin || 0) - (a.salaryMax || a.salaryMin || 0));
      break;
    case "match":
      result.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      break;
    case "relevance":
    default:
      if (keyword) {
        result.sort((a, b) => {
          const aTitle = (a.title || "").toLowerCase().includes(keyword) ? 2 : (a.summary || "").toLowerCase().includes(keyword) ? 1 : 0;
          const bTitle = (b.title || "").toLowerCase().includes(keyword) ? 2 : (b.summary || "").toLowerCase().includes(keyword) ? 1 : 0;
          return bTitle - aTitle;
        });
      }
      break;
  }

  return result;
}

export function activeFilterCount(filters: FilterState): number {
  let count = 0;
  if (filters.keyword) count++;
  if (filters.city) count++;
  if (filters.workMode !== "all") count++;
  if (filters.sector !== "all") count++;
  if (filters.experience !== "all") count++;
  if (filters.employmentType !== "all") count++;
  if (filters.salaryMin) count++;
  if (filters.salaryMax) count++;
  return count;
}
