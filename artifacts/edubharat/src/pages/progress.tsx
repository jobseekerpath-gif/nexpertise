import { useProgress } from "@/lib/use-progress";
import { useHistory } from "@/lib/use-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  TrendingUp, Flame, BookOpen, Mic, Newspaper,
  Award, Calendar, Target, Trophy, Star, Zap,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-2xl font-extrabold text-secondary">{value}</div>
        <div className="text-sm font-semibold text-secondary mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ScoreBar({ score, label, idx }: { score: number; label: string; idx: number }) {
  const color = score >= 75 ? "bg-green-500" : score >= 55 ? "bg-yellow-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
        <div className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(score, 5)}%` }}>
          <span className="text-[10px] font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">{label}</span>
    </div>
  );
}

function StreakDisplay({ streak }: { streak: number }) {
  if (streak === 0) return (
    <div className="text-center py-4 text-muted-foreground">
      <p className="text-sm">Start learning today to build your streak!</p>
    </div>
  );
  const flames = Math.min(streak, 7);
  return (
    <div className="text-center py-2">
      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
        {Array.from({ length: flames }).map((_, i) => (
          <span key={i} className="text-2xl animate-in fade-in" style={{ animationDelay: `${i * 80}ms` }}>🔥</span>
        ))}
        {streak > 7 && <span className="text-lg font-bold text-orange-500">+{streak - 7}</span>}
      </div>
      <p className="text-sm font-semibold text-secondary">
        {streak >= 30 ? "Unstoppable! 30+ days!" : streak >= 14 ? "Two weeks strong!" : streak >= 7 ? "One full week! Amazing!" : streak >= 3 ? "You're on a roll!" : "Keep going — day " + streak + "!"}
      </p>
    </div>
  );
}

function ActivityDot({ count, label }: { count: number; label: string }) {
  const intensity = count >= 5 ? "bg-primary scale-110" : count >= 3 ? "bg-primary/70" : count >= 1 ? "bg-primary/40" : "bg-muted";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-8 h-8 rounded-lg transition-all ${intensity}`} title={`${count} sessions`} />
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

type Achievement = {
  id: string; icon: string; label: string; desc: string; unlocked: boolean; hint?: string;
};

function AchievementCard({ a }: { a: Achievement }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${a.unlocked ? "bg-card border-primary/20 shadow-sm" : "bg-muted/30 border-border opacity-50 grayscale"}`}>
      <span className="text-2xl shrink-0">{a.icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-bold truncate ${a.unlocked ? "text-secondary" : "text-muted-foreground"}`}>{a.label}</p>
        <p className="text-xs text-muted-foreground truncate">{a.unlocked ? a.desc : a.hint ?? a.desc}</p>
      </div>
      {a.unlocked && <span className="text-primary shrink-0 ml-auto"><Star className="w-4 h-4 fill-primary" /></span>}
    </div>
  );
}

function InsightCard({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
      <span className="text-xl shrink-0">{icon}</span>
      <p className="text-sm font-medium text-secondary">{text}</p>
    </div>
  );
}

const TOOL_COLORS: Record<string, string> = {
  "English Guru": "bg-orange-100 text-orange-700",
  "Interview Ace": "bg-blue-100 text-blue-700",
  "Rozgar Samachar": "bg-purple-100 text-purple-700",
};
const TOOL_ICONS: Record<string, React.ElementType> = {
  "English Guru": BookOpen, "Interview Ace": Mic, "Rozgar Samachar": Newspaper,
};

