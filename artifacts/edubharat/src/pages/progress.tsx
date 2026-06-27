import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProgress } from "@/lib/use-progress";
import { useHistory } from "@/lib/use-history";
import { useAuth } from "@/lib/use-auth";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useLocation } from "wouter";
import {
  Flame, Trophy, BookOpen, Mic, Newspaper, Star, Zap, Target,
  TrendingUp, Calendar, BarChart2, Award, MessageCircle, Pencil,
  Brain, LogIn, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// ─── Types ───────────────────────────────────────────────────────────────────
type ServerStats = { totalLearning: number; totalInterviews: number; averageScore: number; streak: number };
type ApiInterviewSession = {
  id: number;
  role: string;
  interviewType: string | null;
  overallScore: number | null;
  communicationScore: number | null;
  grammarScore: number | null;
  confidenceScore: number | null;
  technicalScore: number | null;
  createdAt: string;
};

// ─── Colour palette ───────────────────────────────────────────────────────────
const TOOL_COLORS = {
  "English Guru": "#f97316",
  "Interview Ace": "#3b82f6",
  "Rozgar Samachar": "#a855f7",
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : "#ef4444";

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

// ─── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first_session", title: "First Step", desc: "Complete your first session", icon: Star, check: (s: number) => s >= 1 },
  { id: "streak_3", title: "3-Day Flame", desc: "3-day learning streak", icon: Flame, check: (_: number, streak: number) => streak >= 3 },
  { id: "sessions_10", title: "Dedicated", desc: "10 total sessions", icon: BookOpen, check: (s: number) => s >= 10 },
  { id: "interview_5", title: "Interview Warrior", desc: "5 mock interviews", icon: Mic, check: (_: number, __: number, interviews: number) => interviews >= 5 },
  { id: "score_80", title: "High Scorer", desc: "Average interview score ≥ 80%", icon: Trophy, check: (_: number, __: number, ___: number, avgScore: number) => avgScore >= 80 },
  { id: "streak_7", title: "Week Warrior", desc: "7-day streak", icon: Flame, check: (_: number, streak: number) => streak >= 7 },
  { id: "sessions_50", title: "Power Learner", desc: "50 sessions completed", icon: Zap, check: (s: number) => s >= 50 },
  { id: "score_90", title: "Interview Pro", desc: "Average score ≥ 90%", icon: Award, check: (_: number, __: number, ___: number, avgScore: number) => avgScore >= 90 },
];

// ─── 30-day calendar grid ─────────────────────────────────────────────────────
function ActivityCalendar({ entries }: { entries: { date: string }[] }) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const count = entries.filter(e => e.date === dateStr).length;
    return { date: dateStr, count, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });

  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div
      className="flex flex-wrap gap-1"
      role="grid"
      aria-label="30-day activity calendar"
    >
      {days.map(day => {
        const intensity = day.count === 0 ? 0 : Math.ceil((day.count / max) * 4);
        const bg = intensity === 0 ? "bg-muted" :
          intensity === 1 ? "bg-orange-200" :
          intensity === 2 ? "bg-orange-300" :
          intensity === 3 ? "bg-orange-400" : "bg-orange-500";
        return (
          <div
            key={day.date}
            role="gridcell"
            aria-label={`${day.label}: ${day.count} session${day.count !== 1 ? "s" : ""}`}
            title={`${day.label}: ${day.count} session${day.count !== 1 ? "s" : ""}`}
            className={`w-5 h-5 sm:w-6 sm:h-6 rounded-sm cursor-default transition-transform hover:scale-110 ${bg}`}
          />
        );
      })}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-2xl font-display font-bold text-secondary">{value}</div>
        <div className="text-sm font-semibold text-secondary mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Custom tooltip for recharts ─────────────────────────────────────────────
function ScoreTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; score: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  return (
    <div className="bg-card border rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-secondary">{d.label}</p>
      <p style={{ color: SCORE_COLOR(d.score) }} className="font-bold">{d.score}%</p>
    </div>
  );
}

function ActivityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-secondary">{label}</p>
      <p className="text-primary font-bold">{payload[0]!.value} session{payload[0]!.value !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProgressPage() {
  const { user } = useAuth();
  const { profile } = useStudentProfile();
  const { entries, interviewScores, activityByDay, streak, totalSessions, avgScore, byTool } = useProgress();
  const { items: historyItems } = useHistory();
  const [, navigate] = useLocation();

  // Server-side stats (logged-in only)
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [apiInterviews, setApiInterviews] = useState<ApiInterviewSession[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch(`${BASE}/api/profile/stats`, { credentials: "include" })
      .then(r => r.json())
      .then((d: ServerStats) => setServerStats(d))
      .catch(() => {/* use local */});

    fetch(`${BASE}/api/sessions/interview?limit=20`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { sessions?: ApiInterviewSession[] }) => setApiInterviews(d.sessions ?? []))
      .catch(() => {/* use local */});
  }, [user]);

  // Merge local + server stats
  const totalLearning = serverStats?.totalLearning ?? byTool["English Guru"];
  const totalInterviews = serverStats?.totalInterviews ?? byTool["Interview Ace"];
  const currentStreak = serverStats?.streak ?? streak;
  const currentAvgScore = serverStats?.averageScore ?? avgScore;

  // XP calculation
  const totalSess = serverStats ? (serverStats.totalLearning + serverStats.totalInterviews) : totalSessions;
  const xp = totalSess * 10 + currentAvgScore * 2 + currentStreak * 25;
  const level = getLevel(xp);

  // Score trend data from API (richer) or local fallback
  // DB stores scores as 0-100 (interview-ace tracks score*10 already)
  const clamp = (v: number | null) => v !== null ? Math.min(100, Math.max(0, v)) : null;

  const scoreTrendData = apiInterviews.length > 0
    ? apiInterviews
        .filter(s => s.overallScore !== null)
        .slice(0, 20)
        .reverse()
        .map((s, i) => ({
          label: `#${i + 1} ${s.interviewType ?? s.role ?? "Interview"}`.slice(0, 20),
          score: clamp(s.overallScore) ?? 0,
          communication: clamp(s.communicationScore),
          grammar: clamp(s.grammarScore),
          confidence: clamp(s.confidenceScore),
        }))
    : interviewScores.slice(0, 20).map((e, i) => ({
        label: `Session ${i + 1}`,
        score: e.score ?? 0,
        communication: null,
        grammar: null,
        confidence: null,
      }));

  // Tool pie data
  const toolPieData = [
    { name: "English Guru", value: totalLearning || 0, color: "#f97316" },
    { name: "Interview Ace", value: totalInterviews || 0, color: "#3b82f6" },
    { name: "Rozgar Samachar", value: byTool["Rozgar Samachar"], color: "#a855f7" },
  ].filter(d => d.value > 0);

  // Achievements check
  const achievements = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: a.check(totalSess, currentStreak, totalInterviews || 0, currentAvgScore),
  }));

  // Skill breakdown averages from API interviews
  // Skill sub-scores are 0-100 in DB (same convention as overallScore)
  const skillAvg = apiInterviews.length > 0 ? (() => {
    const hasDetail = apiInterviews.filter(s => s.communicationScore !== null);
    if (!hasDetail.length) return null;
    const avg = (key: keyof ApiInterviewSession) =>
      Math.round(hasDetail.reduce((a, s) => a + Math.min(100, Math.max(0, (s[key] as number | null) ?? 0)), 0) / hasDetail.length);
    return {
      communication: avg("communicationScore"),
      grammar: avg("grammarScore"),
      confidence: avg("confidenceScore"),
      technical: avg("technicalScore"),
    };
  })() : null;

  const hasData = totalSess > 0 || entries.length > 0;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasData) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <div className="text-6xl mb-6">🚀</div>
        <h1 className="text-2xl font-display font-bold text-secondary mb-3">Your journey starts here</h1>
        <p className="text-muted-foreground mb-8">Complete a few sessions to unlock your personalised analytics dashboard.</p>
        <div className="space-y-3">
          <Button className="w-full font-bold h-12" onClick={() => navigate("/english-guru")}>
            <BookOpen className="w-4 h-4 mr-2" />Start English Guru
          </Button>
          <Button variant="outline" className="w-full font-bold h-12" onClick={() => navigate("/interview-ace")}>
            <Mic className="w-4 h-4 mr-2" />Try Interview Ace
          </Button>
          {!user && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">Sign in to sync your progress across devices</p>
              <Button variant="ghost" onClick={() => navigate("/login")} className="text-primary font-semibold">
                <LogIn className="w-4 h-4 mr-1.5" />Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Flame} label="Day Streak" value={currentStreak} sub={currentStreak >= 3 ? "🔥 On fire!" : "Keep going!"} color="bg-orange-100 text-orange-600" />
        <StatCard icon={BarChart2} label="Total Sessions" value={totalSess.toLocaleString("en-IN")} sub="All tools combined" color="bg-blue-100 text-blue-600" />
        <StatCard icon={Trophy} label="Avg Interview" value={currentAvgScore > 0 ? `${currentAvgScore}%` : "—"} sub={currentAvgScore >= 80 ? "Excellent!" : currentAvgScore >= 60 ? "Good progress" : "Keep practising"} color="bg-green-100 text-green-600" />
        <StatCard icon={Star} label="Total XP" value={xp.toLocaleString("en-IN")} sub={`Level: ${level.name}`} color="bg-purple-100 text-purple-600" />
      </div>

      {/* ── Interview score trend ── */}
      {scoreTrendData.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Interview Score Trend
              <Badge variant="secondary" className="ml-auto text-xs font-normal">Last {scoreTrendData.length} sessions</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={scoreTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => v.slice(0, 8)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<ScoreTooltip />} />
                <Area type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2.5}
                  fill="url(#scoreGrad)" dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>

            {/* Skill breakdown row */}
            {skillAvg && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Communication", value: skillAvg.communication, icon: MessageCircle, color: "text-blue-600 bg-blue-50" },
                  { label: "Grammar", value: skillAvg.grammar, icon: Pencil, color: "text-green-600 bg-green-50" },
                  { label: "Confidence", value: skillAvg.confidence, icon: Flame, color: "text-orange-600 bg-orange-50" },
                  { label: "Technical", value: skillAvg.technical, icon: Brain, color: "text-purple-600 bg-purple-50" },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color.split(" ")[1]}`}>
                    <div className={`text-xs font-bold ${s.color.split(" ")[0]} mb-1 flex items-center gap-1`}>
                      <s.icon className="w-3 h-3" />{s.label}
                    </div>
                    <div className={`text-lg font-display font-bold ${s.color.split(" ")[0]}`}>{s.value}%</div>
                    <Progress value={s.value} className="h-1.5 mt-1 bg-white/70" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Activity grid: bar chart + 30-day calendar ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Weekly bar chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              This Week's Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={activityByDay} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ActivityTooltip />} cursor={{ fill: "#f97316", opacity: 0.08 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {activityByDay.map((d, i) => (
                    <Cell key={i} fill={d.count > 0 ? "#f97316" : "#e2e8f0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 30-day calendar */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              30-Day Activity
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                🔥 {currentStreak} day streak
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ActivityCalendar entries={entries} />
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                {["bg-muted", "bg-orange-200", "bg-orange-300", "bg-orange-400", "bg-orange-500"].map(c => (
                  <div key={c} className={`w-4 h-4 rounded-sm ${c}`} />
                ))}
              </div>
              <span>More</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tool breakdown ── */}
      {toolPieData.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Tool Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="w-full sm:w-48 shrink-0">
                <ResponsiveContainer width="100%" height={200}>
                  <RadialBarChart
                    cx="50%" cy="50%"
                    innerRadius="30%" outerRadius="90%"
                    data={toolPieData}
                    startAngle={90} endAngle={-270}
                  >
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#f1f5f9" }}>
                      {toolPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </RadialBar>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {(["English Guru", "Interview Ace", "Rozgar Samachar"] as const).map(tool => {
                  const count = tool === "English Guru" ? (totalLearning || 0) : tool === "Interview Ace" ? (totalInterviews || 0) : byTool["Rozgar Samachar"];
                  const total = (totalLearning || 0) + (totalInterviews || 0) + byTool["Rozgar Samachar"];
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const Icon = tool === "English Guru" ? BookOpen : tool === "Interview Ace" ? Mic : Newspaper;
                  const color = TOOL_COLORS[tool];
                  return (
                    <div key={tool}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                          {tool}
                        </div>
                        <div className="text-sm text-muted-foreground">{count} sessions ({pct}%)</div>
                      </div>
                      <Progress value={pct} className="h-2" style={{ "--progress-fill": color } as React.CSSProperties} />
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Achievements ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Achievements
            <Badge variant="secondary" className="ml-auto text-xs">
              {achievements.filter(a => a.unlocked).length}/{achievements.length} unlocked
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {achievements.map(a => (
            <div
              key={a.id}
              className={`rounded-xl border-2 p-3 text-center transition-all ${
                a.unlocked
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : "border-border bg-muted/40 opacity-50 grayscale"
              }`}
            >
              <a.icon className={`w-7 h-7 mx-auto mb-2 ${a.unlocked ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-xs font-bold text-secondary leading-snug">{a.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
              {a.unlocked && <Badge className="mt-2 text-[10px] px-1.5 h-4">Unlocked!</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Personalised insights ── */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Personalised Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          {currentStreak === 0 && (
            <InsightCard type="warning" text="You haven't practised today. Even 5 minutes of English Guru keeps your streak alive!" action={{ label: "Go to English Guru", href: "/english-guru" }} />
          )}
          {currentStreak >= 7 && (
            <InsightCard type="success" text={`Amazing! You've maintained a ${currentStreak}-day streak. You're building a genuine habit.`} />
          )}
          {currentAvgScore > 0 && currentAvgScore < 60 && (
            <InsightCard type="tip" text="Your interview scores are below 60%. Focus on the STAR method — Situation, Task, Action, Result — for stronger answers." action={{ label: "Practice Interviews", href: "/interview-ace" }} />
          )}
          {currentAvgScore >= 80 && (
            <InsightCard type="success" text="Great interview scores! Challenge yourself with Technical or Finance interview types to push further." />
          )}
          {byTool["Rozgar Samachar"] === 0 && totalSess >= 5 && (
            <InsightCard type="tip" text="You haven't explored Rozgar Samachar yet. Get live job updates, salary data, and personalised career guidance." action={{ label: "Try Rozgar Samachar", href: "/rozgar-samachar" }} />
          )}
          {totalSess < 5 && (
            <InsightCard type="info" text="Complete 5 sessions to unlock detailed personalised insights and achievement badges." />
          )}
          {historyItems.length > 0 && (
            <InsightCard type="info" text={`You have ${historyItems.length} saved lesson${historyItems.length > 1 ? "s" : ""} in your library. Review them to reinforce what you've learned.`} action={{ label: "View Saved", href: "/history" }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ type, text, action }: {
  type: "tip" | "success" | "warning" | "info";
  text: string;
  action?: { label: string; href: string };
}) {
  const [, navigate] = useLocation();
  const styles = {
    tip: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-muted border-border text-secondary",
  };
  const icons = { tip: "💡", success: "✅", warning: "⚠️", info: "ℹ️" };

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles[type]}`}>
      <span className="text-base shrink-0 mt-0.5">{icons[type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed">{text}</p>
        {action && (
          <button
            onClick={() => navigate(action.href)}
            className="mt-2 text-xs font-bold flex items-center gap-1 hover:underline"
          >
            {action.label} <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
