import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { PageMeta } from "@/components/page-meta";
import {
  BookOpen, CheckCircle2, RotateCcw, ChevronRight,
  Flame, Clock, Star, Brain, Mic, Headphones, Eye,
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
  const [activeTab, setActiveTab] = useState<"queue" | "all">("queue");

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
          {(["queue", "all"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              }`}
            >
              {tab === "queue" ? "📋 Today's Queue" : "📚 All Lessons"}
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
