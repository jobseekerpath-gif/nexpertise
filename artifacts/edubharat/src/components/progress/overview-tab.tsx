import { useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useLearningAnalytics } from "@/lib/use-learning-analytics";
import { useInterviewAnalytics } from "@/lib/use-interview-analytics";
import { useStudentProfile } from "@/lib/use-student-profile";
import { useLocation } from "wouter";
import {
  Flame, Trophy, BookOpen, Mic, Zap, Target, ChevronRight, Calendar,
} from "lucide-react";

const RADAR_COLORS = {
  Grammar: "#22c55e",
  Vocabulary: "#3b82f6",
  Pronunciation: "#f97316",
  Confidence: "#a855f7",
  Listening: "#06b6d4",
  "Interview Readiness": "#ef4444",
};

function StatTile({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-xl font-display font-bold text-secondary">{value}</div>
        <div className="text-xs font-semibold text-secondary">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export function OverviewTab() {
  const learning = useLearningAnalytics();
  const interviews = useInterviewAnalytics();
  const { profile } = useStudentProfile();
  const [, navigate] = useLocation();

  const totalSessions = learning.totalSessions + interviews.totalInterviews;
  const hasData = totalSessions > 0;

  const radarData = useMemo(() => {
    // Derive 6-axis skill estimate from available data
    const grammar = Math.round((
      (interviews.latestReport?.grammarScore ?? 0) +
      learning.sessions.filter(s => /grammar|tense|sentence/i.test(s.activityType)).reduce((a, s) => a + (s.score ?? 0), 0) / Math.max(1, learning.sessions.filter(s => /grammar|tense|sentence/i.test(s.activityType)).length)
    ) / 2);
    const vocabulary = Math.round(
      learning.sessions.filter(s => /vocab|word|phrase|idiom/i.test(s.activityType)).reduce((a, s) => a + (s.score ?? 0), 0) / Math.max(1, learning.sessions.filter(s => /vocab|word|phrase|idiom/i.test(s.activityType)).length)
    );
    const pronunciation = Math.round(
      learning.sessions.filter(s => /speak|pronunciation|voice|oral/i.test(s.activityType || s.mode || "")).reduce((a, s) => a + (s.score ?? 0), 0) / Math.max(1, learning.sessions.filter(s => /speak|pronunciation|voice|oral/i.test(s.activityType || s.mode || "")).length)
    );
    const confidence = interviews.latestReport?.confidenceScore ?? 0;
    const listening = Math.round(
      learning.sessions.filter(s => /listen|conversation|dialogue/i.test(s.mode || s.activityType || "")).reduce((a, s) => a + (s.score ?? 0), 0) / Math.max(1, learning.sessions.filter(s => /listen|conversation|dialogue/i.test(s.mode || s.activityType || "")).length)
    );
    const interviewReadiness = interviews.averageScore;

    return [
      { subject: "Grammar", A: Math.min(100, Math.max(0, grammar || 50)), fullMark: 100 },
      { subject: "Vocabulary", A: Math.min(100, Math.max(0, vocabulary || 50)), fullMark: 100 },
      { subject: "Pronunciation", A: Math.min(100, Math.max(0, pronunciation || 50)), fullMark: 100 },
      { subject: "Confidence", A: Math.min(100, Math.max(0, confidence || 50)), fullMark: 100 },
      { subject: "Listening", A: Math.min(100, Math.max(0, listening || 50)), fullMark: 100 },
      { subject: "Interview Readiness", A: Math.min(100, Math.max(0, interviewReadiness || 50)), fullMark: 100 },
    ];
  }, [learning, interviews]);

  const averageSkill = useMemo(() =>
    Math.round(radarData.reduce((a, d) => a + d.A, 0) / radarData.length),
    [radarData]
  );

  if (!hasData) {
    return (
      <EmptyState
        emoji="🚀"
        title="Your journey starts here"
        description="Complete a few English Guru or Interview Ace sessions to unlock your personalised analytics."
        actionLabel="Start Learning"
        actionHref="/english-guru"
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Greeting + today's goal */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-display font-bold text-secondary">
            {profile.name ? `Welcome back, ${profile.name.split(" ")[0]}` : "Welcome back"}! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Today's goal: complete one focused session to keep your streak alive.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/english-guru")}>
          <Calendar className="w-3.5 h-3.5 mr-1.5" />Today's Session
        </Button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Flame} label="Day Streak" value={learning.streak} sub={learning.streak >= 3 ? "On fire!" : "Keep going"} color="bg-orange-100 text-orange-600" />
        <StatTile icon={BookOpen} label="Total Sessions" value={totalSessions} sub="Learning + interviews" color="bg-blue-100 text-blue-600" />
        <StatTile icon={Mic} label="Interviews" value={interviews.totalInterviews} sub={`Avg ${interviews.averageScore}%`} color="bg-green-100 text-green-600" />
        <StatTile icon={Zap} label="Avg Skill" value={`${averageSkill}%`} sub="Across 6 skills" color="bg-purple-100 text-purple-600" />
      </div>

      {/* Radar chart */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Skill Radar
            <Badge variant="secondary" className="ml-auto text-xs font-normal">{averageSkill}% average</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-72 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="You" dataKey="A" stroke="#f97316" fill="#f97316" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-2 w-full">
              {radarData.map(d => (
                <div key={d.subject} className="rounded-xl border p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: RADAR_COLORS[d.subject as keyof typeof RADAR_COLORS] }} />
                    <span className="text-xs font-semibold text-secondary">{d.subject}</span>
                  </div>
                  <div className="text-lg font-display font-bold text-secondary">{d.A}%</div>
                  <Progress value={d.A} className="h-1 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => navigate("/english-guru")} className="text-left rounded-xl border p-4 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-secondary">Practice English</p>
              <p className="text-xs text-muted-foreground">Keep your streak alive</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
        </button>
        <button onClick={() => navigate("/interview-ace")} className="text-left rounded-xl border p-4 hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-secondary">Mock Interview</p>
              <p className="text-xs text-muted-foreground">Boost your readiness</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
          </div>
        </button>
      </div>
    </div>
  );
}
