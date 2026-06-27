import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useInterviewAnalytics } from "@/lib/use-interview-analytics";
import { Mic, ChevronDown, ChevronUp, Clock } from "lucide-react";

const SCORE_COLOR = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : "#ef4444";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export function InterviewsTab() {
  const interviews = useInterviewAnalytics();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (interviews.totalInterviews === 0) {
    return (
      <EmptyState
        emoji="🎤"
        title="No interviews yet"
        description="Run a mock interview with AI to get scored feedback and track your improvement."
        actionLabel="Try Interview Ace"
        actionHref="/interview-ace"
      />
    );
  }

  const maxScore = useMemo(() => Math.max(...interviews.scoreTrend.map(d => d.score), 1), [interviews.scoreTrend]);

  return (
    <div className="space-y-5">
      {/* Score trend */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Interview Scores — Last {interviews.scoreTrend.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={interviews.scoreTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(0, 8)} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]!.payload as typeof interviews.scoreTrend[number];
                  return (
                    <div className="bg-card border rounded-xl shadow-lg px-3 py-2 text-sm">
                      <p className="font-bold text-secondary">{d.label}</p>
                      <p className="font-bold" style={{ color: SCORE_COLOR(d.score) }}>{d.score}%</p>
                    </div>
                  );
                }}
                cursor={{ fill: "#f97316", opacity: 0.08 }}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {interviews.scoreTrend.map((d, i) => (
                  <Cell key={i} fill={SCORE_COLOR(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Latest scorecard */}
      {interviews.latestBreakdown && interviews.latestReport && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Latest Interview Breakdown
              <Badge variant="secondary" className="ml-auto text-xs font-normal">{interviews.latestReport.overallScore}% overall</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {interviews.latestBreakdown.map(d => (
                <div key={d.label} className="rounded-xl border p-3">
                  <div className="text-xs font-semibold text-secondary mb-1">{d.label}</div>
                  <div className="text-lg font-display font-bold text-secondary">{d.value}%</div>
                  <Progress value={d.value} className="h-1.5 mt-1" style={{ "--progress-fill": d.color } as React.CSSProperties} />
                </div>
              ))}
            </div>
            {interviews.latestReport.roleFit && (
              <p className="text-sm text-muted-foreground mt-4">{interviews.latestReport.roleFit}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Past interviews list */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Past Interviews
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-2">
            {interviews.pastInterviews.map(s => (
              <div key={s.id} className="border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary">{s.interviewType ?? s.role}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.completedAt ? new Date(s.completedAt).toLocaleDateString("en-IN") : new Date(s.createdAt).toLocaleDateString("en-IN")}
                      {s.experienceLevel && <> · {s.experienceLevel}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {s.overallScore !== null && (
                      <Badge className="text-xs font-normal" style={{ background: SCORE_COLOR(s.overallScore), color: "white" }}>
                        {s.overallScore}%
                      </Badge>
                    )}
                    {expanded === s.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {expanded === s.id && (
                  <div className="border-t px-3 py-3 bg-muted/20 text-sm space-y-2">
                    <p><span className="font-semibold text-secondary">Duration:</span> {formatDuration(s.durationSeconds)}</p>
                    {s.communicationScore !== null && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span>Communication: {s.communicationScore}%</span>
                        <span>Grammar: {s.grammarScore}%</span>
                        <span>Confidence: {s.confidenceScore}%</span>
                        <span>Technical: {s.technicalScore}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
