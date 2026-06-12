import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INDIAN_LANGUAGES } from "@/lib/constants";
import { useHistory } from "@/lib/use-history";
import { useProgress } from "@/lib/use-progress";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";
import {
  Newspaper, RefreshCw, Volume2, Bookmark, BookmarkCheck, Loader2,
  ChevronDown, ChevronUp, User, Settings,
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

function SectionCard({ section, profile, synth }: {
  section: typeof SECTIONS[number];
  profile: Profile;
  synth: ReturnType<typeof useSpeechSynthesis>;
}) {
  const { save } = useHistory();
  const { track } = useProgress();
  const { text, isStreaming, stream } = useGeminiStream();
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (loaded && !isStreaming) { setExpanded(e => !e); return; }
    setExpanded(true);
    setLoaded(true);
    track("Rozgar Samachar", section.id);

    const profileCtx = `Reader profile: ${profile.name || "Indian professional"}, Age ${profile.age}, ${profile.education}, ${profile.status}, Goal: ${profile.careerGoal}, Location: ${profile.location}, Industry: ${profile.industry}`;

    const prompts: Record<SectionId, string> = {
      top_jobs: `List 5 hot job opportunities in India today for someone with this profile: ${profileCtx}. Include role, company type, salary range, and how to apply.`,
      govt_jobs: `List 5 current government job opportunities in India relevant to: ${profileCtx}. Include exam name, vacancies, last date, eligibility.`,
      private_jobs: `List 5 private sector job openings in India relevant to: ${profileCtx}. Include company, role, CTC, skills needed.`,
      internships: `List 5 internship/apprenticeship opportunities in India for: ${profileCtx}. Include organization, stipend, duration, how to apply.`,
      scholarships: `List 5 active scholarships in India for: ${profileCtx}. Include scholarship name, amount, eligibility, deadline.`,
      skill_trends: `What are the 5 most in-demand skills in India's ${profile.industry} industry right now? How can ${profile.status} in ${profile.location} develop these skills?`,
      career_growth: `Give a personalized 3-step career growth plan for: ${profileCtx}. Include specific actions, timelines, and expected outcomes.`,
      ai_news: `Summarize 3 important AI developments this week relevant to jobs and careers in India. Explain in ${profile.language}.`,
      tech_news: `Summarize 3 technology news stories relevant to careers and jobs in India. Write in ${profile.language}.`,
      business_news: `Summarize 3 business news stories relevant to job seekers and professionals in India. Write in ${profile.language}.`,
      govt_schemes: `List 3 government schemes in India that can benefit: ${profileCtx}. Include scheme name, benefits, eligibility, how to apply.`,
      salary_insights: `What are current salary ranges for ${profile.careerGoal} in ${profile.industry} in ${profile.location}? Give fresher, mid, senior levels. Compare cities.`,
      interview_qs: `Give 5 common interview questions for ${profile.careerGoal} in ${profile.industry} with ideal answers. Tailor for ${profile.status}.`,
      english_corner: `Write an English lesson for ${profile.status} in India who speaks ${profile.language}. Include a grammar tip, 5 useful phrases, and a practice exercise.`,
      vocab: `Give 5 English words every ${profile.status} in ${profile.industry} should know. Include meaning in ${profile.language} and example sentences.`,
      quiz: `Create a 5-question quiz testing knowledge relevant to ${profile.industry} careers. Include answers and explanations. Language: ${profile.language}.`,
      jokes: `Share 3 light-hearted workplace or career jokes relevant to Indian professionals. Keep them clean and funny. Language: ${profile.language}.`,
      success_stories: `Share a motivating success story of an Indian professional from ${profile.industry} who started as a ${profile.status} from ${profile.location}. Make it realistic and inspiring.`,
      motivation: `Write a powerful motivational message in ${profile.language} for a ${profile.status} in ${profile.location} pursuing ${profile.careerGoal}. Include a daily action tip.`,
    };

    await stream(
      prompts[section.id],
      `You are India's best career journalist writing the "${section.title}" section. Be specific, practical, and actionable. Today's date: ${new Date().toLocaleDateString("en-IN")}.`
    );
  }, [loaded, isStreaming, profile, section, stream]);

  return (
    <Card className="overflow-hidden border shadow-sm">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        onClick={load}
        data-testid={`section-${section.id}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{section.emoji}</span>
          <span className="font-semibold text-secondary">{section.title}</span>
          {isStreaming && <Loader2 className="w-4 h-4 animate-spin text-primary ml-2" />}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (text || isStreaming) && (
        <CardContent className="px-5 pb-5 pt-0 border-t bg-muted/20">
          <div className="flex justify-end gap-2 py-2">
            <Button variant="ghost" size="sm" className="text-xs"
              onClick={() => synth.speak(text, profile.language)}>
              <Volume2 className="w-3.5 h-3.5 mr-1" />Listen
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" disabled={saved}
              onClick={() => {
                save({ tool: "Rozgar Samachar", title: `${section.title} — ${new Date().toLocaleDateString("en-IN")}`, content: text });
                setSaved(true);
              }}>
              {saved ? <><BookmarkCheck className="w-3.5 h-3.5 mr-1 text-primary" />Saved</> : <><Bookmark className="w-3.5 h-3.5 mr-1" />Save</>}
            </Button>
          </div>
          <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{text}</div>
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

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const update = (key: keyof Profile) => (val: string) => setProfile(p => ({ ...p, [key]: val }));

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
            <Newspaper className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-extrabold text-secondary">Rozgar Samachar</h1>
            <p className="text-xs text-muted-foreground font-medium">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <User className="w-3 h-3 mr-1" />
            {profile.name || "Anonymous"} • {profile.location}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowProfile(!showProfile)} className="font-semibold">
            <Settings className="w-4 h-4 mr-1.5" />Profile
          </Button>
        </div>
      </div>

      {/* Profile Form */}
      {showProfile && (
        <Card className="mb-8 border-primary/20 bg-primary/3 animate-in slide-in-from-top-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Career Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Name</label>
                <Input value={profile.name} onChange={e => update("name")(e.target.value)} placeholder="Your name" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Age</label>
                <Input type="number" min="15" max="55" value={profile.age} onChange={e => update("age")(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Education</label>
                <Select value={profile.education} onValueChange={update("education")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["10th Pass", "12th Pass", "Diploma", "Graduate", "Post-Graduate", "PhD"].map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Current Status</label>
                <Select value={profile.status} onValueChange={update("status")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Student", "Fresher", "Working Professional", "Career Switcher", "Entrepreneur"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Career Goal</label>
                <Select value={profile.careerGoal} onValueChange={update("careerGoal")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Government Job", "Private Job", "IT / Tech", "Startup", "Business", "Higher Education", "Foreign Opportunity"].map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Language</label>
                <Select value={profile.language} onValueChange={update("language")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    {INDIAN_LANGUAGES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">State / Location</label>
                <Select value={profile.location} onValueChange={update("location")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Industry</label>
                <Select value={profile.industry} onValueChange={update("industry")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <Button variant="outline" size="sm" onClick={() => setShowProfile(false)}>Cancel</Button>
              <Button size="sm" className="font-bold" onClick={() => { setProfileSaved(true); setShowProfile(false); }}>
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's intro */}
      <div className="mb-6 p-4 bg-primary/5 border border-primary/15 rounded-xl">
        <p className="text-sm text-secondary">
          <span className="font-bold text-primary">Namaskar, {profile.name || "friend"}! 🙏</span>{" "}
          Your personalized career newspaper for today is ready.{" "}
          Click any section below to read AI-generated content tailored for a {profile.status} in {profile.location} aiming for {profile.careerGoal}.
        </p>
      </div>

      {/* All 19 sections */}
      <div className="space-y-3">
        {SECTIONS.map(section => (
          <SectionCard key={section.id} section={section} profile={profile} synth={synth} />
        ))}
      </div>
    </div>
  );
}
