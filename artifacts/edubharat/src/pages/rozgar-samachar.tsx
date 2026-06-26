import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";

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

const VACANCY_SECTIONS = new Set<SectionId>([
  "top_jobs",
  "govt_jobs",
  "private_jobs",
  "internships",
  "scholarships",
]);

function SectionCard({
  section,
  profile,
  synth,
}: {
  section: typeof SECTIONS[number];
  profile: Profile;
  synth: ReturnType<typeof useSpeechSynthesis>;
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
      top_jobs: `Create a commercial career bulletin with 5 active-looking opportunities in India today for this profile: ${profileCtx}. Include role, employer type, city, salary range, skills match, and a short apply-now note. If exact vacancy data is uncertain, clearly label it as a market snapshot and not a guaranteed opening.`,
      govt_jobs: `Create a government-job digest with 5 active-looking opportunities in India relevant to: ${profileCtx}. Include exam name, vacancies, last date, eligibility, and the best official application path.`,
      private_jobs: `Create a private-sector hiring digest with 5 active-looking job openings in India relevant to: ${profileCtx}. Include company type, role, CTC band, skills needed, and why each role fits this candidate.`,
      internships: `Create 5 internship/apprenticeship opportunities in India for: ${profileCtx}. Include organization type, stipend, duration, preferred skills, and how to apply. Make it useful for a first-time candidate.`,
      scholarships: `Create 5 active-looking scholarships in India for: ${profileCtx}. Include scholarship name, amount, eligibility, deadline, and who should apply.`,
      skill_trends: `Write a market-style skills watch for India's ${profile.industry} industry right now. Focus on the 5 most in-demand skills and how ${profile.status} in ${profile.location} can build them fast.`,
      career_growth: `Give a personalized 3-step career growth plan for: ${profileCtx}. Include specific actions, timelines, outcomes, and a realistic salary progression path.`,
      ai_news: `Summarize 3 important AI developments this week relevant to jobs and careers in India. Explain in ${profile.language} in a newsroom style, with practical impact on hiring.`,
      tech_news: `Summarize 3 technology news stories relevant to careers and jobs in India. Write in ${profile.language} with a practical, commercial newsroom tone.`,
      business_news: `Summarize 3 business news stories relevant to job seekers and professionals in India. Write in ${profile.language} and focus on hiring, growth, and salary impact.`,
      govt_schemes: `List 3 government schemes in India that can benefit: ${profileCtx}. Include scheme name, benefits, eligibility, how to apply, and who should not miss it.`,
      salary_insights: `Explain current salary ranges for ${profile.careerGoal} in ${profile.industry} in ${profile.location}. Give fresher, mid, senior levels and compare 2-3 cities. Add a hiring-market note.`,
      interview_qs: `Give 5 common interview questions for ${profile.careerGoal} in ${profile.industry} with ideal answers. Tailor for ${profile.status} and keep the language natural.`,
      english_corner: `Write a short English lesson for ${profile.status} in India who speaks ${profile.language}. Include a grammar tip, 5 useful phrases, and a practice exercise for interviews and job calls.`,
      vocab: `Give 5 English words every ${profile.status} in ${profile.industry} should know. Include meaning in ${profile.language} and a job-market example sentence.`,
      quiz: `Create a 5-question quiz testing knowledge relevant to ${profile.industry} careers. Include answers and explanations. Language: ${profile.language}.`,
      jokes: `Share 3 light-hearted workplace or career jokes relevant to Indian professionals. Keep them clean and funny. Language: ${profile.language}.`,
      success_stories: `Share a motivating success story of an Indian professional from ${profile.industry} who started as a ${profile.status} from ${profile.location}. Make it realistic, specific, and inspiring.`,
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

    const prompt = `${prompts[section.id]}\n\nGround the summary in these live items:\n${liveContext}\n\nIf an item looks like a news report rather than a direct vacancy, say so clearly. Do not invent employers, dates, or openings that are not present in the live items.`;

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
                  <a
                    key={`${item.title}-${item.link}`}
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border bg-muted/30 p-3 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-secondary line-clamp-2">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.company ? `${item.company} • ` : ""}
                          {item.location ? `${item.location} • ` : ""}
                          {item.source}
                          {item.publishedAt ? ` • ${new Date(item.publishedAt).toLocaleDateString("en-IN")}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full shrink-0">
                        {item.remote ? "Remote" : "Open"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {item.jobType && <span className="rounded-full bg-background px-2 py-0.5 border">{item.jobType}</span>}
                      {item.kind && <span className="rounded-full bg-background px-2 py-0.5 border">{item.kind}</span>}
                    </div>
                    {item.summary && <p className="mt-2 text-xs text-secondary line-clamp-2">{item.summary}</p>}
                  </a>
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

export default function RozgarSamachar() {
  const synth = useSpeechSynthesis();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const {
    data: livePulse,
    isLoading: livePulseLoading,
    error: livePulseError,
    load: loadLivePulse,
  } = useRozgarLive();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const update = (key: keyof Profile) => (val: string) => setProfile(p => ({ ...p, [key]: val }));

  useEffect(() => {
    void loadLivePulse("top_jobs", profile);
  }, [loadLivePulse]);

  return (
    <div className="min-h-full overflow-y-auto container mx-auto px-4 py-4 max-w-[1400px]">
      <div className="flex min-h-full flex-col gap-4">
        {/* Header */}
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
              <Badge variant="outline" className="text-xs rounded-full px-3 py-1">
                Profile ready
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProfile(!showProfile)}
              className="font-semibold rounded-full shadow-sm"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Profile
            </Button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-5 lg:grid-cols-[360px_1fr]">
          {/* Left rail */}
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
                    <Button variant="outline" size="sm" onClick={() => setShowProfile(false)} className="rounded-full">
                      Close
                    </Button>
                    <Button
                      size="sm"
                      className="font-bold rounded-full"
                      onClick={() => {
                        setProfileSaved(true);
                        setShowProfile(false);
                        void loadLivePulse("top_jobs", profile);
                      }}
                    >
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
                    <Badge variant="outline" className="rounded-full px-3 py-1 shrink-0">
                      {profile.careerGoal}
                    </Badge>
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
                      <p className="font-semibold text-secondary">{profile.skills}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-full font-semibold" onClick={() => setShowProfile(true)}>
                    Refine profile for better results
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="rounded-2xl border bg-muted/30 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Today’s brief</p>
              <p className="mt-1 text-sm text-secondary leading-relaxed">
                A personalized newspaper view built for {profile.status.toLowerCase()}s in {profile.location}. Focus on hiring, salary, and next-step actions.
              </p>
            </div>
          </aside>

          {/* Right feed */}
          <section className="flex min-h-0 flex-col rounded-2xl border shadow-sm overflow-hidden bg-card">
            <div className="px-5 py-4 border-b bg-gradient-to-r from-purple-50 to-background">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live Career Feed</p>
                  <p className="font-display text-xl font-bold text-secondary">Commercial, useful, candidate-focused updates</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="rounded-full">Jobs</Badge>
                  <Badge variant="secondary" className="rounded-full">Salary</Badge>
                  <Badge variant="secondary" className="rounded-full">Skills</Badge>
                  <Badge variant="secondary" className="rounded-full">Interview prep</Badge>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-b bg-primary/5">
              <p className="text-sm text-secondary">
                <span className="font-bold text-primary">Namaskar, {profile.name || "friend"}!</span>{" "}
                Your personalized career newspaper is ready. Click any section below for an India-focused market snapshot tailored to your profile.
              </p>
            </div>

            <div className="px-5 py-4 border-b bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Live hiring pulse</p>
                  <p className="text-sm text-secondary">Fresh live items pulled from Google News and official career pages.</p>
                </div>
                {livePulseLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
              {livePulseError && <p className="mt-2 text-xs text-muted-foreground">{livePulseError}</p>}
              {!livePulseLoading && livePulse?.items?.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {livePulse.items.slice(0, 3).map((item) => (
                    <a
                      key={`${item.title}-${item.link}`}
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border bg-muted/30 p-3 hover:bg-muted/60 transition-colors"
                    >
                      <p className="text-sm font-semibold text-secondary line-clamp-2">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.company ? `${item.company} • ` : ""}
                        {item.location ? `${item.location} • ` : ""}
                        {item.source}
                      </p>
                    </a>
                  ))}
                </div>
              ) : !livePulseLoading && !livePulseError ? (
                <p className="mt-2 text-xs text-muted-foreground">No live items yet — try saving your profile or opening a section.</p>
              ) : null}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
              {SECTIONS.map(section => (
                <SectionCard key={section.id} section={section} profile={profile} synth={synth} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}