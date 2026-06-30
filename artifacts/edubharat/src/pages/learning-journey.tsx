import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageMeta } from "@/components/page-meta";
import { ROADMAP_STAGES } from "@/lib/english-roadmap";
import { mapEnglishLevel, LEVEL_TO_STAGE } from "@/lib/english-roadmap";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useAuth } from "@/lib/use-auth";
import { useGeminiStream } from "@/lib/use-gemini-stream";
import {
  BookOpen, CheckCircle2, RotateCcw, ChevronRight, ChevronUp, ChevronDown,
  Flame, Clock, Star, Brain, Mic, Headphones, Eye, Map, Zap, Loader2,
  Trophy, Lock, ChevronRight as ArrowRight, Target,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ── Guest ID ──────────────────────────────────────────────────────────────────
function getGuestId(): string {
  let id = localStorage.getItem("edubharat_guest_id");
  if (!id) {
    id = `guest_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("edubharat_guest_id", id);
  }
  return id;
}

// ── Types ─────────────────────────────────────────────────────────────────────
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
  streak: number;
};

type ProgressLesson = Lesson & {
  studied: boolean;
  due_date: string | null;
  overdue: boolean;
  repetitions: number;
  mastery: "bronze" | "silver" | "gold" | null;
};

// ── Lesson → CEFR level mapping ───────────────────────────────────────────────
// Lessons l1–l4 map to A1, l5/l6/l9/l10 to A2, l7/l8/l11/l12 to B1.
// Update as the lesson bank grows.
const LESSON_TO_LEVEL: Record<string, string> = {
  l1: "A1", l2: "A1", l3: "A1", l4: "A1",
  l5: "A2", l6: "A2", l9: "A2", l10: "A2",
  l7: "B1", l8: "B1", l11: "B1", l12: "B1",
};

// Ordered CEFR codes
const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// ── Skill icons + colours ─────────────────────────────────────────────────────
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

// ── Sub-components ────────────────────────────────────────────────────────────
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

const MASTERY_CONFIG = {
  bronze: { label: "Bronze", emoji: "🥉", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  silver: { label: "Silver", emoji: "🥈", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  gold:   { label: "Gold",   emoji: "🏆", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
} as const;

function MasteryBadge({ level }: { level: "bronze" | "silver" | "gold" }) {
  const cfg = MASTERY_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

// ── 30-day plan renderer ──────────────────────────────────────────────────────
function parseBold(text: string): React.ReactNode[] {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

function PlanRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      nodes.push(
        <h2 key={i} className="text-base font-extrabold text-secondary mt-2 mb-1">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <div key={i} className="mt-5 mb-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-primary/20" />
          <span className="text-xs font-extrabold uppercase tracking-widest text-primary px-2 py-1 bg-primary/10 rounded-full">
            {line.slice(3)}
          </span>
          <div className="h-px flex-1 bg-primary/20" />
        </div>
      );
    } else if (line.startsWith("### ")) {
      nodes.push(
        <div key={i} className="mt-3 mb-1 text-sm font-bold text-secondary border-l-[3px] border-primary pl-2.5">
          {line.slice(4)}
        </div>
      );
    } else if (line === "---") {
      nodes.push(<div key={i} className="my-3 border-t border-dashed border-border" />);
    } else if (line.startsWith("**Milestone:**")) {
      const body = line.replace("**Milestone:**", "").trim();
      nodes.push(
        <div key={i} className="flex gap-2 items-start bg-green-50 border border-green-200 rounded-lg px-3 py-2 my-2">
          <span className="text-green-600 shrink-0 mt-0.5">🏁</span>
          <div>
            <span className="text-xs font-bold text-green-800">Milestone: </span>
            <span className="text-xs text-green-700">{body}</span>
          </div>
        </div>
      );
    } else if (line.startsWith("**Free Resource:**")) {
      const body = line.replace("**Free Resource:**", "").trim();
      nodes.push(
        <div key={i} className="flex gap-2 items-start text-xs text-muted-foreground my-1 px-1">
          <span className="shrink-0">📚</span>
          <span>{parseBold(body)}</span>
        </div>
      );
    } else if (line.startsWith("**Daily Time Commitment:**") || line.startsWith("**Daily Time")) {
      nodes.push(
        <div key={i} className="text-xs font-semibold text-muted-foreground italic my-1">
          {parseBold(line)}
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const body = line.replace(/^\d+\.\s*/, "");
      nodes.push(
        <div key={i} className="ml-3 my-0.5 text-xs text-secondary flex gap-2 items-start">
          <span className="shrink-0 w-4 text-muted-foreground font-mono">{line.match(/^\d+/)?.[0]}.</span>
          <span>{parseBold(body)}</span>
        </div>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const body = line.slice(2);
      nodes.push(
        <div key={i} className="ml-6 my-0.5 text-xs text-muted-foreground flex gap-1.5 items-start">
          <span className="shrink-0 text-primary mt-px">·</span>
          <span>{parseBold(body)}</span>
        </div>
      );
    } else {
      nodes.push(
        <p key={i} className="text-xs text-secondary my-0.5 leading-relaxed">
          {parseBold(line)}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{nodes}</div>;
}

// ── Level card colour mapping ─────────────────────────────────────────────────
const LEVEL_ACCENT: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
  A1: { ring: "border-slate-400",  bg: "bg-slate-50",  text: "text-slate-700",  dot: "bg-slate-500" },
  A2: { ring: "border-blue-400",   bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500"  },
  B1: { ring: "border-green-400",  bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500" },
  B2: { ring: "border-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500"},
  C1: { ring: "border-orange-400", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500"},
  C2: { ring: "border-purple-400", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500"},
};

// ── Page component ────────────────────────────────────────────────────────────
export default function LearningJourneyPage() {
  const { user } = useAuth();
  const userId = user ? String(user.id) : getGuestId();

  const [lessons,    setLessons]    = useState<Lesson[]>([]);
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [allLessons, setAllLessons] = useState<ProgressLesson[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [scores,     setScores]     = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitted,  setSubmitted]  = useState<Record<string, boolean>>({});
  const [activeTab,  setActiveTab]  = useState<"queue" | "all" | "roadmap">("queue");
  // Which CEFR level card is expanded in the roadmap
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const { profile } = useStudentProfile();
  const { text: planText, isStreaming: planStreaming, stream: streamPlan } = useGeminiStream();
  const level        = mapEnglishLevel(profile.englishLevel);
  const currentStage = LEVEL_TO_STAGE[level] ?? "A1";

  // Default expanded level = student's current stage
  useEffect(() => {
    setExpandedLevel(currentStage);
  }, [currentStage]);

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
      const nextData = await nextRes.json() as { lessons: Lesson[]; total_due: number; total_new: number };
      const progData = await progressRes.json() as { lessons: ProgressLesson[]; summary: Summary };
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
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lesson_id: lessonId, score, userId }),
      });
      setSubmitted(s => ({ ...s, [lessonId]: true }));
      setTimeout(() => { void loadNext(); }, 800);
    } finally {
      setSubmitting(s => ({ ...s, [lessonId]: false }));
    }
  }, [scores, userId, loadNext]);

  // Group allLessons by CEFR level for the "All Lessons" view
  const lessonsByLevel = useMemo(() => {
    const map: Record<string, ProgressLesson[]> = {};
    for (const lesson of allLessons) {
      const lvl = LESSON_TO_LEVEL[lesson.id] ?? "B1";
      if (!map[lvl]) map[lvl] = [];
      map[lvl].push(lesson);
    }
    return map;
  }, [allLessons]);

  const studied = summary?.studied  ?? 0;
  const total   = summary?.total    ?? 0;
  const overdue = summary?.overdue  ?? 0;
  const pct     = total > 0 ? Math.round((studied / total) * 100) : 0;

  // Current stage index for locking future levels
  const currentLevelIdx = CEFR_ORDER.indexOf(currentStage as typeof CEFR_ORDER[number]);

  return (
    <>
      <PageMeta
        title="Learning Journey — EduBharat"
        description="Personalised English lessons with SM-2 spaced repetition. Your lessons adapt to what you know."
      />

      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-secondary tracking-tight">
              My Learning Journey
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              CEFR A1 → C2 path · SM-2 spaced repetition · personalised for you
            </p>
          </div>
          {/* Level jump selector */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground font-medium hidden sm:block">Jump to:</span>
            <Select
              value={expandedLevel ?? currentStage}
              onValueChange={val => {
                setExpandedLevel(val);
                setActiveTab("roadmap");
              }}
            >
              <SelectTrigger className="w-32 h-8 text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROADMAP_STAGES.map(s => (
                  <SelectItem key={s.level} value={s.level} className="text-xs">
                    <span className="font-bold">{s.level}</span>
                    <span className="text-muted-foreground ml-1">— {s.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Stats row ── */}
        {summary && (
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: "Day streak",    value: summary.streak, icon: <Flame className="w-4 h-4" />, color: "text-orange-500" },
              { label: "Studied",       value: studied,                                              color: "text-primary"     },
              { label: "Due for review",value: overdue,                                              color: "text-amber-500"   },
              { label: "Not started",   value: total - studied,                                      color: "text-secondary"   },
            ].map(s => (
              <Card key={s.label} className="border shadow-sm">
                <CardContent className="p-3 text-center">
                  <div className={`text-xl font-extrabold flex items-center justify-center gap-0.5 ${s.color}`}>
                    {s.icon}{s.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Overall progress bar ── */}
        {summary && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-secondary">Overall Progress</span>
              <span className="text-muted-foreground text-xs">{pct}% — {studied} of {total} lessons studied</span>
            </div>
            <Progress value={pct} className="h-2.5 rounded-full" />
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2 items-center">
          {(["queue", "all", "roadmap"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
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

        {/* ══════════════ TODAY'S QUEUE ══════════════ */}
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

        {/* ══════════════ ALL LESSONS (tile grid by CEFR level) ══════════════ */}
        {activeTab === "all" && (
          <div className="space-y-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
              ))
            ) : (
              CEFR_ORDER.map(lvl => {
                const stageDef   = ROADMAP_STAGES.find(s => s.level === lvl);
                const levelLessons = lessonsByLevel[lvl] ?? [];
                const accent     = LEVEL_ACCENT[lvl] ?? LEVEL_ACCENT.A1;
                const done       = levelLessons.filter(l => l.studied).length;
                const isLocked   = currentLevelIdx < CEFR_ORDER.indexOf(lvl as typeof CEFR_ORDER[number]) - 1;
                const isCurrent  = lvl === currentStage;

                return (
                  <div key={lvl}>
                    {/* Level header */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold border-2 shrink-0 ${
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary shadow shadow-primary/30"
                          : isLocked
                          ? "bg-muted text-muted-foreground border-border"
                          : `${accent.bg} ${accent.text} ${accent.ring}`
                      }`}>
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : lvl}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-secondary text-sm">
                            {stageDef?.label ?? lvl}
                          </span>
                          {isCurrent && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4">You are here</Badge>
                          )}
                          {isLocked && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                              Complete {CEFR_ORDER[CEFR_ORDER.indexOf(lvl as typeof CEFR_ORDER[number]) - 1]} first
                            </Badge>
                          )}
                          {levelLessons.length > 0 && (
                            <span className="text-xs text-muted-foreground">{done}/{levelLessons.length} done</span>
                          )}
                        </div>
                        {levelLessons.length > 0 && (
                          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden w-36">
                            <div
                              className="h-full bg-primary/60 rounded-full transition-all"
                              style={{ width: `${levelLessons.length > 0 ? Math.round((done / levelLessons.length) * 100) : 0}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lesson tiles grid */}
                    {levelLessons.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2.5">
                        {levelLessons.map(lesson => {
                          const Icon = SKILL_ICON[lesson.skill_type] ?? BookOpen;
                          const skillCls = SKILL_COLOR[lesson.skill_type] ?? "bg-gray-100 text-gray-700";
                          return (
                            <div
                              key={lesson.id}
                              className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                                lesson.studied
                                  ? "border-green-200 bg-green-50/60"
                                  : lesson.overdue
                                  ? "border-amber-200 bg-amber-50/60"
                                  : isLocked
                                  ? "border-border bg-muted/30 opacity-60"
                                  : "border-border bg-white hover:border-primary/30 hover:shadow-sm"
                              }`}
                            >
                              {/* Icon + status */}
                              <div className="flex items-center justify-between">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${skillCls}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  {lesson.studied
                                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    : lesson.overdue
                                    ? <Flame className="w-4 h-4 text-amber-500" />
                                    : isLocked
                                    ? <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  }
                                </div>
                              </div>
                              {/* Title */}
                              <p className="text-xs font-semibold text-secondary leading-tight line-clamp-2">
                                {lesson.title}
                              </p>
                              {/* Footer */}
                              <div className="flex items-center justify-between gap-1 mt-auto">
                                <SkillBadge type={lesson.skill_type} />
                                {lesson.last_score !== null && (
                                  <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5" />{lesson.last_score}%
                                  </span>
                                )}
                              </div>
                              {lesson.mastery && (
                                <MasteryBadge level={lesson.mastery} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* No lessons seeded for this level yet */
                      <div className={`rounded-xl border-2 border-dashed p-4 text-center ${
                        isLocked ? "border-border bg-muted/20" : `${accent.ring} ${accent.bg}`
                      }`}>
                        {isLocked ? (
                          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Unlock {lvl} by completing the level before it
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Lessons for {lvl} — {stageDef?.label} are coming soon
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════ ROADMAP (expandable CEFR level cards) ══════════════ */}
        {activeTab === "roadmap" && (
          <div className="space-y-3">
            {ROADMAP_STAGES.map((stage, idx) => {
              const isCurrent  = stage.level === currentStage;
              const isPast     = CEFR_ORDER.indexOf(currentStage as typeof CEFR_ORDER[number]) > idx;
              const isExpanded = expandedLevel === stage.level;
              const accent     = LEVEL_ACCENT[stage.level] ?? LEVEL_ACCENT.A1;
              const levelLessons = lessonsByLevel[stage.level] ?? [];
              const doneCnt    = levelLessons.filter(l => l.studied).length;
              const pctLevel   = levelLessons.length > 0 ? Math.round((doneCnt / levelLessons.length) * 100) : 0;
              const isLocked   = !isCurrent && !isPast && idx > CEFR_ORDER.indexOf(currentStage as typeof CEFR_ORDER[number]) + 1;

              return (
                <div key={stage.level} className="flex gap-3">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setExpandedLevel(isExpanded ? null : stage.level)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold border-2 shrink-0 transition-all ${
                        isCurrent
                          ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                          : isPast
                          ? "bg-primary/20 text-primary border-primary/40"
                          : `${accent.bg} ${accent.text} ${accent.ring}`
                      }`}
                    >
                      {isPast ? "✓" : stage.level}
                    </button>
                    {idx < ROADMAP_STAGES.length - 1 && (
                      <div className={`w-0.5 flex-1 my-1 min-h-[12px] ${isPast ? "bg-primary/40" : "bg-border"}`} />
                    )}
                  </div>

                  {/* Level card */}
                  <div className={`flex-1 rounded-xl border-2 mb-1 overflow-hidden transition-all ${
                    isCurrent
                      ? "border-primary bg-orange-50/60 shadow-sm"
                      : isPast
                      ? "border-primary/20 bg-green-50/30"
                      : isLocked ? `${accent.ring} ${accent.bg} opacity-60` : `${accent.ring} ${accent.bg}`
                  }`}>
                    {/* Card header — always visible */}
                    <button
                      className="w-full text-left px-4 pt-3.5 pb-3 flex items-start justify-between gap-2"
                      onClick={() => setExpandedLevel(isExpanded ? null : stage.level)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-extrabold text-secondary text-sm">
                            {stage.level} — {stage.label}
                          </span>
                          {isCurrent && <Badge className="text-[10px] px-1.5 py-0 h-4">You are here</Badge>}
                          {isPast && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary">
                              ✓ Completed
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">{stage.weeks}</span>
                        </div>
                        {/* Milestone one-liner */}
                        <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
                          🏁 {stage.milestone}
                        </p>
                        {/* Progress bar if lessons exist */}
                        {levelLessons.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pctLevel}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                              {doneCnt}/{levelLessons.length}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 mt-0.5">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-black/5 px-4 pb-4 space-y-4">

                        {/* Topic tiles */}
                        <div className="pt-3">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
                            What you'll learn
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {stage.topics.map(t => (
                              <span
                                key={t}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                                  isCurrent
                                    ? "bg-primary/10 border-primary/25 text-primary"
                                    : isPast
                                    ? "bg-primary/5 border-primary/10 text-primary/60"
                                    : "bg-white/70 border-border text-muted-foreground"
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Milestone + daily goal */}
                        <div className="grid gap-2">
                          <div className="flex gap-2 items-start bg-white/60 border border-green-200 rounded-lg px-3 py-2">
                            <Target className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-bold text-green-800 uppercase tracking-wide">Milestone</p>
                              <p className="text-xs text-green-700 leading-snug">{stage.milestone}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 items-start text-xs text-muted-foreground px-1">
                            <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                            <span>{stage.dailyGoal}</span>
                          </div>
                          <div className="flex gap-2 items-start text-xs text-muted-foreground px-1">
                            <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary/60" />
                            <span>{stage.resources}</span>
                          </div>
                        </div>

                        {/* Lesson tiles for this level */}
                        {levelLessons.length > 0 && (
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-2">
                              Lessons in this level
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {levelLessons.map(lesson => {
                                const Icon = SKILL_ICON[lesson.skill_type] ?? BookOpen;
                                return (
                                  <div
                                    key={lesson.id}
                                    className={`rounded-lg border p-2.5 flex items-start gap-2 ${
                                      lesson.studied
                                        ? "bg-green-50 border-green-200"
                                        : lesson.overdue
                                        ? "bg-amber-50 border-amber-200"
                                        : "bg-white border-border"
                                    }`}
                                  >
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                                      SKILL_COLOR[lesson.skill_type] ?? "bg-gray-100 text-gray-700"
                                    }`}>
                                      <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-secondary leading-tight line-clamp-2">
                                        {lesson.title}
                                      </p>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        {lesson.studied
                                          ? <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Done</span>
                                          : lesson.overdue
                                          ? <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" />Review</span>
                                          : <span className="text-[10px] text-muted-foreground">New</span>
                                        }
                                        {lesson.last_score !== null && (
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-1">
                                            <Star className="w-2 h-2" />{lesson.last_score}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* CTA */}
                        {isCurrent && (
                          <Button
                            size="sm"
                            className="w-full font-bold"
                            onClick={() => setActiveTab("queue")}
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                            Go to today's lessons
                          </Button>
                        )}
                        {!isCurrent && !isPast && !isLocked && (
                          <Button size="sm" variant="outline" className="w-full font-semibold text-xs" disabled>
                            Complete {currentStage} first to unlock this level
                          </Button>
                        )}
                        {isPast && (
                          <div className="flex items-center gap-2 text-xs text-primary font-semibold px-1">
                            <Trophy className="w-3.5 h-3.5" />
                            Level completed — great work!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 30-day plan generator */}
            <Card className="border-primary/30 bg-primary/5 mt-2">
              <CardContent className="pt-5 space-y-3">
                <p className="text-sm font-semibold text-secondary flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" />
                  Want a personalised week-by-week 30-day plan for {currentStage}?
                </p>
                <Button className="w-full font-bold" disabled={planStreaming} onClick={generatePlan}>
                  {planStreaming
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating your plan…</>
                    : <><Zap className="w-4 h-4 mr-2" />Generate My 30-Day Plan</>}
                </Button>
                {planText && (
                  <div className="rounded-xl border bg-white p-4 max-h-[60vh] overflow-y-auto">
                    <PlanRenderer text={planText} />
                    {planStreaming && (
                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />Writing your plan…
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── SM-2 explainer ── */}
        <Separator />
        <Card className="border shadow-sm bg-muted/30">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Brain className="w-4 h-4" />How this works
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4 text-xs text-muted-foreground space-y-1.5">
            <p><strong>Spaced Repetition (SM-2):</strong> Lessons you find hard come back sooner; easy ones are spaced further apart — the same method used by Anki.</p>
            <p><strong>Interleaving:</strong> Vocabulary, grammar, speaking, and listening are mixed so you never drill just one skill at a time.</p>
            <p><strong>Score 0–100:</strong> Rate each lesson honestly. 0 = completely forgot. 80–100 = confident recall. Your score directly controls how far out the next review is scheduled.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ── Lesson content bank ───────────────────────────────────────────────────────
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
  const staticContent = LESSON_CONTENT[lesson.id as keyof typeof LESSON_CONTENT];
  const [expanded, setExpanded] = useState(lesson.status === "new lesson");
  const [aiContent, setAiContent] = useState<{ concept: string; examples: string[]; practice: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const { profile } = useStudentProfile();

  const loadAIContent = async () => {
    if (aiContent !== null || loadingAI) return;
    setLoadingAI(true);
    try {
      const params = new URLSearchParams({
        level:      profile.englishLevel || "Beginner",
        goal:       profile.careerGoal   || "Private Job",
        nativeLang: profile.preferredLanguage || "Hindi",
        name:       profile.name || "",
        skills:     Array.isArray(profile.skills) ? profile.skills.join(", ") : (typeof profile.skills === "string" ? profile.skills : ""),
      });
      const res = await fetch(`${BASE}/api/journey/lesson-content/${lesson.id}?${params}`);
      if (res.ok) {
        const d = await res.json() as { concept: string; examples: string[]; practice: string };
        setAiContent(d);
      }
    } catch { /* silently fall back to static content */ } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (expanded && aiContent === null && !loadingAI) void loadAIContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const content = aiContent ?? staticContent;

  // Score label
  const scoreLabel = score === 0 ? "Forgot" : score < 40 ? "Hard" : score < 70 ? "Okay" : score < 90 ? "Good" : "Perfect";
  const scoreCls   = score === 0 ? "text-rose-600" : score < 40 ? "text-orange-600" : score < 70 ? "text-amber-600" : "text-green-600";

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

        {/* Expandable lesson content */}
        {(content || loadingAI) && (
          <div className="border border-primary/20 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              onClick={() => setExpanded(e => !e)}
            >
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                {expanded ? "Hide lesson" : "Study this lesson"}
                {loadingAI && <Loader2 className="w-3 h-3 animate-spin" />}
              </span>
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
                : <ChevronDown className="w-3.5 h-3.5 text-primary" />}
            </button>
            {expanded && (
              <div className="px-4 py-3 space-y-3 bg-white/60">
                {loadingAI && !content && (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Personalising for your profile…
                  </div>
                )}
                {content && (
                  <>
                    <p className="text-xs text-secondary leading-relaxed">{content.concept}</p>
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
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-amber-600 text-xs font-bold shrink-0 mt-0.5">Practice →</span>
                      <p className="text-xs text-amber-800 leading-relaxed">{content.practice}</p>
                    </div>
                  </>
                )}
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
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">How well did you recall this?</span>
              <span className={`font-extrabold ${scoreCls}`}>{scoreLabel} ({score}%)</span>
            </div>
            <input
              type="range"
              min={0} max={100} step={5}
              value={score}
              onChange={e => onScoreChange(Number(e.target.value))}
              className="w-full accent-primary h-1.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 — Forgot</span>
              <span>50 — Okay</span>
              <span>100 — Perfect</span>
            </div>
            <Button size="sm" onClick={onSubmit} disabled={submitting} className="w-full font-bold mt-1">
              {submitting ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Mark Done & Schedule Next Review"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