export default function Progress() {
  const [, navigate] = useLocation();
  const { interviewScores, activityByDay, streak, totalSessions, avgScore, byTool } = useProgress();
  const { items: historyItems } = useHistory();
  const isEmpty = totalSessions === 0 && historyItems.length === 0;

  if (isEmpty) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <div className="text-6xl mb-6">🚀</div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-3">Your Journey Awaits</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          Complete your first session and watch your progress come alive — streaks, scores, and achievements all tracked here.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={() => navigate("/english-guru")} className="font-bold">Start English Guru</Button>
          <Button variant="outline" onClick={() => navigate("/interview-ace")} className="font-bold">Try Interview Ace</Button>
        </div>
      </div>
    );
  }

  const xp = totalSessions * 10 + Math.round((avgScore ?? 0) * 2) + streak * 25;
  const level = Math.floor(xp / 200) + 1;
  const xpInLevel = xp % 200;

  // Achievements
  const achievements: Achievement[] = [
    { id: "first", icon: "🌟", label: "First Step", desc: "Completed your first session", hint: "Complete any session to unlock", unlocked: totalSessions >= 1 },
    { id: "streak3", icon: "🔥", label: "On Fire", desc: "3-day learning streak", hint: "Use EduBharat 3 days in a row", unlocked: streak >= 3 },
    { id: "streak7", icon: "⚡", label: "Week Champion", desc: "7 days straight — incredible!", hint: "7 consecutive days of learning", unlocked: streak >= 7 },
    { id: "interview5", icon: "🎯", label: "Interview Warrior", desc: "5 mock interviews completed", hint: "Complete 5 Interview Ace sessions", unlocked: (byTool["Interview Ace"] ?? 0) >= 5 },
    { id: "guru10", icon: "📚", label: "Grammar Pro", desc: "10 English Guru sessions done", hint: "10 English Guru sessions", unlocked: (byTool["English Guru"] ?? 0) >= 10 },
    { id: "news3", icon: "📰", label: "News Reader", desc: "Read 3 Rozgar Samachar editions", hint: "Open Rozgar Samachar 3 times", unlocked: (byTool["Rozgar Samachar"] ?? 0) >= 3 },
    { id: "score80", icon: "🏆", label: "High Achiever", desc: "Average interview score 80%+", hint: "Score an average of 80%+ in interviews", unlocked: avgScore >= 80 },
    { id: "total50", icon: "👑", label: "EduBharat Pro", desc: "50 total sessions — you're dedicated!", hint: "Complete 50 sessions total", unlocked: totalSessions >= 50 },
  ];

  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  // Personalised insights
  const insights: { icon: string; text: string; color: string }[] = [];
  if (avgScore >= 80) insights.push({ icon: "🎉", text: "You're scoring 80%+ in interviews — you're interview-ready!", color: "bg-green-50 border-green-200" });
  else if (avgScore >= 60 && avgScore < 80) insights.push({ icon: "📈", text: `Your average is ${avgScore}%. Try giving more specific examples using the STAR method.`, color: "bg-blue-50 border-blue-200" });
  else if (avgScore > 0 && avgScore < 60) insights.push({ icon: "💡", text: "Focus on structure: Situation → Task → Action → Result in your answers.", color: "bg-yellow-50 border-yellow-200" });

  type ToolKey = "English Guru" | "Interview Ace" | "Rozgar Samachar";
  const tools: ToolKey[] = ["English Guru", "Interview Ace", "Rozgar Samachar"];
  const topTool: ToolKey = tools.reduce(
    (top, t) => (byTool[t] ?? 0) > (byTool[top] ?? 0) ? t : top,
    "English Guru" as ToolKey
  );
  if (totalSessions >= 5) insights.push({ icon: "💪", text: `Your most-used tool is ${topTool} — great focus!`, color: "bg-orange-50 border-orange-200" });
  if (streak >= 7) insights.push({ icon: "🔥", text: `${streak}-day streak! Consistency is the #1 key to learning.`, color: "bg-red-50 border-red-200" });

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Header with level */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">My Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">Your EduBharat learning journey</p>
        </div>
        <div className="bg-card border rounded-2xl px-5 py-3 text-center shadow-sm">
          <div className="text-xs text-muted-foreground font-medium">Level</div>
          <div className="text-4xl font-extrabold text-primary leading-none my-1">{level}</div>
          <div className="w-32 bg-muted rounded-full h-2">
            <div className="h-2 bg-primary rounded-full transition-all duration-700" style={{ width: `${(xpInLevel / 200) * 100}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-1">{xpInLevel}/200 XP</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Flame} label="Day Streak" value={streak} sub={streak > 0 ? `${streak} ${streak === 1 ? "day" : "days"} 🔥` : "Start today!"} color="bg-orange-100 text-orange-600" />
        <StatCard icon={Target} label="Sessions" value={totalSessions} sub="activities completed" color="bg-blue-100 text-blue-600" />
        <StatCard icon={Award} label="Avg Interview" value={avgScore > 0 ? `${avgScore}%` : "—"} sub={avgScore >= 70 ? "Great work!" : avgScore > 0 ? "Keep practising" : "Try Interview Ace"} color="bg-green-100 text-green-600" />
        <StatCard icon={Zap} label="Total XP" value={xp} sub={`Level ${level} Learner`} color="bg-purple-100 text-purple-600" />
      </div>

      {/* Streak + Activity */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />Learning Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StreakDisplay streak={streak} />
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 justify-between">
              {activityByDay.map(day => <ActivityDot key={day.date} count={day.count} label={day.label} />)}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted inline-block" />No activity</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/40 inline-block" />Some</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary inline-block" />Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2 mb-6">
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}

      {/* Tool breakdown */}
      <Card className="border shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />Activity by Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["English Guru", "Interview Ace", "Rozgar Samachar"] as const).map(tool => {
            const count = byTool[tool] ?? 0;
            const pct = Math.round((count / Math.max(totalSessions, 1)) * 100);
            const Icon = TOOL_ICONS[tool]!;
            return (
              <div key={tool}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${TOOL_COLORS[tool]}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium">{tool}</span>
                  </div>
                  <span className="text-sm font-bold text-secondary">{count} sessions</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="h-2 bg-primary rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Interview Score History */}
      {interviewScores.length > 0 && (
        <Card className="border shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />Interview Score History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interviewScores.map((entry, i) => (
              <ScoreBar key={entry.id} score={entry.score ?? 0} label={entry.activity} idx={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      <Card className="border shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Achievements
            {unlocked.length > 0 && <Badge variant="secondary" className="ml-1">{unlocked.length}/{achievements.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unlocked.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2 mb-4">
              {unlocked.map(a => <AchievementCard key={a.id} a={a} />)}
            </div>
          )}
          {locked.length > 0 && (
            <>
              {unlocked.length > 0 && <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Up Next</p>}
              <div className="grid sm:grid-cols-2 gap-2">
                {locked.slice(0, 4).map(a => <AchievementCard key={a.id} a={a} />)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent saved items */}
      {historyItems.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />Recently Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historyItems.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.savedAt).toLocaleDateString("en-IN")}</p>
                  </div>
                  <Badge variant="secondary" className={`shrink-0 text-xs ${TOOL_COLORS[item.tool] ?? ""}`}>{item.tool}</Badge>
                </div>
              ))}
            </div>
            {historyItems.length > 5 && (
              <Button variant="ghost" size="sm" className="mt-3 w-full text-xs" onClick={() => navigate("/history")}>
                View all {historyItems.length} saved items →
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
