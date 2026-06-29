import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PageMeta } from "@/components/page-meta";
import { RoadmapTimeline } from "@/components/roadmap-timeline";
import { LEVEL_TO_STAGE, mapEnglishLevel } from "@/lib/english-roadmap";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import {
  BookOpen, CheckCircle2, RotateCcw, ChevronRight, ChevronUp, ChevronDown,
  Flame, Clock, Star, Brain, Mic, Headphones, Eye, Map, Zap, Loader2,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Guest user id persisted in localStorage so journey state survives page reload
function getGuestId(): string {
  let id = localStorage.getItem("edubharat_guest_id");
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("edubharat_guest_id", id);
  }
  return id;
}

type Lesson = {
  id: string;
  title: string;
  skill_type: string;
  description: string;
  status: "new lesson" | "due for review";
  last_score: number | null;
  next_review: string | null;
};

type Summary = {
  total: number;
  studied: number;
  overdue: number;
};

type ProgressLesson = Lesson & {
  studied: boolean;
  due_date: string | null;
  overdue: boolean;
  repetitions: number;
};

const SKILL_ICON: Record<string, React.ElementType> = {
  vocabulary: BookOpen,
  grammar:    Brain,
  speaking:   Mic,
  listening:  Headphones,
  reading:    Eye,
};

const SKILL_COLOR: Record<string, string> = {
  vocabulary: "bg-amber-100 text-amber-800",
  grammar:    "bg-blue-100 text-blue-800",
  speaking:   "bg-green-100 text-green-800",
  listening:  "bg-purple-100 text-purple-800",
  reading:    "bg-rose-100 text-rose-800",
};

