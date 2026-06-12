import { useProgress } from "@/lib/use-progress";
import { useHistory } from "@/lib/use-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  TrendingUp, Flame, BookOpen, Mic, Newspaper,
  Award, Calendar, Target, Trophy,
} from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border shadow-sm">
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
        <div
          className={`h-full rounded-full flex items-center justify-end pr-2 transition-all ${color}`}
          style={{ width: `${Math.max(score, 5)}%` }}
        >
          <span className="text-[10px] font-bold text-white">{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{label}</span>
    </div>
  );
}

function ActivityDot({ count }: { count: number }) {
  if (count === 0) return <div className="w-8 h-8 rounded-lg bg-muted" />;
  const intensity = count >= 5 ? "bg-primary" : count >= 3 ? "bg-primary/70" : count >= 1 ? "bg-primary/40" : "bg-muted";
  return <div className={`w-8 h-8 rounded-lg ${intensity}`} />;
}

const TOOL_COLORS: Record<string, string> = {
  "English Guru": "bg-orange-100 text-orange-700",
  "Interview Ace": "bg-blue-100 text-blue-700",
  "Rozgar Samachar": "bg-purple-100 text-purple-700",
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  "English Guru": BookOpen,
  "Interview Ace": Mic,
  "Rozgar Samachar": Newspaper,
};

export default function Progress() {
  const [, navigate] = useLocation();
  const {
    interviewScores, activityByDay, streak,
    totalSessions, avgScore, byTool,
  } = useProgress();
  const { items: historyItems } = useHistory();

  const isEmpty = totalSessions === 0 && historyItems.length === 0;

  if (isEmpty) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-display font-bold text-secondary mb-3">Your Progress</h1>
        <p className="text-muted-foreground mb-8">
          Start using EduBharat tools to track your learning journey. Your interview scores, practice sessions, and daily activity will appear here.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/english-guru")}>Start English Guru</Button>
          <Button variant="outline" onClick={() => navigate("/interview-ace")}>Try Interview Ace</Button>
        </div>
      </div>
    );
  }

  const xp = totalSessions * 10 + (avgScore ?? 0) * 2 + streak * 25;
  const level = Math.floor(xp / 200) + 1;
  const xpInLevel = xp % 200;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-secondary">My Progress</h1>
          <p className="text-muted-foreground text-sm mt-1">Your EduBharat learning journey at a glance</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Level</div>
          <div className="text-3xl font-extrabold text-primary">{level}</div>
          <div className="w-28 bg-muted rounded-full h-2 mt-1">
            <div className="h-2 bg-primary rounded-full" style={{ width: `${(xpInLevel / 200) * 100}%` }} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{xpInLevel}/200 XP</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Flame} label="Day Streak" value={streak} sub={streak > 0 ? "Keep it up! 🔥" : "Start today"} color="bg-orange-100 text-orange-600" />
        <StatCard icon={Target} label="Sessions Done" value={totalSessions} sub="total activities" color="bg-blue-100 text-blue-600" />
        <StatCard icon={Award} label="Avg Interview" value={avgScore > 0 ? `${avgScore}%` : "—"} sub={avgScore >= 70 ? "Great score!" : "Keep practising"} color="bg-green-100 text-green-600" />
        <StatCard icon={Trophy} label="Total XP" value={xp} sub={`Level ${level} Learner`} color="bg-purple-100 text-purple-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Weekly Activity */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              This Week's Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 justify-between">
              {activityByDay.map(day => (
                <div key={day.date} className="flex flex-col items-center gap-2">
                  <ActivityDot count={day.count} />
                  <span className="text-[10px] text-muted-foreground font-medium">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-muted" />None
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary/40" />Some
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-primary" />Active
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tool Breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Activity by Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(["English Guru", "Interview Ace", "Rozgar Samachar"] as const).map(tool => {
              const count = byTool[tool];
              const total = totalSessions || 1;
              const pct = Math.round((count / total) * 100);
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
                    <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {totalSessions === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interview Score History */}
      {interviewScores.length > 0 && (
        <Card className="border shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Interview Score History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interviewScores.map((entry, i) => (
              <ScoreBar key={entry.id} score={entry.score ?? 0} label={entry.activity} idx={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent saved items */}
      {historyItems.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Recent Saved Items
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
                  <Badge variant="secondary" className={`shrink-0 text-xs ${TOOL_COLORS[item.tool] ?? ""}`}>
                    {item.tool}
                  </Badge>
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

      {isEmpty && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Complete sessions in any tool to see your progress here.
        </div>
      )}
    </div>
  );
}
