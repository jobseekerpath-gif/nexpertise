import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { useInterviewAnalytics } from "@/lib/use-interview-analytics";
import { useAuth } from "@/lib/use-auth";
import { Mic, ChevronDown, ChevronUp, Clock, LogIn, TrendingUp, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

const SCORE_COLOR = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#f97316" : "#ef4444";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

function formatInterviewLabel(session: { interviewType: string | null; role: string; createdAt: string }): string {
  const type = session.interviewType ?? session.role ?? "Interview";
  // Truncate cleanly at word boundary
  return type.length > 16 ? type.slice(0, 15) + "…" : type;
}

type ParsedReport = {
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  roleFit: string;
};

function parseSessionReport(feedbackJson: string | null): ParsedReport | null {
  if (!feedbackJson) return null;
  try {
    const p = JSON.parse(feedbackJson) as Record<string, unknown>;
    return {
      strengths: Array.isArray(p["strengths"]) ? p["strengths"].map(String) : [],
      improvements: Array.isArray(p["improvements"]) ? p["improvements"].map(String) : [],
      nextSteps: Array.isArray(p["nextSteps"]) ? p["nextSteps"].map(String) : [],
      roleFit: String(p["roleFit"] ?? ""),
    };
  } catch { return null; }
}

export function InterviewsTab() {
  const { user } = useAuth();
  const interviews = useInterviewAnalytics();
  const [expanded, setExpanded] = useState<number | null>(null);

  // Guest with no local sessions → sign-in prompt
  if (!user && interviews.totalInterviews === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">🎤</div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-secondary">Track your interview progress</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sign in to save your mock interview scores, see how you improve over time, and access your full report history.
          </p>
        </div>
        <a href="/sign-in">
          <Button className="gap-2">
            <LogIn className="w-4 h-4" /> Sign in to unlock history
          </Button>
        </a>
        <p className="text-xs text-muted-foreground">
          Or <a href="/interview-ace" className="text-primary underline underline-offset-2">practice as a guest</a> — your latest report will be saved on this device.
        </p>
      </div>
    );
  }

  // Logged-in with no sessions yet
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
            <TrendingUp className="w-4 h-4 text-primary" />
            Score Trend — Last {interviews.scoreTrend.length} Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={interviews.scoreTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => String(v).slice(0, 10)}
              />
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

          {/* Summary stats row */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="rounded-xl border p-3 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Total</div>
              <div className="text-xl font-display font-bold text-secondary">{interviews.totalInterviews}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Average</div>
              <div className="text-xl font-display font-bold" style={{ color: SCORE_COLOR(interviews.averageScore) }}>
                {interviews.averageScore}%
              </div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <div className="text-xs font-semibold text-muted-foreground mb-0.5">Best</div>
              <div className="text-xl font-display font-bold" style={{ color: SCORE_COLOR(maxScore) }}>
                {maxScore}%
              </div>
            </div>
          </div>
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
          <CardContent className="px-5 pb-5 space-y-4">
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
              <p className="text-sm text-muted-foreground italic">{interviews.latestReport.roleFit}</p>
            )}
            {/* Strengths */}
            {interviews.latestReport.strengths.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Strengths</p>
                <ul className="space-y-1">
                  {interviews.latestReport.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Improvements */}
            {interviews.latestReport.improvements.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Areas to Improve</p>
                <ul className="space-y-1">
                  {interviews.latestReport.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Next Steps */}
            {interviews.latestReport.nextSteps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Next Steps</p>
                <ul className="space-y-1">
                  {interviews.latestReport.nextSteps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                      <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
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
            {interviews.pastInterviews.map(s => {
              const parsedReport = expanded === s.id ? parseSessionReport(s.feedbackJson) : null;
              return (
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
                        {s.durationSeconds && <> · <Clock className="inline w-2.5 h-2.5 mb-0.5" /> {formatDuration(s.durationSeconds)}</>}
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
                    <div className="border-t px-4 py-4 bg-muted/20 space-y-4">
                      {/* Sub-scores */}
                      {s.communicationScore !== null && (
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Communication", value: s.communicationScore, color: "#3b82f6" },
                            { label: "Grammar", value: s.grammarScore, color: "#22c55e" },
                            { label: "Confidence", value: s.confidenceScore, color: "#f97316" },
                            { label: "Technical", value: s.technicalScore, color: "#a855f7" },
                          ].map(d => d.value !== null && (
                            <div key={d.label} className="rounded-lg border bg-card px-3 py-2">
                              <div className="text-xs font-semibold text-secondary mb-0.5">{d.label}</div>
                              <div className="text-sm font-bold" style={{ color: d.color }}>{d.value}%</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Full report from feedbackJson */}
                      {parsedReport && (
                        <>
                          {parsedReport.roleFit && (
                            <p className="text-sm text-muted-foreground italic">{parsedReport.roleFit}</p>
                          )}
                          {parsedReport.strengths.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Strengths</p>
                              <ul className="space-y-1">
                                {parsedReport.strengths.map((str, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    {str}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parsedReport.improvements.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold uppercase tracking-wider text-orange-700">Areas to Improve</p>
                              <ul className="space-y-1">
                                {parsedReport.improvements.map((imp, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                                    {imp}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parsedReport.nextSteps.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold uppercase tracking-wider text-primary">Next Steps</p>
                              <ul className="space-y-1">
                                {parsedReport.nextSteps.map((step, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                                    <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}

                      {/* No report data fallback */}
                      {!parsedReport && !s.communicationScore && (
                        <p className="text-xs text-muted-foreground">Detailed report not available for this session.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
