import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useRozgarLive, type RozgarLiveItem } from "@/lib/use-rozgar-live";
import { useRozgarJobs } from "@/lib/use-rozgar-jobs";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { useStudentProfile, type StudentProfile } from "@/lib/use-student-profile";
import { useSavedJobs, type SavedJob } from "@/lib/use-saved-jobs";
import {
  enrichJob, filterJobs, activeFilterCount, computeMatchScore,
  type EnrichedJob, type FilterState, type SalaryBand,
  DEFAULT_FILTERS, makeJobId, SALARY_BANDS,
} from "@/lib/rozgar-utils";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import {
  Newspaper, Volume2, Bookmark, BookmarkCheck, Loader2, ChevronDown, ChevronUp,
  User, Settings, Search, ExternalLink, X, Briefcase, SlidersHorizontal, MapPin,
  Share2, EyeOff, Filter, Calendar, IndianRupee, Trash2,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "top_jobs", emoji: "🔥", title: "Top Jobs Today" },
  { id: "govt_jobs", emoji: "🏛️", title: "Government Jobs" },
  { id: "private_jobs", emoji: "🏢", title: "Private Jobs" },
  { id: "internships", emoji: "🎓", title: "Internships & Apprenticeships" },
  { id: "scholarships", emoji: "🏅", title: "Scholarships" },
  { id: "skill_trends", emoji: "📈", title: "Skill Trends" },
  { id: "career_growth", emoji: "🚀", title: "Career Growth" },
  { id: "ai_news", emoji: "🤖", title: "AI Updates" },
  { id: "tech_news", emoji: "💻", title: "Technology News" },
  { id: "business_news", emoji: "💼", title: "Business News" },
  { id: "govt_schemes", emoji: "📋", title: "Government Schemes" },
  { id: "salary_insights", emoji: "💰", title: "Salary Insights" },
  { id: "interview_qs", emoji: "🎯", title: "Interview Questions" },
  { id: "english_corner", emoji: "🇬🇧", title: "English Learning Corner" },
  { id: "vocab", emoji: "📖", title: "Daily Vocabulary" },
  { id: "quiz", emoji: "❓", title: "Daily Quiz" },
  { id: "jokes", emoji: "😄", title: "Daily Jokes" },
  { id: "success_stories", emoji: "⭐", title: "Success Stories" },
  { id: "motivation", emoji: "🔆", title: "Motivation Corner" },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

const VACANCY_SECTIONS = new Set<SectionId>([
  "top_jobs", "govt_jobs", "private_jobs", "internships", "scholarships",
]);

type FilterTabId = "all" | "jobs" | "career" | "news" | "english" | "inspire";

const SECTION_CATEGORIES: Record<FilterTabId, SectionId[]> = {
  all: [],
  jobs: ["top_jobs", "govt_jobs", "private_jobs", "internships", "scholarships"],
  career: ["skill_trends", "career_growth", "salary_insights", "govt_schemes"],
  news: ["ai_news", "tech_news", "business_news"],
  english: ["english_corner", "vocab", "quiz", "interview_qs"],
  inspire: ["success_stories", "motivation", "jokes"],
};

