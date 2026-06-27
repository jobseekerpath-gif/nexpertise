import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProgress } from "@/lib/use-progress";
import { useAuth } from "@/lib/use-auth";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useLocation } from "wouter";
import { OverviewTab } from "@/components/progress/overview-tab";
import { LearningTab } from "@/components/progress/learning-tab";
import { InterviewsTab } from "@/components/progress/interviews-tab";
import { CareerTab } from "@/components/progress/career-tab";
import { PageMeta } from "@/components/page-meta";
import {
  BookOpen, Mic, Newspaper, BarChart3, LogIn, TrendingUp, Award, Star, Zap, Target,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "learning", label: "Learning", icon: BookOpen },
  { key: "interviews", label: "Interviews", icon: Mic },
  { key: "career", label: "Career", icon: Newspaper },
];

// ─── XP / level system ───────────────────────────────────────────────────────
const LEVELS = [
  { name: "Newcomer", emoji: "🌱", min: 0 },
  { name: "Learner", emoji: "📚", min: 200 },
  { name: "Practitioner", emoji: "💡", min: 500 },
  { name: "Communicator", emoji: "🗣️", min: 1000 },
  { name: "Fluent Speaker", emoji: "⭐", min: 1800 },
  { name: "Expert", emoji: "🏆", min: 3000 },
];

function getLevel(xp: number) {
  const idx = LEVELS.findIndex((l, i) => i === LEVELS.length - 1 || xp < LEVELS[i + 1]!.min);
  const current = LEVELS[idx]!;
  const next = LEVELS[idx + 1];
  const prevMin = current.min;
  const nextMin = next?.min ?? prevMin + 1000;
  const pct = Math.min(100, Math.round(((xp - prevMin) / (nextMin - prevMin)) * 100));
  return { ...current, xp, pct, next, nextMin };
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { user } = useAuth();
  const { profile } = useStudentProfile();
  const { entries, streak, totalSessions, avgScore, byTool } = useProgress();
  const [, navigate] = useLocation();

  // Server-side stats (logged-in only)
  const [serverStats, setServerStats] = useState<{ totalLearning: number; totalInterviews: number; averageScore: number; streak: number } | null>(null);
  const validTab = (key: string): string => {
    if (TABS.some(t => t.key === key)) return key;
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return validTab(window.location.hash.replace("#", "") || "overview");
    }
    return "overview";
  });

  useEffect(() => {
    if (!user) return;
    fetch(`${BASE}/api/profile/stats`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setServerStats(d))
      .catch(() => { /* use local */ });
  }, [user]);

  // Persist tab in URL hash
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${activeTab}`);
  }, [activeTab]);

  // Sync hash on popstate
  useEffect(() => {
    const handler = () => setActiveTab(validTab(window.location.hash.replace("#", "") || "overview"));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const totalLearning = serverStats?.totalLearning ?? byTool["English Guru"];
  const totalInterviews = serverStats?.totalInterviews ?? byTool["Interview Ace"];
  const currentStreak = serverStats?.streak ?? streak;
  const currentAvgScore = serverStats?.averageScore ?? avgScore;

  const totalSess = serverStats ? (serverStats.totalLearning + serverStats.totalInterviews) : totalSessions;
  const xp = totalSess * 10 + currentAvgScore * 2 + currentStreak * 25;
  const level = getLevel(xp);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <PageMeta title="My Progress" description="Track your English learning, mock interview scores, saved jobs, and career readiness on EduBharat." />
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">My Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {profile.name ? `${profile.name}'s` : "Your"} learning journey at a glance
          </p>
        </div>
        {!user && (
          <Button variant="outline" onClick={() => navigate("/login")} size="sm">
            <LogIn className="w-3.5 h-3.5 mr-1.5" />Sign in to sync
          </Button>
        )}
      </div>

      {/* ── Level / XP hero ── */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-orange-50 to-white shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{level.emoji}</span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Level</div>
                <div className="text-xl font-display font-bold text-secondary">{level.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-primary">{xp.toLocaleString("en-IN")} XP</div>
              {level.next && (
                <div className="text-xs text-muted-foreground">{(level.nextMin - xp).toLocaleString("en-IN")} XP to {level.next.name}</div>
              )}
            </div>
          </div>
          <Progress value={level.pct} className="h-3 bg-orange-100" />
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>{level.min.toLocaleString("en-IN")} XP</span>
            <span className="font-semibold text-primary">{level.pct}%</span>
            {level.next && <span>{level.nextMin.toLocaleString("en-IN")} XP</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Tab navigation ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="min-h-[300px]">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "learning" && <LearningTab />}
        {activeTab === "interviews" && <InterviewsTab />}
        {activeTab === "career" && <CareerTab />}
      </div>
    </div>
  );
}