function SkillBadge({ type }: { type: string }) {
  const Icon = SKILL_ICON[type] ?? BookOpen;
  const cls  = SKILL_COLOR[type] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon className="w-3 h-3" />
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

export default function LearningJourneyPage() {
  const userId = getGuestId();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [allLessons, setAllLessons] = useState<ProgressLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"queue" | "all" | "roadmap">("queue");

  const { profile } = useStudentProfile();
  const { text: planText, isStreaming: planStreaming, stream: streamPlan } = useGeminiStream();
  const level = mapEnglishLevel(profile.englishLevel);
  const currentStage = LEVEL_TO_STAGE[level] ?? "A1";
  const generatePlan = useCallback(() => {
    void streamPlan(
      `Create a detailed 30-day English learning plan for an Indian ${level} learner at CEFR ${currentStage} level, targeting job interviews and professional communication. Format as 4 weeks: for Week 1 give day-by-day tasks (Day 1–7); for Weeks 2–4 give weekly themes with 3 daily activities. For each week: specify 15–40 minutes per day, practical Indian-context exercises, milestone to reach by week end, and one free resource. Keep it specific, achievable, and India-relevant.`,
      `You are an experienced English teacher specialising in India's job market. Give actionable, specific, time-bound daily tasks.`,
    );
  }, [streamPlan, level, currentStage]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRes, progressRes] = await Promise.all([
        fetch(`${BASE}/api/journey/next?userId=${userId}`),
        fetch(`${BASE}/api/journey/progress?userId=${userId}`),
      ]);
      const nextData  = await nextRes.json() as { lessons: Lesson[]; total_due: number; total_new: number };
      const progData  = await progressRes.json() as { lessons: ProgressLesson[]; summary: Summary };
      setLessons(nextData.lessons ?? []);
      setAllLessons(progData.lessons ?? []);
      setSummary(progData.summary ?? null);
      setSubmitted({});
    } catch {
      /* silently ignore — empty state handles it */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadNext(); }, [loadNext]);

  const handleSubmit = useCallback(async (lessonId: string) => {
    const score = scores[lessonId] ?? 0;
    setSubmitting(s => ({ ...s, [lessonId]: true }));
    try {
      await fetch(`${BASE}/api/journey/submit-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId, score, userId }),
      });
      setSubmitted(s => ({ ...s, [lessonId]: true }));
      // Refresh progress after a short delay so the user sees the tick first
      setTimeout(() => { void loadNext(); }, 800);
    } finally {
      setSubmitting(s => ({ ...s, [lessonId]: false }));
    }
  }, [scores, userId, loadNext]);

  const studied  = summary?.studied  ?? 0;
  const total    = summary?.total    ?? 0;
  const overdue  = summary?.overdue  ?? 0;
  const pct      = total > 0 ? Math.round((studied / total) * 100) : 0;

  return (
    <>
      <PageMeta
        title="Learning Journey — EduBharat"
        description="Personalised English lessons with SM-2 spaced repetition. Your lessons adapt to what you know."
      />

      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-extrabold text-secondary tracking-tight">
            My Learning Journey
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lessons use <strong>spaced repetition</strong> (SM-2) + <strong>interleaving</strong> — not a fixed playlist.
            The harder you find something, the sooner it comes back.
          </p>
        </div>

        {/* Stats row */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="border shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-extrabold text-primary">{studied}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Studied</div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-extrabold text-amber-500">{overdue}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Due for review</div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-extrabold text-secondary">{total - studied}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Not yet started</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overall progress bar */}
        {summary && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-secondary">Overall Progress</span>
              <span className="text-muted-foreground">{pct}% — {studied} of {total} lessons studied</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {(["queue", "all", "roadmap"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              }`}
            >
              {tab === "queue" ? "📋 Today's Queue" : tab === "all" ? "📚 All Lessons" : "🗺️ Roadmap"}
            </button>
          ))}
          <button
            onClick={() => void loadNext()}
            className="ml-auto p-2 rounded-lg border hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── TODAY'S QUEUE ── */}
        {activeTab === "queue" && (
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />
              ))
            ) : lessons.length === 0 ? (
              <Card className="border shadow-sm">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="text-4xl">🎉</div>
                  <p className="font-semibold text-secondary">You're all caught up!</p>
                  <p className="text-sm text-muted-foreground">
                    No lessons are due right now. Come back tomorrow for your next review.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void loadNext()}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Refresh
                  </Button>
                </CardContent>
              </Card>
            ) : (
              lessons.map(lesson => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  score={scores[lesson.id] ?? 0}
                  onScoreChange={v => setScores(s => ({ ...s, [lesson.id]: v }))}
                  onSubmit={() => void handleSubmit(lesson.id)}
                  submitting={submitting[lesson.id] ?? false}
                  submitted={submitted[lesson.id] ?? false}
                />
              ))
            )}
          </div>
        )}

        {/* ── ALL LESSONS ── */}
        {activeTab === "all" && (
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))
            ) : (
              allLessons.map(lesson => (
                <div
                  key={lesson.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    lesson.overdue ? "border-amber-200 bg-amber-50" :
                    lesson.studied ? "border-green-200 bg-green-50/40" :
                    "bg-muted/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    lesson.studied ? "bg-green-100" : "bg-muted"
                  }`}>
                    {lesson.studied
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-secondary truncate">{lesson.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <SkillBadge type={lesson.skill_type} />
                      {lesson.overdue && (
                        <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-0.5">
                          <Flame className="w-3 h-3" />Due for review
                        </span>
                      )}
                      {lesson.last_score !== null && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Star className="w-3 h-3" />{lesson.last_score}%
                        </span>
                      )}
                      {lesson.due_date && !lesson.overdue && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />Next: {lesson.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                  {lesson.repetitions > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      ×{lesson.repetitions}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ROADMAP ── */}
        {activeTab === "roadmap" && (
          <div className="space-y-5">
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-900">
              <strong>Your current level:</strong> {level} ({currentStage}) — your personalised CEFR path to professional English fluency. Each stage shows what to learn, how long it takes, and what resources to use.
            </div>
            <RoadmapTimeline currentStage={currentStage} />
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" />Want a personalised week-by-week 30-day plan for your level?
                </p>
                <Button className="w-full font-bold" disabled={planStreaming} onClick={generatePlan}>
                  {planStreaming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                  Generate My 30-Day Plan
                </Button>
                {planText && (
                  <div className="rounded-xl border bg-white p-4 text-sm whitespace-pre-wrap leading-relaxed text-secondary max-h-[50vh] overflow-y-auto">
                    {planText}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* SM-2 explainer */}
        <Separator />
        <Card className="border shadow-sm bg-muted/30">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Brain className="w-4 h-4" />How this works
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 text-xs text-muted-foreground space-y-1.5">
            <p><strong>Spaced Repetition (SM-2):</strong> Lessons you find hard come back sooner; easy ones are spaced further apart — the same method used by Anki.</p>
            <p><strong>Interleaving:</strong> Vocabulary, grammar, speaking, and listening are mixed in your queue so you never drill just one skill at a time (Rohrer &amp; Taylor research).</p>
            <p><strong>Score 0–100:</strong> Rate each lesson honestly. 0 = completely forgot. 80–100 = confident recall. Your score directly controls how far out the next review is scheduled.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ── Lesson content bank ──────────────────────────────────────────────────────
// Each entry provides the actual teaching material shown inside the LessonCard
// before the recall slider, so learners study the concept before rating themselves.

const LESSON_CONTENT: Record<string, { concept: string; examples: string[]; practice: string }> = {
  l1: {
    concept: "Greetings set the tone. Use 'Good morning/afternoon/evening' formally and 'Hi/Hello' casually. Always add your name when meeting someone new.",
    examples: [
      '"Good morning! I\'m Suresh from the accounts team." (office, first meeting)',
      '"Hi Priya! How are you doing today?" (casual, with a colleague)',
      '"Hello, this is Anita calling from ABC Ltd." (phone call)',
    ],
    practice: "Say it out loud: Introduce yourself — your name, where you work or study, and one friendly sentence.",
  },
  l2: {
    concept: "Present Simple = habits, facts, routines. Add -s/-es for He/She/It. Use do/does for questions and negatives.",
    examples: [
      '"I work in Pune. She works in Delhi." (He/She always gets +s)',
      '"We have a meeting every Monday." (regular habit)',
      '"Does he speak English? I don\'t understand." (question + negative)',
    ],
    practice: "Write 3 sentences: one thing you do every day, one thing a friend does, one yes/no question.",
  },
  l3: {
    concept: "In shops: greet the shopkeeper, state what you need clearly, ask the price politely, thank them before leaving.",
    examples: [
      '"Excuse me, do you have this in size 32?" (asking for a product)',
      '"How much is this? Is there any discount?" (checking price)',
      '"Please give me two bottles of water and a packet of biscuits." (placing order)',
    ],
    practice: "Role-play out loud: You're at a mobile shop asking about a new phone. What do you say?",
  },
  l4: {
    concept: "Describe your day using time sequence words: first, then, after that, next, finally. They show the order of events clearly.",
    examples: [
      '"First I wake up at 6, then I brush my teeth and have tea."',
      '"After breakfast, I take the metro to the office."',
      '"Finally, I go to bed around 10:30 after watching the news."',
    ],
    practice: "Speak or write 4–5 sentences about your morning — from when you wake up to when you leave home.",
  },
  l5: {
    concept: "Core office words every professional needs: meeting, deadline, agenda, feedback, update, presentation, report, approve, pending, follow-up.",
    examples: [
      '"We have a team meeting at 3 pm. Please check the agenda on email."',
      '"The report is still pending — I\'m waiting for your feedback."',
      '"Can you approve this by Friday? The deadline is Monday."',
    ],
    practice: "Use 5 of these words — meeting, deadline, update, approve, follow-up — in sentences from your own work life.",
  },
  l6: {
    concept: "Past Simple = finished actions. Regular verbs add -ed (worked, studied). Common irregulars: go→went, see→saw, take→took, have→had.",
    examples: [
      '"I worked late yesterday. She finished the project on time." (regular)',
      '"We went to Hyderabad last month. I saw him at the station." (irregular)',
      '"Did you eat lunch? I didn\'t have time — I had a meeting." (question + negative)',
    ],
    practice: "Tell 4 things you did yesterday — use at least 2 irregular verbs.",
  },
  l7: {
    concept: "Common HR interview questions: 'Tell me about yourself', 'Why do you want this job?', 'What are your strengths?'. Have a clear 60-second answer for each.",
    examples: [
      '"Tell me about yourself." → Name + education + key skill + career goal in 4-5 sentences.',
      '"Why this company?" → What you know about them + how your skills fit their work.',
      '"Describe a challenge you faced." → Situation, what YOU did, result — keep it positive.',
    ],
    practice: "Answer this out loud right now: 'Tell me about yourself.' — aim for 60 seconds, no more.",
  },
  l8: {
    concept: "STAR answers impress interviewers. S = Situation, T = Task (your role), A = Action (what YOU did), R = Result (what happened). Always end with a positive outcome.",
    examples: [
      '"In my last job (S), I was asked to lead a data cleanup project (T)..."',
      '"I organised the files and trained 3 team members on the new system (A)..."',
      '"...which reduced errors by 30% and saved 2 hours per week (R)."',
    ],
    practice: "Pick one challenge from your own life. Tell it in STAR format — out loud, 45–60 seconds.",
  },
  l9: {
    concept: "Dates: say Day + Month + Year in full. Times: use AM/PM or 24-hour clock. Large numbers: say 'thousand', 'lakh', 'crore' (not 'thousands').",
    examples: [
      '"The meeting is on the fifteenth of June, 2024." (say dates fully)',
      '"It starts at half past three — 3:30 PM." (time expressions)',
      '"My CTC is twelve lakh per annum." (Indian number system in English)',
    ],
    practice: "Say out loud: today's date, your date of birth, and the current time — all in complete English sentences.",
  },
  l10: {
    concept: "Question words: What (thing), Who (person), Where (place), When (time), Why (reason), How (manner/degree). Use do/does/did for simple tense questions.",
    examples: [
      '"What do you do for work? Where do you currently live?"',
      '"Who did you report to in your last job?"',
      '"Why are you looking for a change? How did you hear about this role?"',
    ],
    practice: "Write 5 questions you might ask a hiring manager at the end of a job interview.",
  },
  l11: {
    concept: "Reading job ads: look for Role (what the job is), Requirements (skills + experience needed), Responsibilities (daily tasks), and How to apply.",
    examples: [
      '"Required: 2+ years experience, B.Com/MBA, proficiency in MS Excel." (requirements)',
      '"Responsibilities: manage accounts payable, prepare monthly MIS reports." (duties)',
      '"Send CV to hr@company.com with subject line \'Application – Accounts Executive\'." (apply)',
    ],
    practice: "Find one real job ad on Naukri or LinkedIn. Write: the role, 3 requirements, 2 responsibilities.",
  },
  l12: {
    concept: "A professional call has 5 parts: greet + state your name, give your reason for calling, share key details, confirm the next step, close politely.",
    examples: [
      '"Hello, this is Amit Sharma calling from TechSolutions. May I speak with the HR manager?"',
      '"I\'m calling to follow up on the interview I attended last Wednesday."',
      '"Could you let me know the next steps? Thank you so much for your time."',
    ],
    practice: "Call a friend and role-play: you're following up on a job application you submitted 5 days ago.",
  },
};

// ── Lesson card ───────────────────────────────────────────────────────────────

function LessonCard({
  lesson, score, onScoreChange, onSubmit, submitting, submitted,
}: {
  lesson: Lesson;
  score: number;
  onScoreChange: (v: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitted: boolean;
}) {
  const Icon = SKILL_ICON[lesson.skill_type] ?? BookOpen;
  const content = LESSON_CONTENT[lesson.id as keyof typeof LESSON_CONTENT];
  // New lessons expand by default so learners see the material immediately;
  // review cards start collapsed since the learner has seen the content before.
  const [expanded, setExpanded] = useState(lesson.status === "new lesson");

  return (
    <Card className={`border shadow-sm transition-all ${submitted ? "opacity-60" : ""}`}>
      <CardContent className="p-5 space-y-3">
        {/* Title row */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-secondary">{lesson.title}</h3>
              <SkillBadge type={lesson.skill_type} />
              {lesson.status === "due for review" && (
                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 py-0">
                  <Flame className="w-3 h-3 mr-0.5" />Review
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{lesson.description}</p>
          </div>
        </div>

        {/* Expandable lesson content — teaches the concept before the recall check */}
        {content && (
          <div className="border border-primary/20 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              onClick={() => setExpanded(e => !e)}
            >
              <span className="text-xs font-semibold text-primary">
                {expanded ? "Hide lesson" : "Show lesson content"}
              </span>
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
                : <ChevronDown className="w-3.5 h-3.5 text-primary" />}
            </button>
            {expanded && (
              <div className="px-4 py-3 space-y-3 bg-white/60">
                {/* Core concept */}
                <p className="text-xs text-secondary leading-relaxed">{content.concept}</p>
                {/* Examples */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Examples</p>
                  <ul className="space-y-1.5">
                    {content.examples.map((ex, i) => (
                      <li key={i} className="text-xs text-secondary leading-relaxed pl-3 border-l-2 border-primary/30">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Practice prompt */}
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="text-amber-600 text-xs font-bold shrink-0 mt-0.5">Practice →</span>
                  <p className="text-xs text-amber-800 leading-relaxed">{content.practice}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Score + submit */}
        {submitted ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />Marked complete — next review scheduled!
          </div>
        ) : (
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>How well did you recall this?</span>
                <span className="font-bold text-secondary">{score}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={score}
                onChange={e => onScoreChange(Number(e.target.value))}
                className="w-full accent-primary h-1.5"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Forgot</span>
                <span>Okay</span>
                <span>Perfect</span>
              </div>
            </div>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={submitting}
              className="shrink-0"
            >
              {submitting ? "…" : "Mark Done"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