const FILTER_TABS: { id: FilterTabId; label: string; emoji: string }[] = [
  { id: "all", label: "All", emoji: "🗂️" },
  { id: "jobs", label: "Jobs", emoji: "💼" },
  { id: "career", label: "Career", emoji: "🚀" },
  { id: "news", label: "News", emoji: "📰" },
  { id: "english", label: "English", emoji: "🇬🇧" },
  { id: "inspire", label: "Inspire", emoji: "⭐" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Gujarat", "Haryana",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha",
  "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh",
  "West Bengal", "Jharkhand", "Chhattisgarh", "Uttarakhand",
];

const INDUSTRIES = [
  "Technology / IT", "Banking / Finance", "Healthcare", "Education",
  "Manufacturing", "Government / Public Sector", "Retail / E-commerce",
  "Media / Entertainment", "Agriculture", "Construction",
];

const WORK_MODES = [
  { value: "all", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const SECTORS = [
  { value: "all", label: "Any" },
  { value: "government", label: "Government" },
  { value: "private", label: "Private" },
  { value: "startup", label: "Startup" },
];

const EXPERIENCES = [
  { value: "all", label: "Any" },
  { value: "fresher", label: "Fresher" },
  { value: "junior", label: "Junior (1-3 yrs)" },
  { value: "mid", label: "Mid (3-6 yrs)" },
  { value: "senior", label: "Senior (6+ yrs)" },
];

const EMPLOYMENT_TYPES = [
  { value: "all", label: "Any" },
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "contract", label: "Contract" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "salary", label: "Salary (high to low)" },
  { value: "match", label: "Match Score" },
];

// ─── Profile type ─────────────────────────────────────────────────────────────

type Profile = {
  name: string;
  age: string;
  education: string;
  status: string;
  skills: string;
  salaryExpectation: string;
  careerGoal: string;
  language: string;
  location: string;
  industry: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "",
  age: "22",
  education: "Graduate",
  status: "Fresher",
  skills: "Communication, MS Excel",
  salaryExpectation: "₹3-5 LPA",
  careerGoal: "Private Job",
  language: "English",
  location: "Maharashtra",
  industry: "Technology",
};

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-blue-100 text-blue-700 border-blue-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

// ─── Job card component ────────────────────────────────────────────────────────

function JobCard({
  item,
  onSave,
  onUnsave,
  onShare,
  onHide,
  saved,
  matchScore,
}: {
  item: EnrichedJob;
  onSave: (item: RozgarLiveItem) => void;
  onUnsave: (jobId: string) => void;
  onShare: (item: EnrichedJob) => void;
  onHide: (jobId: string) => void;
  saved: boolean;
  matchScore?: number;
}) {
  return (
    <div className="block rounded-xl border bg-card hover:border-primary/30 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {matchScore !== undefined && (
                <Badge variant="outline" className={`rounded-full text-[10px] font-bold ${scoreColor(matchScore)}`}>
                  {matchScore}% Match
                </Badge>
              )}
              {item.workMode !== "unknown" && (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {item.workMode === "remote" ? "Remote" : item.workMode === "hybrid" ? "Hybrid" : "On-site"}
                </Badge>
              )}
              {item.sector !== "unknown" && (
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {item.sector === "government" ? "Govt" : item.sector === "startup" ? "Startup" : "Private"}
                </Badge>
              )}
            </div>
            <p className="font-semibold text-secondary line-clamp-2 text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {item.company ? `${item.company} • ` : ""}
              {item.location ? `${item.location} • ` : ""}
              {item.source}
              {item.publishedAt ? ` • ${new Date(item.publishedAt).toLocaleDateString("en-IN")}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
          {item.jobType && <span className="rounded-full bg-muted px-2 py-0.5 border">{item.jobType}</span>}
          {item.salary && <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5 border">{item.salary}</span>}
          {item.experience !== "unknown" && (
            <span className="rounded-full bg-muted px-2 py-0.5 border capitalize">{item.experience}</span>
          )}
          {item.employmentType !== "unknown" && (
            <span className="rounded-full bg-muted px-2 py-0.5 border capitalize">{item.employmentType}</span>
          )}
          {item.requiredSkills.slice(0, 3).map(skill => (
            <span key={skill} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 border">{skill}</span>
          ))}
        </div>
        {item.summary && <p className="mt-3 text-xs text-secondary line-clamp-2">{item.summary}</p>}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <a href={item.link} target="_blank" rel="noreferrer" className="flex-1">
          <Button variant="default" size="sm" className="w-full text-xs font-semibold h-9 rounded-lg">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Apply / View
          </Button>
        </a>
        <Button
          variant={saved ? "secondary" : "outline"}
          size="sm"
          className={`min-h-11 min-w-11 p-0 rounded-lg shrink-0 ${saved ? "text-primary" : ""}`}
          onClick={e => {
            e.preventDefault();
            if (saved) onUnsave(item.jobId);
            else onSave(item);
          }}
          title={saved ? "Unsave job" : "Save job"}
        >
          {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11 p-0 rounded-lg shrink-0"
          onClick={e => {
            e.preventDefault();
            onShare(item);
          }}
          title="Share job"
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11 p-0 rounded-lg shrink-0"
          onClick={e => {
            e.preventDefault();
            onHide(item.jobId);
          }}
          title="Hide job"
        >
          <EyeOff className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  profile,
  studentProfile,
  synth,
  onSaveJob,
  onUnsaveJob,
  onShare,
  onHide,
  isJobSaved,
  hiddenJobIds,
}: {
  section: typeof SECTIONS[number];
  profile: Profile;
  studentProfile: StudentProfile;
  synth: ReturnType<typeof useSpeechSynthesis>;
  onSaveJob: (item: RozgarLiveItem) => void;
  onUnsaveJob: (jobId: string) => void;
  onShare: (job: EnrichedJob) => void;
  onHide: (jobId: string) => void;
  isJobSaved: (jobId: string) => boolean;
  hiddenJobIds: Set<string>;
}) {
  const { save } = useHistory();
  const { track } = useProgress();
  const { text, isStreaming, stream } = useGeminiStream();
  const { data: liveData, isLoading: liveLoading, error: liveError, load: loadLive } = useRozgarLive();
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (loaded && !isStreaming) {
      setExpanded(e => !e);
      return;
    }
    setExpanded(true);
    setLoaded(true);
    track("Rozgar Samachar", section.id);

    const profileCtx = [
      `Name: ${profile.name || "Indian professional"}`,
      `Age: ${profile.age}`,
      `Education: ${profile.education}`,
      `Status: ${profile.status}`,
      `Skills: ${profile.skills}`,
      `Salary expectation: ${profile.salaryExpectation}`,
      `Goal: ${profile.careerGoal}`,
      `Location: ${profile.location}`,
      `Industry: ${profile.industry}`,
    ].join(" | ");

    const prompts: Record<SectionId, string> = {
      top_jobs: `Create a commercial career bulletin with 5 active-looking opportunities in India today for this profile: ${profileCtx}. Include role, employer type, city, salary range, skills match, and a short apply-now note.`,
      govt_jobs: `Create a government-job digest with 5 active-looking opportunities in India relevant to: ${profileCtx}. Include exam name, vacancies, last date, eligibility, and the best official application path.`,
      private_jobs: `Create a private-sector hiring digest with 5 active-looking job openings in India relevant to: ${profileCtx}. Include company type, role, CTC band, skills needed, and why each role fits this candidate.`,
      internships: `Create 5 internship/apprenticeship opportunities in India for: ${profileCtx}. Include organization type, stipend, duration, preferred skills, and how to apply.`,
      scholarships: `Create 5 active-looking scholarships in India for: ${profileCtx}. Include scholarship name, amount, eligibility, deadline, and who should apply.`,
      skill_trends: `Write a market-style skills watch for India's ${profile.industry} industry right now. Focus on the 5 most in-demand skills and how ${profile.status} in ${profile.location} can build them fast.`,
      career_growth: `Give a personalized 3-step career growth plan for: ${profileCtx}. Include specific actions, timelines, outcomes, and a realistic salary progression path.`,
      ai_news: `Summarize 3 important AI developments this week relevant to jobs and careers in India. Explain in ${profile.language} with practical impact on hiring.`,
      tech_news: `Summarize 3 technology news stories relevant to careers and jobs in India. Write in ${profile.language} with a practical newsroom tone.`,
      business_news: `Summarize 3 business news stories relevant to job seekers in India. Write in ${profile.language} and focus on hiring, growth, and salary impact.`,
      govt_schemes: `List 3 government schemes in India that can benefit: ${profileCtx}. Include scheme name, benefits, eligibility, how to apply.`,
      salary_insights: `Explain current salary ranges for ${profile.careerGoal} in ${profile.industry} in ${profile.location}. Give fresher, mid, senior levels and compare 2-3 cities.`,
      interview_qs: `Give 5 common interview questions for ${profile.careerGoal} in ${profile.industry} with ideal answers. Tailor for ${profile.status}.`,
      english_corner: `Write a short English lesson for ${profile.status} in India who speaks ${profile.language}. Include a grammar tip, 5 useful phrases, and a practice exercise.`,
      vocab: `Give 5 English words every ${profile.status} in ${profile.industry} should know. Include meaning in ${profile.language} and a job-market example sentence.`,
      quiz: `Create a 5-question quiz testing knowledge relevant to ${profile.industry} careers. Include answers and explanations. Language: ${profile.language}.`,
      jokes: `Share 3 light-hearted workplace or career jokes relevant to Indian professionals. Keep them clean and funny. Language: ${profile.language}.`,
      success_stories: `Share a motivating success story of an Indian professional from ${profile.industry} who started as a ${profile.status} from ${profile.location}. Make it realistic and inspiring.`,
      motivation: `Write a powerful motivational message in ${profile.language} for a ${profile.status} in ${profile.location} pursuing ${profile.careerGoal}. Include a daily action tip and one practical next step.`,
    };

    const live = await loadLive(section.id, profile);
    if (VACANCY_SECTIONS.has(section.id)) {
      setLoaded(true);
      return;
    }

    const liveContext = live?.items?.length
      ? [
          `Live sources fetched at ${new Date(live.fetchedAt).toLocaleString("en-IN")}.`,
          ...live.items.slice(0, 5).map((item, index) => {
            const published = item.publishedAt ? ` | ${new Date(item.publishedAt).toLocaleDateString("en-IN")}` : "";
            return `${index + 1}. ${item.title} — ${item.source}${published}`;
          }),
        ].join("\n")
      : "No live items were available. Write a concise fallback summary only.";

    const prompt = `${prompts[section.id]}\n\nGround the summary in these live items:\n${liveContext}`;
    await stream(
      prompt,
      `You are India's best career journalist writing the "${section.title}" section. Be specific, practical, and actionable. Today's date: ${new Date().toLocaleDateString("en-IN")}.`
    );
  }, [loadLive, loaded, isStreaming, profile, section, stream, track]);

  const visibleLiveItems = (liveData?.items ?? []).filter(item => !hiddenJobIds.has(makeJobId(item.link)));

  return (
    <Card className="overflow-hidden border shadow-sm rounded-2xl">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/60 transition-colors"
        onClick={load}
        data-testid={`section-${section.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{section.emoji}</span>
          <span className="font-semibold text-secondary truncate">{section.title}</span>
          {isStreaming && <Loader2 className="w-4 h-4 animate-spin text-primary ml-2 shrink-0" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (VACANCY_SECTIONS.has(section.id) ? (liveLoading || visibleLiveItems.length > 0 || Boolean(liveError)) : (text || isStreaming || liveLoading || visibleLiveItems.length > 0 || Boolean(liveError))) && (
        <CardContent className="px-5 pb-5 pt-0 border-t bg-muted/20">
          {(liveLoading || visibleLiveItems.length > 0 || liveError) && (
            <div className="mb-4 rounded-2xl border bg-background p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Live source</p>
                {liveLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
              {liveError && <p className="text-xs text-muted-foreground mb-3">{liveError}</p>}
              <div className="space-y-3">
                {visibleLiveItems.slice(0, 4).map(item => {
                  const enriched = enrichJob(item);
                  return (
                    <JobCard
                      key={`${item.title}-${item.link}`}
                      item={enriched}
                      onSave={onSaveJob}
                      onUnsave={onUnsaveJob}
                      onShare={onShare}
                      onHide={onHide}
                      saved={isJobSaved(makeJobId(item.link))}
                      matchScore={computeMatchScore(enriched, studentProfile)}
                    />
                  );
                })}
              </div>
            </div>
          )}
          {!VACANCY_SECTIONS.has(section.id) && (
            <div className="flex justify-end gap-2 py-2 flex-wrap">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => synth.speak(text, profile.language)}>
                <Volume2 className="w-3.5 h-3.5 mr-1" />Listen
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" disabled={saved}
                onClick={() => { save({ tool: "Rozgar Samachar", title: `${section.title} — ${new Date().toLocaleDateString("en-IN")}`, content: text }); setSaved(true); }}>
                {saved
                  ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" />Saved</>
                  : <><Bookmark className="w-3.5 h-3.5 mr-1" />Save</>}
              </Button>
            </div>
          )}
          {!VACANCY_SECTIONS.has(section.id) && (
            <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{text}</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Saved job card ───────────────────────────────────────────────────────────

function SavedJobCard({ job, onUnsave }: { job: SavedJob; onUnsave: (id: string) => void }) {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-secondary text-sm line-clamp-2">{job.title}</p>
          {job.company && <p className="text-xs text-muted-foreground mt-0.5">{job.company}</p>}
        </div>
        <button
          onClick={() => onUnsave(job.jobId)}
          className="shrink-0 p-2 min-h-11 min-w-11 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors flex items-center justify-center"
          title="Remove"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        {job.location && <span className="rounded-full bg-muted px-2 py-0.5">{job.location}</span>}
        {job.salary && <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5">{job.salary}</span>}
        {job.jobType && <span className="rounded-full bg-muted px-2 py-0.5">{job.jobType}</span>}
        {job.source && <span className="rounded-full bg-muted px-2 py-0.5">{job.source}</span>}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Saved {new Date(job.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </div>
      <a href={job.link} target="_blank" rel="noreferrer" className="block">
        <Button size="sm" className="w-full text-xs font-semibold h-8 rounded-lg">
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Apply Now
        </Button>
      </a>
    </div>
  );
}

// ─── Filter panel content ──────────────────────────────────────────────────────

function FilterPanelInner({
  filters,
  onChange,
  onClear,
  hasSalaryData,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onClear: () => void;
  hasSalaryData: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-secondary flex items-center gap-2"><Filter className="w-4 h-4" />Filters</h3>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>Clear all</Button>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-bold text-muted-foreground">City / State</span>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="e.g. Bangalore, Delhi"
            value={filters.city}
            onChange={e => onChange({ city: e.target.value })}
            className="pl-9 h-10 text-sm rounded-xl"
          />
        </div>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Work Mode</span>
        <Select value={filters.workMode} onValueChange={v => onChange({ workMode: v as FilterState["workMode"] })}>
          <SelectTrigger className="h-10 text-sm rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{WORK_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Sector</span>
        <Select value={filters.sector} onValueChange={v => onChange({ sector: v as FilterState["sector"] })}>
          <SelectTrigger className="h-10 text-sm rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Experience</span>
        <Select value={filters.experience} onValueChange={v => onChange({ experience: v as FilterState["experience"] })}>
          <SelectTrigger className="h-10 text-sm rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPERIENCES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>

      <label className="block space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Employment Type</span>
        <Select value={filters.employmentType} onValueChange={v => onChange({ employmentType: v as FilterState["employmentType"] })}>
          <SelectTrigger className="h-10 text-sm rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>{EMPLOYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>

      <div className="block space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${hasSalaryData ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
            Salary Range
          </span>
          {!hasSalaryData && (
            <span className="text-[10px] text-muted-foreground/50 italic">No salary data in results</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SALARY_BANDS.map(band => {
            const isActive = (filters.salaryBand ?? "any") === band.value;
            const disabled = !hasSalaryData && band.value !== "any";
            return (
              <button
                key={band.value}
                onClick={() => !disabled && onChange({ salaryBand: band.value as SalaryBand })}
                disabled={disabled}
                className={[
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : disabled
                    ? "bg-muted/40 text-muted-foreground/40 border-border/40 cursor-not-allowed"
                    : "bg-background text-foreground border-border hover:bg-muted",
                ].join(" ")}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterPanel(props: { filters: FilterState; onChange: (patch: Partial<FilterState>) => void; onClear: () => void; hasSalaryData: boolean }) {
  return <FilterPanelInner {...props} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RozgarSamachar() {
  return (
    <>
      <PageMeta
        title="Rozgar Samachar"
        description="Your daily career newspaper with live jobs, government updates, salary insights, and English learning tips for Indian professionals."
      />
      <RozgarSamacharContent />
    </>
  );
}

function RozgarSamacharContent() {
  const synth = useSpeechSynthesis();
  const { toast } = useToast();
  const { profile: studentProfile, updateProfile: updateStudentProfile } = useStudentProfile();
  const { saveJob, unsaveJob, isJobSaved, savedJobs, count: savedCount } = useSavedJobs();

  const derivedDefault = useMemo<Profile>(() => ({
    name: studentProfile.name || DEFAULT_PROFILE.name,
    age: DEFAULT_PROFILE.age,
    education: studentProfile.degree || DEFAULT_PROFILE.education,
    status: studentProfile.experienceLevel || DEFAULT_PROFILE.status,
    skills: Array.isArray(studentProfile.skills) && studentProfile.skills.length > 0
      ? studentProfile.skills.join(", ")
      : DEFAULT_PROFILE.skills,
    salaryExpectation: studentProfile.expectedSalary || DEFAULT_PROFILE.salaryExpectation,
    careerGoal: studentProfile.careerGoal || DEFAULT_PROFILE.careerGoal,
    language: studentProfile.preferredLanguage || DEFAULT_PROFILE.language,
    location: studentProfile.preferredCity || studentProfile.location || DEFAULT_PROFILE.location,
    industry: studentProfile.industryPreference || DEFAULT_PROFILE.industry,
  }), [studentProfile]);

  const [profile, setProfile] = useState<Profile>(derivedDefault);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Profile gate — shown on first visit if both name AND location are not set
  const [gateComplete, setGateComplete] = useState(() => {
    try { return !!localStorage.getItem("rozgar_gate_done"); } catch { return false; }
  });
  const [gateName, setGateName] = useState("");
  const [gateCity, setGateCity] = useState("");
  const [gateGoal, setGateGoal] = useState("Private Job");
  const [gateExp, setGateExp] = useState("Fresher");
  // Gate shows whenever real profile is incomplete — ignore localStorage flag
  const hasValidProfile = !!(
    profile.name && profile.name.trim().length > 1 && profile.name !== "Anonymous" &&
    profile.location && profile.location.trim().length > 1
  );
  const needsGate = !hasValidProfile;
  const [activeTab, setActiveTab] = useState<"jobs" | "feed" | "saved">("jobs");
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTabId>("all");
  const [hiddenJobIds, setHiddenJobIds] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<FilterState>(() => readFiltersFromUrl());
  const [searchInput, setSearchInput] = useState(filters.keyword);
  const [filterOpen, setFilterOpen] = useState(false);

  const hasFilters = !!(
    filters.keyword.trim() ||
    filters.city.trim() ||
    filters.workMode !== "all" ||
    filters.sector !== "all" ||
    filters.experience !== "all" ||
    filters.employmentType !== "all" ||
    (filters.salaryBand && filters.salaryBand !== "any")
  );

  const { data: allJobs, isLoading: jobsLoading, error: jobsError, reload, source: jobsSource } = useRozgarJobs(studentProfile, filters.keyword, hasFilters);
  const {
    data: livePulse,
    isLoading: livePulseLoading,
    error: livePulseError,
    load: loadLivePulse,
  } = useRozgarLive();

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    setProfile(p => ({
      name: studentProfile.name || p.name,
      age: p.age,
      education: studentProfile.degree || p.education,
      status: studentProfile.experienceLevel || p.status,
      skills: Array.isArray(studentProfile.skills) && studentProfile.skills.length > 0
        ? studentProfile.skills.join(", ")
        : p.skills,
      salaryExpectation: studentProfile.expectedSalary || p.salaryExpectation,
      careerGoal: studentProfile.careerGoal || p.careerGoal,
      language: studentProfile.preferredLanguage || p.language,
      location: studentProfile.preferredCity || studentProfile.location || p.location,
      industry: studentProfile.industryPreference || p.industry,
    }));
  }, [studentProfile]);

  useEffect(() => {
    if (hasFilters) void loadLivePulse("top_jobs", profile);
  }, [
    hasFilters,
    loadLivePulse,
    profile.location,
    profile.careerGoal,
    profile.status,
    profile.industry,
  ]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("q", filters.keyword);
    if (filters.city) params.set("city", filters.city);
    if (filters.workMode !== "all") params.set("workMode", filters.workMode);
    if (filters.sector !== "all") params.set("sector", filters.sector);
    if (filters.experience !== "all") params.set("experience", filters.experience);
    if (filters.employmentType !== "all") params.set("type", filters.employmentType);
    if ((filters.salaryBand ?? "any") !== "any") params.set("salaryBand", filters.salaryBand);
    if (filters.sort !== "relevance") params.set("sort", filters.sort);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [filters]);

  // Debounce keyword input into filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => f.keyword === searchInput ? f : { ...f, keyword: searchInput });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const enrichedJobs = useMemo(() => allJobs.map(enrichJob), [allJobs]);
  const filteredJobs = useMemo(() => filterJobs(enrichedJobs, filters, studentProfile).filter(j => !hiddenJobIds.has(j.jobId)), [enrichedJobs, filters, studentProfile, hiddenJobIds]);

  // Source breakdown for the "X verified listings · Y from Adzuna · Z from news" summary
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allJobs) {
      const src = item.source || "Other";
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return counts;
  }, [allJobs]);

  const visibleLivePulse = useMemo(() => (livePulse?.items ?? []).filter(item => !hiddenJobIds.has(makeJobId(item.link))).slice(0, 3), [livePulse, hiddenJobIds]);

  const update = (key: keyof Profile) => (val: string) => setProfile(p => ({ ...p, [key]: val }));

  const handleSaveJob = useCallback((item: RozgarLiveItem) => {
    const jobId = makeJobId(item.link);
    void saveJob({ jobId, title: item.title, company: item.company, link: item.link, location: item.location, salary: item.salary, jobType: item.jobType, source: item.source });
  }, [saveJob]);

  const handleUnsaveJob = useCallback((jobId: string) => {
    void unsaveJob(jobId);
  }, [unsaveJob]);

  const handleShare = useCallback((job: EnrichedJob) => {
    const url = job.link;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied!", description: "You can share this job with friends." });
    }).catch(() => {
      toast({ title: "Could not copy", description: "Please copy the link manually.", variant: "destructive" });
    });
  }, [toast]);

  const handleHide = useCallback((jobId: string) => {
    setHiddenJobIds(prev => new Set([...prev, jobId]));
    toast({ title: "Hidden", description: "This job will not appear in your current session." });
  }, [toast]);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput("");
  }, []);

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters(f => ({ ...f, ...patch }));
  }, []);

  const activeCount = activeFilterCount(filters);

  // True when at least one job in the current result set has salary data — used to enable/grey the salary filter
  const hasSalaryData = useMemo(() => enrichedJobs.some(j => j.salaryMin > 0 || j.salaryMax > 0), [enrichedJobs]);

  // Filter panel for desktop sidebar
  const filterSidebar = (
    <div className="hidden lg:block">
      <Card className="rounded-2xl border shadow-sm sticky top-20">
        <CardContent className="p-5">
          <FilterPanel filters={filters} onChange={updateFilters} onClear={clearFilters} hasSalaryData={hasSalaryData} />
        </CardContent>
      </Card>
    </div>
  );

  // Mobile filter sheet
  const filterSheet = (
    <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden rounded-full font-semibold">
          <SlidersHorizontal className="w-4 h-4 mr-1.5" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Filter jobs</SheetTitle>
        </SheetHeader>
        <div className="py-4">
          <FilterPanel filters={filters} onChange={updateFilters} onClear={clearFilters} hasSalaryData={hasSalaryData} />
        </div>
        <SheetClose asChild>
          <Button className="w-full mt-2">Show {filteredJobs.length} jobs</Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );

  // ── Profile gate ─────────────────────────────────────────────────────────────
  if (needsGate) {
    const handleGateSubmit = () => {
      if (!gateName.trim() || !gateCity) return;
      // Persist to local component state
      setProfile(p => ({ ...p, name: gateName.trim(), location: gateCity, careerGoal: gateGoal, status: gateExp }));
      // Persist to durable student profile store (survives page refresh)
      void updateStudentProfile({
        name: gateName.trim(),
        preferredCity: gateCity,
        location: gateCity,
        careerGoal: gateGoal,
        experienceLevel: gateExp,
      });
      setProfileSaved(true);
      setGateComplete(true);
      try { localStorage.setItem("rozgar_gate_done", "1"); } catch { /* ignore */ }
      void reload();
    };
    return (
      <div className="rozgar-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-indigo-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Newspaper className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-display font-extrabold text-secondary mb-2">Welcome to Rozgar Samachar</h1>
            <p className="text-muted-foreground text-sm">Tell us a bit about yourself so we can show you <strong>personalised</strong> jobs and opportunities across India.</p>
          </div>
          <Card className="border-teal-100 shadow-md rounded-2xl">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="gate-name" className="text-xs font-bold text-secondary">Your Name <span className="text-red-500">*</span></label>
                <Input id="gate-name" value={gateName} onChange={e => setGateName(e.target.value)} placeholder="e.g. Rahul Sharma" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="gate-city" className="text-xs font-bold text-secondary">State / City <span className="text-red-500">*</span></label>
                <Select value={gateCity} onValueChange={setGateCity}>
                  <SelectTrigger id="gate-city" className="h-11 rounded-xl"><SelectValue placeholder="Select your state or city" /></SelectTrigger>
                  <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="gate-goal" className="text-xs font-bold text-secondary">Career Goal</label>
                <Select value={gateGoal} onValueChange={setGateGoal}>
                  <SelectTrigger id="gate-goal" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Government Job", "Private Job", "IT / Tech", "Startup", "Business", "Higher Education", "Foreign Opportunity"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="gate-exp" className="text-xs font-bold text-secondary">Experience Level</label>
                <Select value={gateExp} onValueChange={setGateExp}>
                  <SelectTrigger id="gate-exp" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Student", "Fresher", "Working Professional (1-3 yrs)", "Working Professional (3-6 yrs)", "Senior Professional (6+ yrs)"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button
                className="w-full h-11 font-bold rounded-xl mt-2"
                disabled={!gateName.trim() || !gateCity}
                onClick={handleGateSubmit}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Show My Personalised Jobs →
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">Your data stays on your device. We use it only to personalise your feed.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="rozgar-theme min-h-full overflow-y-auto container mx-auto px-4 py-4 max-w-[1400px] bg-gradient-to-br from-teal-50/50 via-white to-indigo-50/50">
      <div className="flex min-h-full flex-col gap-4">
        {/* ── Sticky profile + filter bar ── */}
        <div className="sticky top-16 z-20 -mx-4 px-4 py-2 bg-white/95 backdrop-blur-sm border-b flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-secondary truncate shrink-0">{profile.name || "Guest"}</span>
          <span className="text-muted-foreground/40 shrink-0">•</span>
          <div className="relative shrink-0">
            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="City"
              value={filters.city}
              onChange={e => updateFilters({ city: e.target.value })}
              className="h-7 text-xs pl-6 w-[100px] rounded-full border border-dashed border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Select value={filters.sector} onValueChange={v => updateFilters({ sector: v as FilterState["sector"] })}>
            <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed shrink-0"><SelectValue placeholder="Sector" /></SelectTrigger>
            <SelectContent>{SECTORS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.experience} onValueChange={v => updateFilters({ experience: v as FilterState["experience"] })}>
            <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed shrink-0"><SelectValue placeholder="Experience" /></SelectTrigger>
            <SelectContent>{EXPERIENCES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.workMode} onValueChange={v => updateFilters({ workMode: v as FilterState["workMode"] })}>
            <SelectTrigger className="h-7 text-xs w-[110px] rounded-full border-dashed shrink-0"><SelectValue placeholder="Work Mode" /></SelectTrigger>
            <SelectContent>{WORK_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 rounded-full shrink-0" onClick={clearFilters}>Clear</Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 ml-auto rounded-full shrink-0" onClick={() => setShowProfile(!showProfile)}>
            <Settings className="w-3 h-3 mr-1" />Profile
          </Button>
        </div>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-100 text-teal-700 rounded-2xl flex items-center justify-center shadow-sm">
              <Newspaper className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-extrabold text-secondary">Rozgar Samachar</h1>
              <p className="text-xs text-muted-foreground font-medium">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {profileSaved && <Badge variant="outline" className="text-xs rounded-full px-3 py-1">Profile ready</Badge>}
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-5 lg:grid-cols-[280px_1fr]">
          {/* ── Left rail ── */}
          <aside className="flex min-h-0 flex-col gap-4">
            {showProfile ? (
              <Card className="border-primary/20 bg-primary/3 shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Your Career Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Name</span>
                      <Input value={profile.name} onChange={e => update("name")(e.target.value)} placeholder="Your name" className="h-10 text-sm rounded-xl" />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Age</span>
                      <Input type="number" min="15" max="55" value={profile.age} onChange={e => update("age")(e.target.value)} className="h-10 text-sm rounded-xl" />
                    </label>
                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-bold">Education</span>
                      <Select value={profile.education} onValueChange={update("education")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["10th Pass", "12th Pass", "Diploma", "Graduate", "Post-Graduate", "PhD"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Current Status</span>
                      <Select value={profile.status} onValueChange={update("status")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Student", "Fresher", "Working Professional", "Career Switcher", "Entrepreneur"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Career Goal</span>
                      <Select value={profile.careerGoal} onValueChange={update("careerGoal")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Government Job", "Private Job", "IT / Tech", "Startup", "Business", "Higher Education", "Foreign Opportunity"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-bold">Skills</span>
                      <Input value={profile.skills} onChange={e => update("skills")(e.target.value)} placeholder="Excel, communication, Java..." className="h-10 text-sm rounded-xl" />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Salary Expectation</span>
                      <Select value={profile.salaryExpectation} onValueChange={update("salaryExpectation")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{["₹2-3 LPA", "₹3-5 LPA", "₹5-8 LPA", "₹8-12 LPA", "₹12+ LPA"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">Language</span>
                      <Select value={profile.language} onValueChange={update("language")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="English">English</SelectItem>{INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold">State / Location</span>
                      <Select value={profile.location} onValueChange={update("location")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5 sm:col-span-2">
                      <span className="text-xs font-bold">Industry</span>
                      <Select value={profile.industry} onValueChange={update("industry")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowProfile(false)} className="rounded-full">Close</Button>
                    <Button size="sm" className="font-bold rounded-full" onClick={() => { setProfileSaved(true); setShowProfile(false); void reload(); }}>Save Profile</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-2xl border shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Candidate Snapshot</p>
                      <p className="font-bold text-secondary truncate">{profile.name || "Anonymous Candidate"}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1 shrink-0">{profile.careerGoal}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Location</p><p className="font-semibold text-secondary">{profile.location}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Salary</p><p className="font-semibold text-secondary">{profile.salaryExpectation}</p></div>
                    <div className="rounded-xl bg-muted/40 p-3 col-span-2"><p className="text-muted-foreground">Skills</p><p className="font-semibold text-secondary truncate">{profile.skills}</p></div>
                  </div>
                  <Button variant="outline" className="w-full rounded-full font-semibold" onClick={() => setShowProfile(true)}>Refine profile for better results</Button>
                </CardContent>
              </Card>
            )}

            <div className="rounded-2xl border bg-muted/30 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Today's brief</p>
              <p className="mt-1 text-sm text-secondary leading-relaxed">
                A personalized newspaper view built for {profile.status.toLowerCase()}s in {profile.location}. Focus on hiring, salary, and next-step actions.
              </p>
            </div>

            {savedCount > 0 && (
              <button onClick={() => setActiveTab("saved")} className="rounded-2xl border bg-primary/5 border-primary/20 p-4 shadow-sm w-full text-left hover:bg-primary/10 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-primary font-bold">Saved Jobs</p>
                    <p className="text-2xl font-display font-bold text-secondary mt-0.5">{savedCount}</p>
                    <p className="text-xs text-muted-foreground">jobs bookmarked</p>
                  </div>
                  <Briefcase className="w-8 h-8 text-primary/40" />
                </div>
              </button>
            )}
          </aside>

          {/* ── Right feed ── */}
          <section className="flex min-h-0 flex-col rounded-2xl border shadow-sm overflow-hidden bg-card">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-4 border-b overflow-x-auto">
              {[
                { id: "jobs", label: "Jobs Feed", icon: Search },
                { id: "feed", label: "Career Feed", icon: Newspaper },
                { id: "saved", label: "Saved Jobs", icon: Bookmark },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-secondary"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.id === "saved" && savedCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {savedCount > 9 ? "9+" : savedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "saved" && (
              <div className="flex-1 overflow-y-auto p-5">
                {savedJobs.length === 0 ? (
                  <div className="text-center py-16">
                    <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="font-semibold text-secondary">No saved jobs yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Click the bookmark icon on any job card to save it here.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("jobs")}>Browse Jobs</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-secondary">{savedCount} saved job{savedCount !== 1 ? "s" : ""}</p>
                      <Badge variant="secondary" className="text-xs">Tap to apply</Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {savedJobs.map(job => <SavedJobCard key={job.id} job={job} onUnsave={handleUnsaveJob} />)}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "jobs" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Search + controls */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by role, company, skills, or keyword"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="pl-9 h-11 text-sm rounded-xl"
                      />
                    </div>
                    <Select value={filters.sort} onValueChange={v => updateFilters({ sort: v as FilterState["sort"] })}>
                      <SelectTrigger className="h-11 text-sm rounded-xl w-full sm:w-[180px]">
                        <span className="text-muted-foreground mr-1">Sort:</span>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>{SORT_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {/* Source summary — shown once results are ready */}
                  {!jobsLoading && allJobs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-emerald-700 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {allJobs.length} verified listing{allJobs.length !== 1 ? "s" : ""}
                      </span>
                      {Object.entries(sourceCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([src, count]) => (
                          <span key={src} className="rounded-full bg-muted px-2 py-0.5 border">
                            {count} from {src}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Active filter chips */}
                  {activeCount > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {filters.city && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          <MapPin className="w-3 h-3" />{filters.city}
                          <button onClick={() => updateFilters({ city: "" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      {filters.workMode !== "all" && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          {filters.workMode}
                          <button onClick={() => updateFilters({ workMode: "all" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      {filters.sector !== "all" && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          {filters.sector}
                          <button onClick={() => updateFilters({ sector: "all" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      {filters.experience !== "all" && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          {filters.experience}
                          <button onClick={() => updateFilters({ experience: "all" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      {filters.employmentType !== "all" && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          {filters.employmentType}
                          <button onClick={() => updateFilters({ employmentType: "all" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      {(filters.salaryBand ?? "any") !== "any" && (
                        <Badge variant="secondary" className="rounded-full text-xs pl-2 pr-1 py-1 gap-1">
                          <IndianRupee className="w-3 h-3" />{SALARY_BANDS.find(b => b.value === filters.salaryBand)?.label ?? filters.salaryBand}
                          <button onClick={() => updateFilters({ salaryBand: "any" })} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                        </Badge>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>Clear all</Button>
                    </div>
                  )}
                </div>

                {/* Gate: prompt until filters are applied */}
                {!hasFilters ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Search className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-secondary text-lg">Search to find jobs</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                        Enter a job title, skill, or company above — or open <strong>Filters</strong> to narrow by location, experience, or sector.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)}>
                      Open Filters
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Live pulse */}
                    <div className="rounded-2xl border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live hiring pulse</p>
                          <p className="text-sm text-secondary">Fresh items from job APIs and official career pages.</p>
                        </div>
                        {livePulseLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => loadLivePulse("top_jobs", profile)}>
                          <Calendar className="w-3.5 h-3.5 mr-1" />Refresh
                        </Button>
                      </div>
                      {livePulseError && <p className="text-xs text-muted-foreground">{livePulseError}</p>}
                      {visibleLivePulse.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {visibleLivePulse.map(item => (
                            <JobCard
                              key={makeJobId(item.link)}
                              item={enrichJob(item)}
                              onSave={handleSaveJob}
                              onUnsave={handleUnsaveJob}
                              onShare={handleShare}
                              onHide={handleHide}
                              saved={isJobSaved(makeJobId(item.link))}
                              matchScore={computeMatchScore(enrichJob(item), studentProfile)}
                            />
                          ))}
                        </div>
                      ) : !livePulseLoading && !livePulseError ? (
                        <p className="text-xs text-muted-foreground">No live items yet — try refreshing.</p>
                      ) : null}
                    </div>

                    {/* Job results */}
                    {jobsLoading ? (
                      <div className="text-center py-16">
                        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          {filters.keyword ? `Searching live listings for "${filters.keyword}"…` : "Finding jobs for your filters…"}
                        </p>
                      </div>
                    ) : jobsError ? (
                      <div className="text-center py-16">
                        <p className="font-semibold text-secondary">Could not load jobs</p>
                        <p className="text-sm text-muted-foreground mt-1">{jobsError}</p>
                        <Button variant="outline" className="mt-4" onClick={() => reload()}>Try again</Button>
                      </div>
                    ) : filteredJobs.length === 0 ? (
                      <div className="text-center py-16">
                        <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="font-semibold text-secondary">No jobs match your filters</p>
                        <p className="text-sm text-muted-foreground mt-1">Try clearing filters or widening your search.</p>
                        <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear filters</Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <p className="text-sm text-muted-foreground">
                            {filteredJobs.length === allJobs.length
                              ? `${filteredJobs.length} job${filteredJobs.length !== 1 ? "s" : ""}`
                              : `${filteredJobs.length} of ${allJobs.length} jobs`}
                          </p>
                          {jobsSource === "search" && (
                            <Badge variant="outline" className="text-[10px] rounded-full text-emerald-700 border-emerald-200 bg-emerald-50">
                              🟢 Live results
                            </Badge>
                          )}
                          {jobsSource === "live" && (
                            <Badge variant="outline" className="text-[10px] rounded-full text-blue-700 border-blue-200 bg-blue-50">
                              📡 Live feed
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {filteredJobs.map(job => (
                            <JobCard
                              key={job.jobId}
                              item={job}
                              onSave={handleSaveJob}
                              onUnsave={handleUnsaveJob}
                              onShare={handleShare}
                              onHide={handleHide}
                              saved={isJobSaved(job.jobId)}
                              matchScore={job.matchScore}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "feed" && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="px-1 py-2">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Filter sections</p>
                  <div className="flex flex-wrap gap-2">
                    {FILTER_TABS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setActiveFilterTab(f.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          activeFilterTab === f.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {f.emoji} {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Career field tiles — only visible in Career tab ── */}
                {activeFilterTab === "career" && (
                  <div className="px-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2">Your Industry</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                      {INDUSTRIES.map(industry => (
                        <button
                          key={industry}
                          onClick={() => setProfile(p => ({ ...p, industry }))}
                          className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                            profile.industry === industry
                              ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                              : "bg-card text-secondary hover:bg-teal-50 hover:border-teal-300"
                          }`}
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  {SECTIONS.filter(s => activeFilterTab === "all" || SECTION_CATEGORIES[activeFilterTab].includes(s.id)).map(section => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      profile={profile}
                      studentProfile={studentProfile}
                      synth={synth}
                      onSaveJob={handleSaveJob}
                      onUnsaveJob={handleUnsaveJob}
                      onShare={handleShare}
                      onHide={handleHide}
                      isJobSaved={isJobSaved}
                      hiddenJobIds={hiddenJobIds}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

const VALID_WORK_MODES = new Set<FilterState["workMode"]>(["all", "remote", "hybrid", "onsite"]);
const VALID_SECTORS = new Set<FilterState["sector"]>(["all", "government", "private", "startup"]);
const VALID_EXPERIENCES = new Set<FilterState["experience"]>(["all", "fresher", "junior", "mid", "senior"]);
const VALID_EMPLOYMENT_TYPES = new Set<FilterState["employmentType"]>(["all", "full-time", "part-time", "internship", "contract"]);
const VALID_SORTS = new Set<FilterState["sort"]>(["relevance", "newest", "salary", "match"]);

function readFiltersFromUrl(): FilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const params = new URLSearchParams(window.location.search);
  const workMode = (params.get("workMode") as FilterState["workMode"]) || "all";
  const sector = (params.get("sector") as FilterState["sector"]) || "all";
  const experience = (params.get("experience") as FilterState["experience"]) || "all";
  const employmentType = (params.get("type") as FilterState["employmentType"]) || "all";
  const sort = (params.get("sort") as FilterState["sort"]) || "relevance";
  return {
    keyword: params.get("q") || "",
    city: params.get("city") || "",
    workMode: VALID_WORK_MODES.has(workMode) ? workMode : "all",
    sector: VALID_SECTORS.has(sector) ? sector : "all",
    experience: VALID_EXPERIENCES.has(experience) ? experience : "all",
    employmentType: VALID_EMPLOYMENT_TYPES.has(employmentType) ? employmentType : "all",
    salaryBand: (["any","0-3","3-6","6-12","12+"].includes(params.get("salaryBand") ?? "")) ? (params.get("salaryBand") as SalaryBand) : "any",
    sort: VALID_SORTS.has(sort) ? sort : "relevance",
  };
}
