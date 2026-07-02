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
  Trophy, Lock, ChevronRight as ArrowRight, Target, Users, Sparkles,
  AlertTriangle,
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
  status: "new lesson" | "due for review" | "practice ahead";
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

type Exercise = {
  q: string;
  options: string[];
  answer: number; // 0-based index of the correct option
};

// ── Lesson → CEFR level mapping ───────────────────────────────────────────────
const LESSON_TO_LEVEL: Record<string, string> = {
  // A1 — Foundation
  l1: "A1", l2: "A1", l3: "A1", l4: "A1", l13: "A1", l14: "A1",
  // A2 — Elementary
  l5: "A2", l6: "A2", l9: "A2", l10: "A2", l15: "A2", l16: "A2",
  // B1 — Intermediate
  l7: "B1", l8: "B1", l11: "B1", l12: "B1", l17: "B1", l18: "B1",
  // B2 — Upper-Intermediate
  l19: "B2", l20: "B2", l21: "B2", l22: "B2",
  // C1 — Advanced
  l23: "C1", l24: "C1", l25: "C1", l26: "C1",
  // C2 — Mastery
  l27: "C2", l28: "C2", l29: "C2", l30: "C2",
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

// ── Daily session psychology helpers ─────────────────────────────────────────
const DAILY_GOAL = 3;          // lessons that count as "today's goal"
const XP_PER_LESSON = 20;

// Deterministic-per-day social-proof number so it stays stable across renders
// but feels alive day to day (FOMO nudge).
function learnersToday(): number {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return 900 + ((seed * 7919) % 1900); // ~900–2800
}

// Circular daily-goal ring (SVG strokeDashoffset for accuracy)
function DailyGoalRing({ done, goal }: { done: number; goal: number }) {
  const size = 56, stroke = 6, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  const met = done >= goal;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          className="text-muted/30" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round"
          className={met ? "text-green-500 transition-all duration-500" : "text-primary transition-all duration-500"}
          stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {met ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <>
            <span className="text-sm font-extrabold text-secondary">{done}</span>
            <span className="text-[9px] text-muted-foreground">/ {goal}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── 30-day plan renderer ──────────────────────────────────────────────────────
function parseBold(text: string): React.ReactNode[] {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

// Parse a single pipe-delimited table row into cell strings.
// Returns null if it doesn't look like a table row.
function parseTableRow(line: string): string[] | null {
  if (!line.startsWith("|")) return null;
  const cells = line.split("|").map(c => c.trim());
  // remove the empty strings that come from leading/trailing pipes
  return cells.filter((_, idx) => idx !== 0 && idx !== cells.length - 1);
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every(c => /^[-:]+$/.test(c));
}

function PlanRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) { i++; continue; }

    // ── Markdown table: collect all consecutive pipe rows ──────────────────
    if (line.startsWith("|")) {
      const tableLines: string[][] = [];
      let hasHeader = false;
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        const cells = parseTableRow(lines[j].trim());
        if (cells) {
          if (isSeparatorRow(cells)) { hasHeader = true; }
          else { tableLines.push(cells); }
        }
        j++;
      }
      if (tableLines.length > 0) {
        const [headerRow, ...bodyRows] = tableLines;
        nodes.push(
          <div key={i} className="my-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs border-collapse">
              {hasHeader && headerRow && (
                <thead>
                  <tr className="bg-primary/8 border-b border-border">
                    {headerRow.map((cell, ci) => (
                      <th key={ci} className="px-3 py-2 text-left font-bold text-secondary whitespace-nowrap">
                        {parseBold(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {(hasHeader ? bodyRows : tableLines).map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-secondary border-b border-border/50 align-top leading-snug">
                        {parseBold(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      i = j;
      continue;
    }

    // ── All other line types ───────────────────────────────────────────────
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
          {parseBold(line.slice(4))}
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

    i++;
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
  // XP earned in the current focus session (resets on each fresh queue load)
  const [sessionXP, setSessionXP] = useState(0);
  // "Practice ahead" mode: everything is done + nothing due, so we show upcoming lessons early.
  const [aheadMode, setAheadMode] = useState(false);
  const [nextDueDate, setNextDueDate] = useState<string | null>(null);

  const { profile } = useStudentProfile();
  const { text: planText, isStreaming: planStreaming, stream: streamPlan } = useGeminiStream();
  const level        = mapEnglishLevel(profile.englishLevel);
  const currentStage = LEVEL_TO_STAGE[level] ?? "A1";

  // Study-earned stage: the first CEFR level the learner has NOT fully studied.
  // Real progress unlocks the next level (finish A1 → A2 opens), independent of
  // the level declared in the profile. Empty progress falls back to A1 so we
  // never unlock everything before data has loaded.
  const masteryStage = useMemo<(typeof CEFR_ORDER)[number]>(() => {
    if (allLessons.length === 0) return "A1";
    const byLevel: Record<string, { total: number; done: number }> = {};
    for (const l of allLessons) {
      const lvl = LESSON_TO_LEVEL[l.id] ?? "B1";
      const b = byLevel[lvl] ?? { total: 0, done: 0 };
      b.total++;
      if (l.studied) b.done++;
      byLevel[lvl] = b;
    }
    for (const lvl of CEFR_ORDER) {
      const b = byLevel[lvl];
      if (b && b.done < b.total) return lvl;
    }
    return CEFR_ORDER[CEFR_ORDER.length - 1];
  }, [allLessons]);

  // Effective stage = the further along of profile-declared and study-earned.
  const effectiveStageIdx = Math.max(
    CEFR_ORDER.indexOf(currentStage as (typeof CEFR_ORDER)[number]),
    CEFR_ORDER.indexOf(masteryStage),
  );
  const effectiveStage = CEFR_ORDER[effectiveStageIdx] ?? currentStage;

  // Default expanded level = student's current stage
  useEffect(() => {
    setExpandedLevel(effectiveStage);
  }, [effectiveStage]);

  const generatePlan = useCallback(() => {
    void streamPlan(
      `Create a detailed 30-day English learning plan for an Indian ${level} learner at CEFR ${effectiveStage} level, targeting job interviews and professional communication.

Structure as 4 weeks. Use ONLY headings (##, ###), bullet points (- ), and bold text (**text**). Do NOT use markdown tables or pipe characters.

For Week 1: list each day (### Day 1 – Title) with 3–4 bullet points covering vocabulary, speaking/listening, and a 2-minute activity. Keep each day under 30 minutes total.
For Weeks 2–4: use a weekly theme (### Week N – Theme) with 3 daily bullet activities.

End each week with:
**Milestone:** one sentence on the skill unlocked.
**Free Resource:** one specific free Indian-context resource.

Keep every task specific, time-boxed, and India-relevant (job interviews, office talk, interviews on YouTube, etc.).`,
      `You are an experienced English teacher for India's job market. Use only headings, bullet points, and bold — never markdown tables or pipe characters. Be specific and actionable.`,
    );
  }, [streamPlan, level, effectiveStage]);

  const loadNext = useCallback(async () => {
    setLoading(true);
    try {
      const [nextRes, progressRes] = await Promise.all([
        fetch(`${BASE}/api/journey/next?userId=${userId}`),
        fetch(`${BASE}/api/journey/progress?userId=${userId}`),
      ]);
      const nextData = await nextRes.json() as { lessons: Lesson[]; total_due: number; total_new: number; mode?: string; next_due_date?: string | null };
      const progData = await progressRes.json() as { lessons: ProgressLesson[]; summary: Summary };
      setLessons(nextData.lessons ?? []);
      setAheadMode(nextData.mode === "ahead");
      setNextDueDate(nextData.next_due_date ?? null);
      setAllLessons(progData.lessons ?? []);
      setSummary(progData.summary ?? null);
      setSubmitted({});
      setScores({});
      setSessionXP(0);
    } catch {
      /* silently ignore — empty state handles it */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void loadNext(); }, [loadNext]);

  const handleSubmit = useCallback(async (lessonId: string) => {
    const score = scores[lessonId] ?? 0;
    const lesson = lessons.find(l => l.id === lessonId);
    setSubmitting(s => ({ ...s, [lessonId]: true }));
    try {
      const res = await fetch(`${BASE}/api/journey/submit-result`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lesson_id: lessonId, score, userId }),
      });
      // Only advance the session when the server actually saved the result —
      // otherwise client and backend would silently diverge for the session.
      if (!res.ok) return;
      // Advance the focus session in place — no full reload, so the next
      // lesson slides in immediately instead of resetting the whole queue.
      const isReview = lesson?.status === "due for review" || lesson?.status === "practice ahead";
      setSubmitted(s => ({ ...s, [lessonId]: true }));
      setSessionXP(x => x + XP_PER_LESSON);
      // Optimistically bump headline stats so the goal ring feels alive.
      // A new lesson moves into "studied"; a review was already counted as
      // studied, so only clear it from the overdue bucket.
      setSummary(prev => prev ? {
        ...prev,
        studied: isReview ? prev.studied : prev.studied + 1,
        overdue: isReview ? Math.max(0, prev.overdue - 1) : prev.overdue,
      } : prev);
    } finally {
      setSubmitting(s => ({ ...s, [lessonId]: false }));
    }
  }, [scores, userId, lessons]);

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

  // Current stage index for locking future levels — driven by real progress so
  // finishing a level actually unlocks the next one.
  const currentLevelIdx = effectiveStageIdx;

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
              value={expandedLevel ?? effectiveStage}
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

        {/* ══════════════ TODAY'S FOCUS — one lesson at a time ══════════════ */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            {loading ? (
              <>
                <div className="h-20 bg-muted rounded-2xl animate-pulse" />
                <div className="h-72 bg-muted rounded-2xl animate-pulse" />
              </>
            ) : lessons.length === 0 ? (
              <Card className="border shadow-sm">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="text-4xl">🎉</div>
                  <p className="font-semibold text-secondary">You're all caught up!</p>
                  <p className="text-sm text-muted-foreground">
                    No lessons are due right now. Come back tomorrow for your next review —
                    {summary && summary.streak > 0
                      ? ` keep your ${summary.streak}-day streak alive!`
                      : " start a streak tomorrow!"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void loadNext()}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Refresh
                  </Button>
                </CardContent>
              </Card>
            ) : (() => {
              const dueCount   = lessons.length;
              const doneCount  = lessons.filter(l => submitted[l.id]).length;
              const goal       = Math.min(DAILY_GOAL, dueCount);
              const goalMet    = doneCount >= goal;
              const current    = lessons.find(l => !submitted[l.id]);
              const position   = doneCount + 1; // 1-based index of the current lesson

              return (
                <>
                  {aheadMode && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                      <p className="font-semibold text-secondary">🎯 You're ahead of schedule!</p>
                      <p className="text-muted-foreground">
                        Today's reviews are all done. These are your upcoming lessons — practising early locks them in and keeps your streak alive.
                        {nextDueDate ? ` Next scheduled review: ${new Date(nextDueDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` : ""}
                      </p>
                    </div>
                  )}
                  {/* ── Session header: goal ring + streak loss-aversion + FOMO ── */}
                  <Card className="border shadow-sm overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4">
                      <DailyGoalRing done={doneCount} goal={goal} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-secondary">
                          {goalMet
                            ? "Daily goal smashed! 🎉"
                            : `Today's goal: ${goal} lesson${goal > 1 ? "s" : ""}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3 text-primary" />
                          {learnersToday().toLocaleString("en-IN")} learners studied today
                        </p>
                      </div>
                      {sessionXP > 0 && (
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-primary font-extrabold text-lg">
                            <Zap className="w-4 h-4 fill-primary" />+{sessionXP}
                          </div>
                          <p className="text-[10px] text-muted-foreground -mt-0.5">XP today</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── Loss-aversion nudges ── */}
                  {summary && summary.streak > 0 && !goalMet && (
                    <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5">
                      <Flame className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-800 leading-snug">
                        <span className="font-bold">{summary.streak}-day streak</span> on the line —
                        finish today's goal before midnight or you lose it.
                      </p>
                    </div>
                  )}
                  {overdue > 0 && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 leading-snug">
                        <span className="font-bold">{overdue} lesson{overdue > 1 ? "s are" : " is"} fading</span> from
                        memory. Review now to lock in what you've learned.
                      </p>
                    </div>
                  )}

                  {current ? (
                    <>
                      {/* Position indicator + dots */}
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Lesson {position} of {dueCount}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lessons.map((l, i) => (
                            <span
                              key={l.id}
                              className={`h-1.5 rounded-full transition-all ${
                                submitted[l.id]
                                  ? "w-1.5 bg-green-500"
                                  : i === doneCount
                                  ? "w-5 bg-primary"
                                  : "w-1.5 bg-muted"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Momentum nudge once the goal is met but lessons remain */}
                      {goalMet && (
                        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5">
                          <Sparkles className="w-4 h-4 text-primary shrink-0" />
                          <p className="text-xs text-primary leading-snug">
                            You're on fire! {dueCount - doneCount} more queued —
                            keep the momentum and get ahead of tomorrow.
                          </p>
                        </div>
                      )}

                      {/* The single focused lesson */}
                      <LessonCard
                        key={current.id}
                        lesson={current}
                        score={scores[current.id] ?? 0}
                        onScoreChange={v => setScores(s => ({ ...s, [current.id]: v }))}
                        onSubmit={() => void handleSubmit(current.id)}
                        submitting={submitting[current.id] ?? false}
                        submitted={false}
                      />
                    </>
                  ) : (
                    /* ── Session complete celebration ── */
                    <Card className="border-primary/30 shadow-sm bg-gradient-to-b from-primary/5 to-transparent">
                      <CardContent className="p-8 text-center space-y-3">
                        <div className="text-5xl">🏆</div>
                        <p className="font-display text-xl font-extrabold text-secondary">
                          Session complete!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          You finished {doneCount} lesson{doneCount > 1 ? "s" : ""} and earned{" "}
                          <span className="font-bold text-primary">+{sessionXP} XP</span>.
                          {summary && summary.streak > 0 && ` Your ${summary.streak}-day streak is safe. 🔥`}
                        </p>
                        <Button onClick={() => void loadNext()} className="font-bold">
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Check for more
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
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
                const isCurrent  = lvl === effectiveStage;

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
              const isCurrent  = stage.level === effectiveStage;
              const isPast     = effectiveStageIdx > idx;
              const isExpanded = expandedLevel === stage.level;
              const accent     = LEVEL_ACCENT[stage.level] ?? LEVEL_ACCENT.A1;
              const levelLessons = lessonsByLevel[stage.level] ?? [];
              const doneCnt    = levelLessons.filter(l => l.studied).length;
              const pctLevel   = levelLessons.length > 0 ? Math.round((doneCnt / levelLessons.length) * 100) : 0;
              const isLocked   = !isCurrent && !isPast && idx > effectiveStageIdx + 1;

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
                            Complete {effectiveStage} first to unlock this level
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
                  Want a personalised week-by-week 30-day plan for {effectiveStage}?
                </p>
                <Button className="w-full font-bold" disabled={planStreaming} onClick={generatePlan}>
                  {planStreaming
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating your plan…</>
                    : <><Zap className="w-4 h-4 mr-2" />Generate My 30-Day Plan</>}
                </Button>
                {planText && (
                  <div className="rounded-xl border bg-white p-4">
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
type LessonContent = {
  concept: string;
  examples: string[];
  practice: string;
  exercises: Exercise[];
};

const LESSON_CONTENT: Record<string, LessonContent> = {
  // ── A1 Foundation ───────────────────────────────────────────────────────────
  l1: {
    concept: "Greetings set the tone. Use 'Good morning/afternoon/evening' formally and 'Hi/Hello' casually. Always add your name when meeting someone new.",
    examples: [
      '"Good morning! I\'m Suresh from the accounts team." (office, first meeting)',
      '"Hi Priya! How are you doing today?" (casual, with a colleague)',
      '"Hello, this is Anita calling from ABC Ltd." (phone call)',
    ],
    practice: "Introduce yourself out loud — your name, where you work or study, and one friendly sentence.",
    exercises: [
      { q: "Which greeting is MOST appropriate for a first meeting with a senior manager?", options: ["Hey, what's up?", "Good morning, sir. I'm Rahul, the new analyst. Pleased to meet you.", "Hi!", "Hello there."], answer: 1 },
      { q: "You're calling a company for the first time. What do you say after 'Hello'?", options: ["I need some help.", "This is Priya calling from InfoTech. May I speak with the HR manager?", "Give me the HR person.", "Is anyone there?"], answer: 1 },
      { q: "Your colleague introduces you to a client. What's the best response?", options: ["Nice.", "Hi.", "It's a pleasure to meet you. I've heard great things about your company.", "Cool, let's talk business."], answer: 2 },
    ],
  },
  l2: {
    concept: "Present Simple = habits, facts, routines. Add -s/-es for He/She/It. Use do/does for questions and negatives.",
    examples: [
      '"I work in Pune. She works in Delhi." (He/She always gets +s)',
      '"We have a team meeting every Monday." (regular habit)',
      '"Does he speak English? I don\'t understand." (question + negative)',
    ],
    practice: "Write 3 sentences: one thing you do every day, one thing a friend does, and one yes/no question.",
    exercises: [
      { q: "Which sentence is correct?", options: ["She work in Bengaluru.", "She works in Bengaluru.", "She is work in Bengaluru.", "She working in Bengaluru."], answer: 1 },
      { q: "How do you make a negative sentence with 'He'?", options: ["He not like this job.", "He don't like this job.", "He doesn't like this job.", "He isn't like this job."], answer: 2 },
      { q: "Which sentence uses Present Simple correctly for a habit?", options: ["I am going to office every Monday.", "I go to the office every Monday.", "I went to office every Monday.", "I have gone to office every Monday."], answer: 1 },
    ],
  },
  l3: {
    concept: "In shops: greet the shopkeeper, state what you need clearly, ask the price politely, thank them before leaving.",
    examples: [
      '"Excuse me, do you have this in size 32?" (asking for a product)',
      '"How much does this cost, please? Is there any discount?" (checking price)',
      '"Please give me two bottles of water and a packet of biscuits." (placing an order)',
    ],
    practice: "Role-play out loud: You're at a mobile shop asking about a new phone. What do you say?",
    exercises: [
      { q: "You want to know the price. Which phrase is most polite?", options: ["Price?", "Money?", "How much does this cost, please?", "Tell me the price."], answer: 2 },
      { q: "The item you want is out of stock. What do you say?", options: ["Okay, forget it.", "Do you have any similar items in stock?", "This shop is bad.", "Give me something else."], answer: 1 },
      { q: "You want to buy 2 items. Which sentence is correct?", options: ["Give me two of this.", "I will take two of these, please.", "Two, please.", "I want this two times."], answer: 1 },
    ],
  },
  l4: {
    concept: "Describe your day using time sequence words: first, then, after that, next, finally. They show the order of events clearly.",
    examples: [
      '"First I wake up at 6, then I brush my teeth and have tea."',
      '"After breakfast, I take the metro to the office."',
      '"Finally, I go to bed around 10:30 after watching the news."',
    ],
    practice: "Speak or write 4–5 sentences about your morning — from waking up to leaving home.",
    exercises: [
      { q: "Which word BEST shows the ORDER of events?", options: ["Because", "Although", "After that", "However"], answer: 2 },
      { q: "'_____ I wake up, I drink a glass of water.' Which fits best?", options: ["While", "Because", "Although", "First,"], answer: 3 },
      { q: "Which describes a morning routine MOST clearly?", options: ["I wake. I eat. I go.", "Waking up and eating and going.", "First, I wake up at 6. Then I have breakfast. After that, I leave for work.", "I usually be waking up early."], answer: 2 },
    ],
  },
  l13: {
    concept: "Prepositions of place show WHERE things are. Key ones: IN (enclosed space), ON (surface), AT (specific point), UNDER (below), NEXT TO (beside).",
    examples: [
      '"The documents are IN the drawer." (enclosed)',
      '"The report is ON your desk, ON the third floor." (surface + floor)',
      '"Meet me AT the reception AT 9 AM." (specific point)',
    ],
    practice: "Look around you right now. Say 5 sentences describing where things are using in, on, at, under, next to.",
    exercises: [
      { q: "The HR office is _____ the second floor.", options: ["in", "on", "at", "under"], answer: 1 },
      { q: "'I'll meet you _____ the reception at 9 AM.' Which preposition fits?", options: ["in", "on", "at", "by"], answer: 2 },
      { q: "The printer is _____ the corner of the room.", options: ["at", "on", "in", "under"], answer: 0 },
    ],
  },
  l14: {
    concept: "The 20 most-used English verbs form the backbone of daily conversation: go, come, take, give, want, need, make, get, know, think, see, say, tell, ask, work, use, find, feel, keep, let.",
    examples: [
      '"Can you GIVE me the updated file? I NEED it for the meeting."',
      '"I KNOW she WENT to the client site. She SAID she\'d be back by 3."',
      '"Please TAKE a look at this. FIND the error and LET me know."',
    ],
    practice: "Write 3 sentences about your work using at least 5 different action verbs from the list above.",
    exercises: [
      { q: "'Can you _____ this document to the client by tonight?' Which verb fits?", options: ["go", "come", "send", "need"], answer: 2 },
      { q: "'I _____ more time to complete this project.' Which verb fits?", options: ["go", "take", "give", "need"], answer: 3 },
      { q: "'Please _____ a look at this report before the meeting.' Which verb fits?", options: ["go", "take", "give", "come"], answer: 1 },
    ],
  },
  // ── A2 Elementary ────────────────────────────────────────────────────────────
  l5: {
    concept: "Core office words every professional needs: meeting, deadline, agenda, feedback, update, presentation, report, approve, pending, follow-up.",
    examples: [
      '"We have a team meeting at 3 pm. Please check the agenda on email."',
      '"The report is still pending — I\'m waiting for your feedback."',
      '"Can you approve this by Friday? The deadline is Monday."',
    ],
    practice: "Use 5 of these words — meeting, deadline, update, approve, follow-up — in sentences from your own work life.",
    exercises: [
      { q: "Your boss says 'Please send me an update by EOD.' What does EOD mean?", options: ["End of Department", "End of Day", "Every Other Day", "Email on Demand"], answer: 1 },
      { q: "'The project is still _____. I'm waiting for your approval.' Which word fits?", options: ["complete", "finished", "pending", "done"], answer: 2 },
      { q: "'We need to _____ up on the client call from last Tuesday.' Which word fits?", options: ["look", "catch", "check", "follow"], answer: 3 },
    ],
  },
  l6: {
    concept: "Past Simple = finished actions. Regular verbs add -ed (worked, studied). Common irregulars: go→went, see→saw, take→took, have→had, say→said.",
    examples: [
      '"I worked late yesterday. She finished the project on time." (regular)',
      '"We went to Hyderabad last month. I saw him at the station." (irregular)',
      '"Did you eat lunch? I didn\'t have time — I had a meeting." (question + negative)',
    ],
    practice: "Tell 4 things you did yesterday — use at least 2 irregular verbs.",
    exercises: [
      { q: "Which sentence uses Past Simple CORRECTLY?", options: ["I go to Hyderabad last week.", "I went to Hyderabad last week.", "I am went to Hyderabad last week.", "I have go to Hyderabad last week."], answer: 1 },
      { q: "Which is the correct past form of 'see'?", options: ["seed", "seened", "saw", "seen"], answer: 2 },
      { q: "How do you make a Past Simple question?", options: ["Went you to the meeting?", "Did you went to the meeting?", "Did you go to the meeting?", "You did go to the meeting?"], answer: 2 },
    ],
  },
  l9: {
    concept: "Dates: say Day + Month + Year in full. Times: use AM/PM or 24-hour clock. Large numbers: say 'lakh' and 'crore' — the Indian number system works perfectly in English.",
    examples: [
      '"The meeting is on the fifteenth of June, 2024." (say dates fully)',
      '"It starts at half past three — 3:30 PM." (time expressions)',
      '"My CTC is twelve lakh per annum." (Indian number system in English)',
    ],
    practice: "Say out loud: today's date, your date of birth, and the current time — all in complete English sentences.",
    exercises: [
      { q: "How do you say the date '15/06/2024' in formal English?", options: ["Fifteen-six-twenty-twenty-four", "The fifteenth of June, twenty twenty-four", "June fifteen, two thousand twenty-four", "15th June, 2024 (written only, not spoken)"], answer: 1 },
      { q: "Your salary is ₹8,50,000 per year. How do you say this in English?", options: ["Eight thousand five hundred thousand", "Eight lakh fifty thousand rupees per annum", "Eight point five lakh", "850 thousand rupees"], answer: 1 },
      { q: "The meeting is at 'half past three.' What time is this?", options: ["3:15 PM", "3:45 PM", "3:30 PM", "2:30 PM"], answer: 2 },
    ],
  },
  l10: {
    concept: "Question words: What (thing), Who (person), Where (place), When (time), Why (reason), How (manner/degree). Use do/does/did for simple tense questions.",
    examples: [
      '"What do you do for work? Where do you currently live?"',
      '"Who did you report to in your last job?"',
      '"Why are you looking for a change? How did you hear about this role?"',
    ],
    practice: "Write 5 questions you might ask a hiring manager at the end of a job interview.",
    exercises: [
      { q: "'_____ did you leave your last job?' — asking for a REASON.", options: ["What", "Where", "When", "Why"], answer: 3 },
      { q: "'_____ is responsible for the accounts department?' — asking for a PERSON.", options: ["What", "Who", "Which", "Where"], answer: 1 },
      { q: "'_____ did you hear about this position?' — asking about METHOD.", options: ["When", "Why", "How", "What"], answer: 2 },
    ],
  },
  l15: {
    concept: "Present Continuous = actions happening RIGHT NOW or around this period. Form: am/is/are + verb-ing. Do NOT use it for permanent facts or habits.",
    examples: [
      '"I am working on the Q3 report right now." (happening now)',
      '"She is preparing a presentation for Monday\'s meeting." (ongoing this week)',
      '"We are hiring for three new positions this quarter." (current period)',
    ],
    practice: "Look at what you and your colleagues are doing right now. Say 4 sentences using Present Continuous.",
    exercises: [
      { q: "Which sentence uses Present Continuous CORRECTLY?", options: ["I working on the report now.", "I am working on the report right now.", "I am work on the report now.", "I works on the report now."], answer: 1 },
      { q: "When do we use Present Continuous instead of Present Simple?", options: ["For permanent facts", "For things happening RIGHT NOW or around this period", "For past events", "For future plans only"], answer: 1 },
      { q: "'She _____ a presentation for Monday.' Which fits for something in progress this week?", options: ["prepares", "prepared", "is preparing", "has prepare"], answer: 2 },
    ],
  },
  l16: {
    concept: "Comparatives compare two things (better, larger, more expensive). Superlatives compare one against all others (the best, the largest, the most expensive). Irregular: good→better→the best, bad→worse→the worst.",
    examples: [
      '"This offer is BETTER than the last one." (comparative)',
      '"This is THE BEST opportunity I\'ve had." (superlative)',
      '"Bangalore is LARGER THAN Pune in terms of tech companies." (comparative)',
    ],
    practice: "Compare two job offers you've received (or imagine two). Use 4 comparatives and 2 superlatives.",
    exercises: [
      { q: "Which comparative form is CORRECT?", options: ["This job is more better.", "This job is gooder.", "This job is better.", "This job is more good."], answer: 2 },
      { q: "'This is _____ offer I have received.' Which superlative form is correct?", options: ["the more good", "the best", "the goodest", "the most best"], answer: 1 },
      { q: "'Bangalore is _____ Pune in terms of tech jobs.' Fill in correctly.", options: ["more large than", "larger as", "larger than", "more larger than"], answer: 2 },
    ],
  },
  // ── B1 Intermediate ──────────────────────────────────────────────────────────
  l7: {
    concept: "Common HR interview question types: Behavioural ('Tell me about a time…'), Situational ('What would you do if…'), and Competency ('What are your strengths?'). Prepare a 60-second answer for each.",
    examples: [
      '"Tell me about yourself." → Name + education + key skill + career goal in 4–5 sentences.',
      '"Why this company?" → Research + how your skills match their work.',
      '"Describe a challenge you faced." → Situation → what YOU did → positive result.',
    ],
    practice: "Answer out loud right now: 'Tell me about yourself.' — aim for 60 seconds, no more.",
    exercises: [
      { q: "'Tell me about a time you solved a problem.' This is an example of what type of question?", options: ["Technical question", "Trick question", "Behavioural question", "Situational question"], answer: 2 },
      { q: "In an interview, HR asks 'What is your notice period?' What do they want to know?", options: ["When your contract expires", "How long until you can join if hired", "Why you are leaving your current job", "How many years you have worked"], answer: 1 },
      { q: "The interviewer says 'We'll get back to you.' What does this mean?", options: ["They rejected you.", "They want you to call back.", "They will contact you later with their decision.", "The interview is over immediately."], answer: 2 },
    ],
  },
  l8: {
    concept: "STAR answers impress interviewers. S = Situation, T = Task (your role), A = Action (what YOU did), R = Result (outcome). Always end with a measurable positive result.",
    examples: [
      '"In my last job (S), I was asked to lead a data cleanup project (T)..."',
      '"I organised the files and trained 3 team members on the new system (A)..."',
      '"...which reduced errors by 30% and saved 2 hours per week (R)."',
    ],
    practice: "Pick one challenge from your own life. Tell it in STAR format — out loud, 45–60 seconds.",
    exercises: [
      { q: "The STAR method stands for:", options: ["Skills, Training, Achievements, Results", "Situation, Task, Action, Result", "Strength, Talent, Ability, Responsibility", "Story, Theme, Argument, Resolution"], answer: 1 },
      { q: "You're asked 'What is your greatest weakness?' The BEST response is:", options: ["I have no weaknesses.", "I am too hardworking.", "I sometimes struggle with public speaking, so I've been practising by volunteering to present in team meetings.", "I can't think of any right now."], answer: 2 },
      { q: "'Tell me about yourself' should be approximately:", options: ["10–15 minutes long, very detailed", "5–10 seconds — just your name", "60–90 seconds covering education, experience, and career goal", "As long as possible to impress them"], answer: 2 },
    ],
  },
  l11: {
    concept: "Reading job ads: look for Role (what the job is), Requirements (skills + experience), Responsibilities (daily tasks), Benefits, and How to apply.",
    examples: [
      '"Required: 2+ years experience, B.Com/MBA, proficiency in MS Excel." (requirements)',
      '"Responsibilities: manage accounts payable, prepare monthly MIS reports." (duties)',
      '"Send CV to hr@company.com with subject \'Application – Accounts Executive\'." (apply)',
    ],
    practice: "Find one real job ad on Naukri or LinkedIn. Write: the role, 3 requirements, 2 responsibilities.",
    exercises: [
      { q: "A job ad says 'CTC: ₹5–7 LPA.' What does LPA mean?", options: ["Lakhs Per Annum", "Location Per Assignment", "Leave Per Allowance", "Learning Per Activity"], answer: 0 },
      { q: "The ad says 'Required: Proficiency in MS Excel.' This is listed under:", options: ["Responsibilities", "Benefits", "Requirements / Qualifications", "Company description"], answer: 2 },
      { q: "To apply, you should 'Send your CV with subject \'Application – Sales Executive\'.' What does this mean?", options: ["Email your CV with a specific email subject line", "Walk in with your CV", "Upload your CV to the company website", "Call the HR number with your details"], answer: 0 },
    ],
  },
  l12: {
    concept: "A professional call has 5 parts: greet + state your name → give your reason for calling → share key details → confirm the next step → close politely.",
    examples: [
      '"Hello, this is Amit Sharma calling from TechSolutions. May I speak with the HR manager?"',
      '"I\'m calling to follow up on the interview I attended last Wednesday."',
      '"Could you let me know the next steps? Thank you so much for your time."',
    ],
    practice: "Role-play with a friend: you're following up on a job application you submitted 5 days ago.",
    exercises: [
      { q: "You call a company and the receptionist answers. What do you say first?", options: ["Is HR there?", "Connect me to someone.", "Hello, this is [Name] from [Company]. May I please speak with [Person]?", "Hello? Hello?"], answer: 2 },
      { q: "The person you need is away. What's the BEST thing to do?", options: ["Just hang up.", "Leave an angry message.", "Could you please take a message, or let me know when would be a good time to call back?", "Call the same number 5 times."], answer: 2 },
      { q: "To end a professional call politely, you should:", options: ["Just stop talking.", "Say 'bye bye bye' repeatedly.", "Thank the person for their time, confirm next steps if any, then say goodbye.", "Hang up when you are done."], answer: 2 },
    ],
  },
  l17: {
    concept: "In professional settings, opinions must be framed carefully. Use hedges ('I think', 'In my view', 'I wonder if') to sound thoughtful, not aggressive. Disagreement works best with acknowledge→counter structure.",
    examples: [
      '"In my view, we might want to reconsider the timeline." (soft opinion)',
      '"I see your point; however, I wonder if we could also consider the budget impact." (polite counter)',
      '"That\'s a valid perspective — I\'d add that the client feedback also suggests..." (build on others)',
    ],
    practice: "Think of a decision at work or college you disagree with. Frame your opinion using 3 different hedging phrases.",
    exercises: [
      { q: "Which phrase is the MOST professional way to share an opinion in a meeting?", options: ["I think we should change the plan.", "In my view, we might want to reconsider the timeline.", "Obviously, you're all wrong.", "I feel like this is bad."], answer: 1 },
      { q: "How do you politely DISAGREE with a colleague's idea?", options: ["That's a terrible idea.", "No, that's wrong.", "I see your point; however, I wonder if we could also consider...", "I don't agree with you at all."], answer: 2 },
      { q: "'I take your point, but...' is used to:", options: ["Fully agree with someone", "End the conversation", "Acknowledge a point while introducing a counterargument", "Ask for clarification"], answer: 2 },
    ],
  },
  l18: {
    concept: "A professional email has 5 parts: Subject (specific and clear) → Greeting (Dear Mr./Ms. Surname) → Body (reason → details → action needed) → Closing (Regards/Yours sincerely) → Signature.",
    examples: [
      '"Subject: Application for Sales Executive – Neha Sharma" (clear + your name)',
      '"Dear Ms. Kapoor, I am writing to follow up on my application submitted on 10 June." (formal opening)',
      '"Please find my updated CV attached. I look forward to hearing from you." (call to action + close)',
    ],
    practice: "Write a short follow-up email (5–6 sentences) after a job interview you attended yesterday.",
    exercises: [
      { q: "Which is the BEST subject line for a job application email?", options: ["Job", "Hi", "Application for Sales Executive – [Your Name]", "Please read this email"], answer: 2 },
      { q: "Which opening is MOST appropriate for a professional email?", options: ["Hey John!!!", "Yo,", "Dear Mr. Sharma,", "To who it concerns,"], answer: 2 },
      { q: "Which closing is MOST professional?", options: ["Bye!", "Cya later", "Regards, [Your Name]", "Love,"], answer: 2 },
    ],
  },
  // ── B2 Upper-Intermediate ────────────────────────────────────────────────────
  l19: {
    concept: "Three conditional types: Zero (always true: if + present, present), First (likely future: if + present, will), Second (hypothetical: if + past, would), Third (past regret: if + had + past participle, would have).",
    examples: [
      '"If you heat water to 100°C, it boils." (Zero — always true)',
      '"If I get this role, I will relocate to Mumbai." (First — real future possibility)',
      '"If I had applied earlier, I would have been shortlisted." (Third — past regret)',
    ],
    practice: "Write one sentence for each conditional type using your own career situation.",
    exercises: [
      { q: "Which First Conditional sentence is CORRECT?", options: ["If I will get the job, I will move to Mumbai.", "If I get the job, I will move to Mumbai.", "If I got the job, I will move to Mumbai.", "If I get the job, I would move to Mumbai."], answer: 1 },
      { q: "'If I _____ harder, I would have passed the exam.' (Third Conditional) Which fits?", options: ["studied", "had studied", "study", "have studied"], answer: 1 },
      { q: "Which sentence expresses a GENERAL truth (Zero Conditional)?", options: ["If I study, I will pass.", "If I would study, I pass.", "If you heat water to 100°C, it boils.", "If I had studied, I would pass."], answer: 2 },
    ],
  },
  l20: {
    concept: "Register = the level of formality. Formal English uses longer, Latinate words (commence, assist, endeavour). Informal uses short, Anglo-Saxon words (start, help, try). Emails, reports, and interviews need formal register.",
    examples: [
      '"I would like to REQUEST a meeting." (formal) vs "Can we MEET?" (informal)',
      '"Please ASSIST me with this matter." vs "Please HELP me with this."',
      '"We will COMMENCE the project next Monday." vs "We\'ll START next Monday."',
    ],
    practice: "Rewrite these informal sentences formally: 'Hi, can you help me? I wanna ask about the job. Thanks!'",
    exercises: [
      { q: "The FORMAL equivalent of 'start' is:", options: ["begin", "commence", "kick off", "get going"], answer: 1 },
      { q: "Which version is MOST appropriate for a cover letter?", options: ["I'm writing to ask about the job you posted.", "I am writing to apply for the position of Sales Manager advertised on LinkedIn.", "Hey! I saw your job listing and I want it.", "Please give me a job interview."], answer: 1 },
      { q: "In a professional email, 'ASAP' should be replaced with:", options: ["Quick", "Now", "As soon as possible", "RSVP"], answer: 2 },
    ],
  },
  l21: {
    concept: "In business meetings: listen for the AGENDA (what topics will be covered), ACTION POINTS (who does what by when), and DECISIONS. Polite disagreement uses softeners: 'I'm not sure I agree,' 'Could we look at this differently?'",
    examples: [
      '"Let\'s table that for now and move to the next item." (postpone a topic)',
      '"To summarise the key takeaways from today\'s meeting..." (signalling a conclusion)',
      '"Any other business before we close?" (inviting final topics)',
    ],
    practice: "Listen to any business podcast in English for 5 minutes. Write 3 action points you heard (or inferred).",
    exercises: [
      { q: "In a meeting, someone says 'Let's table that for now.' What do they mean?", options: ["Put it on the table to look at", "Postpone discussing it until later", "Delete the item from the agenda", "Stand at the table"], answer: 1 },
      { q: "A presenter says 'To summarise the key takeaways...' This phrase signals:", options: ["A new topic is starting", "A question is being asked", "The presenter is concluding and highlighting main points", "The presentation is being cancelled"], answer: 2 },
      { q: "In a meeting, 'Any other business?' means:", options: ["Does anyone want to do business with us?", "Is there any additional topic someone wants to raise?", "Can we discuss the budget?", "Should we leave now?"], answer: 1 },
    ],
  },
  l22: {
    concept: "Salary negotiation: research market rates first, give a range (not a single number), anchor high within reason, justify with experience, and stay collaborative — you're building a working relationship.",
    examples: [
      '"Based on my experience and market research, I\'m looking for a range of ₹10–12 LPA." (range + justification)',
      '"I appreciate the offer. Could we discuss bringing this closer to ₹11 LPA given my 4 years in this domain?" (counter)',
      '"I\'m very excited about the role — this is my priority consideration right now." (signal genuine interest)',
    ],
    practice: "Role-play: the company offers ₹8 LPA. You expected ₹10. Negotiate out loud for 2 minutes.",
    exercises: [
      { q: "How should you BEST respond when asked 'What salary are you expecting?'", options: ["As much as possible.", "Based on my experience and industry research, I'm looking for a range of ₹X–Y.", "Whatever you give me.", "I can't say."], answer: 1 },
      { q: "The company offers ₹8 LPA but you expected ₹10 LPA. What do you say?", options: ["That's too low, I won't take it.", "I appreciate the offer. Given my experience in this domain, could we discuss bringing this closer to ₹10 LPA?", "Okay, I accept.", "Give me more money."], answer: 1 },
      { q: "'The role aligns perfectly with my goals' is an example of:", options: ["Making a demand", "Complaining about the offer", "Building your case by showing genuine interest before negotiating", "Rejecting the offer"], answer: 2 },
    ],
  },
  // ── C1 Advanced ─────────────────────────────────────────────────────────────
  l23: {
    concept: "Passive voice focuses on the ACTION or RESULT, not who did it — essential for formal writing. Reported speech shifts tenses back one step: 'I will call' → 'She said she would call.'",
    examples: [
      '"The annual report was submitted on time." (passive — what matters is the submission)',
      '"She told me that the project had been completed ahead of schedule." (reported speech)',
      '"Mistakes were made; corrective action has been taken." (passive in corporate communication)',
    ],
    practice: "Rewrite these active sentences in passive: 'The team finished the report. The manager approved the budget.'",
    exercises: [
      { q: "Which sentence is in the PASSIVE voice?", options: ["The team submitted the report on time.", "The report was submitted by the team on time.", "The team has submitted the report.", "Submit the report on time."], answer: 1 },
      { q: "'She said that she _____ the project.' (Reported Speech) Which fits?", options: ["is completing", "has completed", "was completing", "will complete"], answer: 2 },
      { q: "Why is passive voice used in formal writing?", options: ["To sound casual and friendly", "To focus on the action or result rather than who did it", "To make sentences shorter", "To avoid using verbs"], answer: 1 },
    ],
  },
  l24: {
    concept: "Idioms make you sound fluent, but overusing them sounds forced. Know when to use them (casual team chats) and when to avoid them (international clients, formal documents). Always understand before using.",
    examples: [
      '"Let\'s hit the ground running on Monday." (start work immediately and energetically)',
      '"Think outside the box here — we need a fresh approach." (creative solutions)',
      '"I\'ll touch base with the client after the demo." (check in / follow up)',
    ],
    practice: "Use 3 idioms from this lesson naturally in a spoken summary of your current project or studies.",
    exercises: [
      { q: "Your manager says 'Let's hit the ground running on Monday.' What does this mean?", options: ["Run a race on Monday", "Start working immediately and energetically", "Go for a walk to brainstorm", "Have an early morning meeting outside"], answer: 1 },
      { q: "'Think outside the box' means:", options: ["Work in a different office", "Organise your desk", "Consider creative or unconventional solutions", "Stop overthinking"], answer: 2 },
      { q: "When is it BEST to avoid idioms?", options: ["In casual conversations with colleagues", "When speaking with international clients who may not share the same cultural context", "In team meetings", "Never — idioms always improve communication"], answer: 1 },
    ],
  },
  l25: {
    concept: "Critical reading: SKIM for the main idea → SCAN for specific data → READ actively by questioning the author's claims, evidence quality, and possible bias. Always ask: Who wrote this, and why?",
    examples: [
      '"The article claims revenue rose 40% YoY — but it doesn\'t specify the base year." (questioning evidence)',
      '"The author works for the firm being praised — possible conflict of interest." (checking bias)',
      '"The headline says X, but the body data shows Y — check for spin." (spotting inconsistency)',
    ],
    practice: "Read one article from Economic Times or BBC Business. Write 3 sentences: main claim, one piece of evidence, one question you'd ask the author.",
    exercises: [
      { q: "When SKIMMING an article, you:", options: ["Read every word carefully for detail", "Read only the last paragraph", "Quickly read headings, subheadings, and first sentences to get the overall idea", "Look only at images"], answer: 2 },
      { q: "A business article says 'The firm's revenue surged 40% YoY.' What does YoY mean?", options: ["Year of Year", "Your or Yours", "Year on Year", "Yield or Yardstick"], answer: 2 },
      { q: "Critical reading means:", options: ["Reading very quickly", "Reading only the title", "Questioning the author's claims, sources, and whether the argument is well-supported", "Memorising every sentence"], answer: 2 },
    ],
  },
  l26: {
    concept: "A 3-minute presentation: Opening hook (question/fact/story) → State your 2–3 key points → Develop each briefly → Close with a clear action or takeaway. Signposting language guides your audience through the structure.",
    examples: [
      '"Firstly, let\'s look at the problem. Secondly, I\'ll present the data. Finally, I\'ll propose a solution." (signposting)',
      '"By the end of this, you\'ll understand why we need to act now." (strong opening)',
      '"To summarise: the cost is high, the ROI is clear, and the timeline is achievable. I recommend we proceed." (powerful close)',
    ],
    practice: "Prepare and deliver a 3-minute presentation on any topic you know well. Record yourself and play it back.",
    exercises: [
      { q: "A good 3-minute presentation should:", options: ["Cover as many topics as possible", "Have no structure — just speak freely", "Have a clear opening, 2–3 key points, and a strong closing statement", "Last exactly 3 minutes with no variation"], answer: 2 },
      { q: "'Signposting language' in a presentation means:", options: ["Using visual signs", "Repeating yourself", "Phrases that guide the audience through the presentation (e.g. 'Firstly', 'Moving on', 'To conclude')", "Using technical jargon"], answer: 2 },
      { q: "The BEST way to open a presentation is:", options: ["Start by apologising for being nervous", "Read your slides word for word", "Open with a relevant question, fact, or brief story to engage the audience", "Explain your entire life history first"], answer: 2 },
    ],
  },
  // ── C2 Mastery ───────────────────────────────────────────────────────────────
  l27: {
    concept: "Precision vocabulary separates C2 speakers. Key pairs: affect (verb) vs effect (noun), imply (speaker suggests) vs infer (listener concludes), comprise (contain as parts) vs consist of (be made up of).",
    examples: [
      '"The policy change will AFFECT our timeline." vs "The EFFECT on revenue was significant."',
      '"The data IMPLIES that demand is rising." vs "What do you INFER from this chart?"',
      '"The committee COMPRISES five members." (not \'comprises of\'!)',
    ],
    practice: "Write 6 sentences — one for each word in the three pairs above — using real examples from your field.",
    exercises: [
      { q: "'The results _____ that the campaign was successful.' Which word shows NUANCE correctly?", options: ["say", "suggest", "prove definitely", "tell"], answer: 1 },
      { q: "What is the difference between 'affect' and 'effect'?", options: ["No difference — they're the same", "'Affect' is usually the verb (to influence); 'effect' is usually the noun (the result)", "'Effect' is the verb; 'affect' is the noun", "Both are only used in science"], answer: 1 },
      { q: "'The policy comprises three key components.' The word 'comprises' means:", options: ["excludes", "consists of / includes", "replaces", "requires"], answer: 1 },
    ],
  },
  l28: {
    concept: "Advanced grammar for impact: Inversion (Had I known…), Cleft sentences (It is X that…), and Subjunctive (I suggest that he be…). These structures signal mastery and add emphasis or formality.",
    examples: [
      '"Had I known about the merger, I would have prepared differently." (Inversion — formal emphasis)',
      '"It is the product quality that sets us apart." (Cleft sentence — focus on key element)',
      '"The board recommends that she BE appointed immediately." (Subjunctive — formal recommendation)',
    ],
    practice: "Rewrite 3 simple sentences using inversion, a cleft sentence, and the subjunctive — make them sound boardroom-ready.",
    exercises: [
      { q: "'Had I known about the meeting, I would have attended.' This sentence uses:", options: ["Simple Past", "Present Perfect", "Inversion for formal/literary emphasis", "Past Continuous"], answer: 2 },
      { q: "'It is the marketing team that drives our growth.' This is an example of:", options: ["A passive sentence", "A relative clause", "A cleft sentence used for emphasis", "A conditional sentence"], answer: 2 },
      { q: "The subjunctive mood is used in which sentence?", options: ["He goes to work every day.", "She went to the conference.", "I suggest that he be promoted.", "They are attending the webinar."], answer: 2 },
    ],
  },
  l29: {
    concept: "Rapid speech features: connected speech (gonna, wanna, gonna, kinda, shoulda), elision (dropping sounds), and assimilation (sounds blending). The key is to focus on stressed words — those carry the meaning.",
    examples: [
      '"Going to" → "gonna" | "want to" → "wanna" | "would you" → "wudja"',
      '"Did you eat?" → "Dija eat?" (elision in fast speech)',
      '"Focus on KEY WORDS — nouns, verbs, adjectives carry the meaning; small words blur."',
    ],
    practice: "Watch 3 minutes of a TED talk or BBC report at normal speed. Note 5 words you couldn't catch — look them up.",
    exercises: [
      { q: "In rapid speech, 'going to' is often pronounced as:", options: ["'going to' — always fully pronounced", "'gonna'", "'goin'", "'goe-to'"], answer: 1 },
      { q: "Which strategy BEST helps you understand a speaker with an unfamiliar accent?", options: ["Ask them to repeat everything slowly", "Give up listening and read the transcript", "Focus on key words and context clues; ask for clarification only when the meaning is unclear", "Avoid speaking with them"], answer: 2 },
      { q: "'Would you' in fast British English often sounds like:", options: ["'would you' — always clear", "'wudja'", "'would ya'", "'wouldoo'"], answer: 1 },
    ],
  },
  l30: {
    concept: "C2 argumentation: state your position clearly → support with evidence → anticipate and concede valid counterpoints → rebut weak ones → close with the broader significance of your position.",
    examples: [
      '"While I understand your perspective, the data consistently suggests otherwise." (concession + rebuttal)',
      '"I take your point on cost — however, the long-term ROI makes this investment sound." (acknowledge → pivot)',
      '"In conclusion, the evidence supports X, and here\'s why this matters for our team..." (strong close)',
    ],
    practice: "Choose a workplace issue. Argue one side for 3 minutes, then argue the other side for 3 minutes. Record both.",
    exercises: [
      { q: "Which sentence BEST introduces a counterargument?", options: ["You are wrong.", "That makes no sense.", "While I understand your perspective, the data suggests a different conclusion.", "My point is better than yours."], answer: 2 },
      { q: "'Conceding a point' in debate means:", options: ["Agreeing with everything the other person says", "Stopping the debate", "Acknowledging that part of the opposing argument is valid before returning to your own position", "Repeating your point louder"], answer: 2 },
      { q: "Which is the STRONGEST way to end an argument?", options: ["So obviously I am right.", "Well, that's just my opinion.", "In conclusion, the evidence consistently supports this position, and here's why it matters: [impact].", "I think we should just agree to disagree."], answer: 2 },
    ],
  },
};

// ── Quiz section ──────────────────────────────────────────────────────────────
function QuizSection({
  exercises,
  onScore,
}: {
  exercises: Exercise[];
  onScore: (score: number) => void;
}) {
  const [answers, setAnswers]   = useState<Record<number, number>>({});
  const [checked, setChecked]   = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const allAnswered = exercises.every((_, i) => answers[i] !== undefined);

  function handleCheck() {
    const correct = exercises.filter((ex, i) => answers[i] === ex.answer).length;
    const score   = Math.round((correct / exercises.length) * 100);
    setChecked(true);
    setQuizScore(score);
    onScore(score);
  }

  function handleReset() {
    setAnswers({});
    setChecked(false);
    setQuizScore(null);
  }

  return (
    <div className="border border-primary/20 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
        <span className="text-xs font-extrabold text-primary uppercase tracking-widest">
          Test Yourself
        </span>
        {quizScore !== null && (
          <span className={`text-xs font-bold ${quizScore >= 70 ? "text-green-600" : "text-amber-600"}`}>
            {quizScore}% — {exercises.filter((ex, i) => answers[i] === ex.answer).length}/{exercises.length} correct
          </span>
        )}
      </div>
      <div className="px-4 py-3 space-y-4 bg-white/60">
        {exercises.map((ex, qi) => (
          <div key={qi} className="space-y-2">
            <p className="text-xs font-semibold text-secondary leading-snug">
              {qi + 1}. {ex.q}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {ex.options.map((opt, oi) => {
                const chosen  = answers[qi] === oi;
                const correct = ex.answer === oi;
                let cls = "border rounded-lg px-3 py-2 text-xs text-left transition-all cursor-pointer ";
                if (!checked) {
                  cls += chosen
                    ? "bg-primary/10 border-primary text-primary font-semibold"
                    : "bg-white border-border text-secondary hover:border-primary/40 hover:bg-primary/5";
                } else {
                  if (correct)            cls += "bg-green-50 border-green-400 text-green-800 font-semibold";
                  else if (chosen)        cls += "bg-red-50 border-red-300 text-red-700";
                  else                    cls += "bg-white border-border text-muted-foreground";
                }
                return (
                  <button
                    key={oi}
                    className={cls}
                    disabled={checked}
                    onClick={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                  >
                    <span className="font-mono text-muted-foreground mr-1.5">
                      {["A", "B", "C", "D"][oi]}.
                    </span>
                    {opt}
                    {checked && correct && (
                      <CheckCircle2 className="inline w-3.5 h-3.5 ml-1.5 text-green-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!checked ? (
          <Button
            size="sm"
            className="w-full font-bold mt-1"
            disabled={!allAnswered}
            onClick={handleCheck}
          >
            Check Answers
          </Button>
        ) : (
          <div className="flex gap-2 items-center pt-1">
            <div className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-center ${
              quizScore! >= 70
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-amber-50 border border-amber-200 text-amber-700"
            }`}>
              {quizScore! >= 70
                ? "Great work! Score auto-filled below — adjust if needed."
                : "Keep going! Review the highlighted answers and try again."}
            </div>
            {quizScore! < 70 && (
              <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={handleReset}>
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
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
  const staticContent = LESSON_CONTENT[lesson.id as keyof typeof LESSON_CONTENT];
  const [expanded, setExpanded] = useState(lesson.status === "new lesson");
  const [aiContent, setAiContent] = useState<{ concept: string; examples: string[]; practice: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
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
                    {staticContent?.exercises && staticContent.exercises.length > 0 && (
                      <QuizSection
                        exercises={staticContent.exercises}
                        onScore={v => { onScoreChange(v); setQuizDone(true); }}
                      />
                    )}
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
              <span className="text-muted-foreground">
                {quizDone ? "Quiz score (adjust if needed):" : "How well did you recall this?"}
              </span>
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
