import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useRozgarLive, type RozgarLiveItem } from "@/lib/use-rozgar-live";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useSavedJobs, type SavedJob } from "@/lib/use-saved-jobs";
import {
  Newspaper,
  Volume2,
  Bookmark,
  BookmarkCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Settings,
  Search,
  ExternalLink,
  X,
  Briefcase,
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

type FilterId = "all" | "jobs" | "career" | "news" | "english" | "inspire";

const SECTION_CATEGORIES: Record<FilterId, SectionId[]> = {
  all: [],
  jobs: ["top_jobs", "govt_jobs", "private_jobs", "internships", "scholarships"],
  career: ["skill_trends", "career_growth", "salary_insights", "govt_schemes"],
  news: ["ai_news", "tech_news", "business_news"],
  english: ["english_corner", "vocab", "quiz", "interview_qs"],
  inspire: ["success_stories", "motivation", "jokes"],
};

const FILTER_TABS: { id: FilterId; label: string; emoji: string }[] = [
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

// FNV-1a 32-bit hash over the FULL URL — collision-resistant for practical job list sizes
function makeJobId(link: string): string {
  let h = 2166136261;
  for (let i = 0; i < link.length; i++) {
    h ^= link.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h >>>= 0; // keep unsigned 32-bit
  }
  return `r${h.toString(36)}`;
}

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

// ─── Job card component ────────────────────────────────────────────────────────

function JobCard({
  item,
  onSave,
  onUnsave,
  saved,
}: {
  item: RozgarLiveItem;
  onSave: (item: RozgarLiveItem) => void;
  onUnsave: (jobId: string) => void;
  saved: boolean;
}) {
  const jobId = makeJobId(item.link);
  return (
    <div className="block rounded-xl border bg-muted/30 hover:bg-muted/60 transition-colors">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-secondary line-clamp-2 text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {item.company ? `${item.company} • ` : ""}
              {item.location ? `${item.location} • ` : ""}
              {item.source}
              {item.publishedAt ? ` • ${new Date(item.publishedAt).toLocaleDateString("en-IN")}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full shrink-0 text-[10px]">
            {item.remote ? "Remote" : item.kind === "vacancy" ? "Open" : item.kind === "news" ? "News" : "Update"}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          {item.jobType && <span className="rounded-full bg-background px-2 py-0.5 border">{item.jobType}</span>}
          {item.salary && <span className="rounded-full bg-background px-2 py-0.5 border text-green-700">{item.salary}</span>}
        </div>
        {item.summary && <p className="mt-2 text-xs text-secondary line-clamp-2">{item.summary}</p>}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3">
        <a
          href={item.link}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Button variant="default" size="sm" className="w-full text-xs font-semibold h-8 rounded-lg">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Apply / View
          </Button>
        </a>
        <Button
          variant={saved ? "secondary" : "outline"}
          size="sm"
          className={`h-8 w-8 p-0 rounded-lg shrink-0 ${saved ? "text-primary" : ""}`}
          onClick={e => {
            e.preventDefault();
            if (saved) onUnsave(jobId);
            else onSave(item);
          }}
          title={saved ? "Unsave job" : "Save job"}
          aria-label={saved ? "Unsave job" : "Save job"}
        >
          {saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  section,
  profile,
  synth,
  onSaveJob,
  onUnsaveJob,
  isJobSaved,
}: {
  section: typeof SECTIONS[number];
  profile: Profile;
  synth: ReturnType<typeof useSpeechSynthesis>;
  onSaveJob: (item: RozgarLiveItem) => void;
  onUnsaveJob: (jobId: string) => void;
  isJobSaved: (jobId: string) => boolean;
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
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (VACANCY_SECTIONS.has(section.id) ? (liveLoading || Boolean(liveData?.items?.length) || Boolean(liveError)) : (text || isStreaming || liveLoading || Boolean(liveData?.items?.length) || Boolean(liveError))) && (
        <CardContent className="px-5 pb-5 pt-0 border-t bg-muted/20">
          {(liveLoading || liveData?.items?.length || liveError) && (
            <div className="mb-4 rounded-2xl border bg-background p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Live source</p>
                {liveLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
              {liveError && <p className="text-xs text-muted-foreground mb-3">{liveError}</p>}
              <div className="space-y-3">
                {(liveData?.items ?? []).slice(0, 4).map((item: RozgarLiveItem) => (
                  <JobCard
                    key={`${item.title}-${item.link}`}
                    item={item}
                    onSave={onSaveJob}
                    onUnsave={onUnsaveJob}
                    saved={isJobSaved(makeJobId(item.link))}
                  />
                ))}
              </div>
            </div>
          )}
          {!VACANCY_SECTIONS.has(section.id) && (
            <div className="flex justify-end gap-2 py-2 flex-wrap">
              <Button variant="ghost" size="sm" className="text-xs"
                onClick={() => synth.speak(text, profile.language)}>
                <Volume2 className="w-3.5 h-3.5 mr-1" />Listen
              </Button>
              <Button variant="ghost" size="sm" className="text-xs" disabled={saved}
                onClick={() => {
                  save({ tool: "Rozgar Samachar", title: `${section.title} — ${new Date().toLocaleDateString("en-IN")}`, content: text });
                  setSaved(true);
                }}>
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
          className="shrink-0 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
          title="Remove"
          aria-label="Remove saved job"
        >
          <X className="w-3.5 h-3.5" />
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RozgarSamachar() {
  const synth = useSpeechSynthesis();
  const { profile: studentProfile } = useStudentProfile();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<keyof typeof SECTION_CATEGORIES>("all");
  const [activeTab, setActiveTab] = useState<"feed" | "saved">("feed");

  const {
    data: livePulse,
    isLoading: livePulseLoading,
    error: livePulseError,
    load: loadLivePulse,
  } = useRozgarLive();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

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
  }, [
    studentProfile.name, studentProfile.degree, studentProfile.experienceLevel,
    studentProfile.skills, studentProfile.expectedSalary, studentProfile.careerGoal,
    studentProfile.preferredLanguage, studentProfile.preferredCity,
    studentProfile.location, studentProfile.industryPreference,
  ]);

  const update = (key: keyof Profile) => (val: string) => setProfile(p => ({ ...p, [key]: val }));

  useEffect(() => { void loadLivePulse("top_jobs", profile); }, [loadLivePulse]);

  // Filter + search the section list
  const visibleSections = useMemo(() => {
    let sections = [...SECTIONS];
    if (activeFilter !== "all") {
      const allowed = new Set(SECTION_CATEGORIES[activeFilter]);
      sections = sections.filter(s => allowed.has(s.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      sections = sections.filter(s =>
        s.title.toLowerCase().includes(q) || s.id.replace(/_/g, " ").includes(q)
      );
    }
    return sections;
  }, [activeFilter, searchQuery]);

  // Save a live item as a job
  const handleSaveJob = useCallback((item: RozgarLiveItem) => {
    const jobId = makeJobId(item.link);
    void saveJob({
      jobId,
      title: item.title,
      company: item.company,
      link: item.link,
      location: item.location,
      salary: item.salary,
      jobType: item.jobType,
      source: item.source,
    });
  }, [saveJob]);

  const handleUnsaveJob = useCallback((jobId: string) => {
    void unsaveJob(jobId);
  }, [unsaveJob]);

  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-4 max-w-[1400px]">
      <div className="flex min-h-full flex-col gap-4">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
              <Newspaper className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-extrabold text-secondary">Rozgar Samachar</h1>
              <p className="text-xs text-muted-foreground font-medium">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs rounded-full px-3 py-1">
              <User className="w-3 h-3 mr-1" />
              {profile.name || "Anonymous"} • {profile.location}
            </Badge>
            {profileSaved && (
              <Badge variant="outline" className="text-xs rounded-full px-3 py-1">Profile ready</Badge>
            )}
            <Button
              variant="outline" size="sm"
              onClick={() => setShowProfile(!showProfile)}
              className="font-semibold rounded-full shadow-sm"
            >
              <Settings className="w-4 h-4 mr-1.5" />Profile
            </Button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-5 lg:grid-cols-[360px_1fr]">
          {/* ── Left rail ── */}
          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
            {showProfile ? (
              <Card className="border-primary/20 bg-primary/3 shadow-sm rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Your Career Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Name</label>
                      <Input value={profile.name} onChange={e => update("name")(e.target.value)} placeholder="Your name" className="h-10 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Age</label>
                      <Input type="number" min="15" max="55" value={profile.age} onChange={e => update("age")(e.target.value)} className="h-10 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold">Education</label>
                      <Select value={profile.education} onValueChange={update("education")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["10th Pass", "12th Pass", "Diploma", "Graduate", "Post-Graduate", "PhD"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Current Status</label>
                      <Select value={profile.status} onValueChange={update("status")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Student", "Fresher", "Working Professional", "Career Switcher", "Entrepreneur"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Career Goal</label>
                      <Select value={profile.careerGoal} onValueChange={update("careerGoal")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Government Job", "Private Job", "IT / Tech", "Startup", "Business", "Higher Education", "Foreign Opportunity"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold">Skills</label>
                      <Input value={profile.skills} onChange={e => update("skills")(e.target.value)} placeholder="Excel, communication, Java..." className="h-10 text-sm rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Salary Expectation</label>
                      <Select value={profile.salaryExpectation} onValueChange={update("salaryExpectation")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["₹2-3 LPA", "₹3-5 LPA", "₹5-8 LPA", "₹8-12 LPA", "₹12+ LPA"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Language</label>
                      <Select value={profile.language} onValueChange={update("language")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English">English</SelectItem>
                          {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">State / Location</label>
                      <Select value={profile.location} onValueChange={update("location")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-bold">Industry</label>
                      <Select value={profile.industry} onValueChange={update("industry")}>
                        <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setShowProfile(false)} className="rounded-full">Close</Button>
                    <Button size="sm" className="font-bold rounded-full"
                      onClick={() => { setProfileSaved(true); setShowProfile(false); void loadLivePulse("top_jobs", profile); }}>
                      Save Profile
                    </Button>
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
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-semibold text-secondary">{profile.location}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-muted-foreground">Salary</p>
                      <p className="font-semibold text-secondary">{profile.salaryExpectation}</p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 col-span-2">
                      <p className="text-muted-foreground">Skills</p>
                      <p className="font-semibold text-secondary truncate">{profile.skills}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-full font-semibold" onClick={() => setShowProfile(true)}>
                    Refine profile for better results
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="rounded-2xl border bg-muted/30 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Today's brief</p>
              <p className="mt-1 text-sm text-secondary leading-relaxed">
                A personalized newspaper view built for {profile.status.toLowerCase()}s in {profile.location}. Focus on hiring, salary, and next-step actions.
              </p>
            </div>

            {/* Saved jobs quick stats */}
            {savedCount > 0 && (
              <button
                onClick={() => setActiveTab("saved")}
                className="rounded-2xl border bg-primary/5 border-primary/20 p-4 shadow-sm w-full text-left hover:bg-primary/10 transition-colors"
              >
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
            <div className="flex items-center gap-1 px-4 pt-4 border-b">
              <button
                onClick={() => setActiveTab("feed")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === "feed"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-secondary"
                }`}
              >
                Career Feed
              </button>
              <button
                onClick={() => setActiveTab("saved")}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "saved"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-secondary"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Saved Jobs
                {savedCount > 0 && (
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {savedCount > 9 ? "9+" : savedCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "saved" ? (
              /* ── Saved Jobs view ── */
              <div className="flex-1 overflow-y-auto p-5">
                {savedJobs.length === 0 ? (
                  <div className="text-center py-16">
                    <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="font-semibold text-secondary">No saved jobs yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Click the bookmark icon on any job card to save it here.</p>
                    <Button variant="outline" className="mt-4" onClick={() => setActiveTab("feed")}>
                      Browse Jobs
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-semibold text-secondary">{savedCount} saved job{savedCount !== 1 ? "s" : ""}</p>
                      <Badge variant="secondary" className="text-xs">Tap to apply</Badge>
                    </div>
                    <div className="space-y-3">
                      {savedJobs.map(job => (
                        <SavedJobCard key={job.id} job={job} onUnsave={handleUnsaveJob} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* ── Career Feed view ── */
              <>
                <div className="px-5 py-4 border-b bg-gradient-to-r from-purple-50 to-background">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live Career Feed</p>
                      <p className="font-display text-xl font-bold text-secondary">Commercial, useful, candidate-focused updates</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {FILTER_TABS.slice(1, 4).map(f => (
                        <Badge key={f.id} variant="secondary" className="rounded-full">{f.label}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-5 py-4 border-b bg-primary/5">
                  <p className="text-sm text-secondary">
                    <span className="font-bold text-primary">Namaskar, {profile.name || "friend"}!</span>{" "}
                    Your personalized career newspaper is ready. Click any section below for India-focused market snapshots tailored to your profile.
                  </p>
                </div>

                {/* Live pulse */}
                <div className="px-5 py-4 border-b bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live hiring pulse</p>
                      <p className="text-sm text-secondary">Fresh items from Google News and official career pages.</p>
                    </div>
                    {livePulseLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  </div>
                  {livePulseError && <p className="mt-2 text-xs text-muted-foreground">{livePulseError}</p>}
                  {!livePulseLoading && livePulse?.items?.length ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {livePulse.items.slice(0, 3).map((item) => (
                        <JobCard
                          key={`${item.title}-${item.link}`}
                          item={item}
                          onSave={handleSaveJob}
                          onUnsave={handleUnsaveJob}
                          saved={isJobSaved(makeJobId(item.link))}
                        />
                      ))}
                    </div>
                  ) : !livePulseLoading && !livePulseError ? (
                    <p className="mt-2 text-xs text-muted-foreground">No live items yet — try saving your profile or opening a section.</p>
                  ) : null}
                </div>

                {/* Search + filter */}
                <div className="px-5 py-3 border-b bg-background space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search sections (e.g. government, salary, interview...)"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 text-sm rounded-xl"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-secondary"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {FILTER_TABS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as keyof typeof SECTION_CATEGORIES)}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                          activeFilter === f.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <span>{f.emoji}</span>{f.label}
                        {f.id !== "all" && (
                          <span className="text-[10px] opacity-70">
                            {SECTION_CATEGORIES[f.id]?.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {(searchQuery || activeFilter !== "all") && (
                    <p className="text-xs text-muted-foreground">
                      Showing {visibleSections.length} of {SECTIONS.length} sections
                      {searchQuery && ` matching "${searchQuery}"`}
                      {activeFilter !== "all" && ` in ${FILTER_TABS.find(f => f.id === activeFilter)?.label}`}
                    </p>
                  )}
                </div>

                {/* Sections list */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                  {visibleSections.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="font-semibold text-secondary">No sections found</p>
                      <p className="text-sm text-muted-foreground mt-1">Try a different keyword or filter</p>
                      <Button variant="ghost" className="mt-3 text-sm" onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}>
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    visibleSections.map(section => (
                      <SectionCard
                        key={section.id}
                        section={section}
                        profile={profile}
                        synth={synth}
                        onSaveJob={handleSaveJob}
                        onUnsaveJob={handleUnsaveJob}
                        isJobSaved={isJobSaved}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
