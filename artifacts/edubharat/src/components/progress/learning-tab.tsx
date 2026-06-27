import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "./empty-state";
import { useLearningAnalytics } from "@/lib/use-learning-analytics";
import { BookOpen, Clock, User } from "lucide-react";

const TUTOR_EMOJIS: Record<string, string> = {
  priya: "👩‍🏫",
  neerja: "👩‍💼",
  meera: "👩‍🔬",
  rohit: "👨‍🏫",
  arjun: "👨‍💼",
  rahul: "👨‍💻",
};

function formatDuration(seconds: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  return `${m}m`;
}

export function LearningTab() {
  const learning = useLearningAnalytics();

  if (learning.totalSessions === 0) {
    return (
      <EmptyState
        emoji="📚"
        title="No learning sessions yet"
        description="Start English Guru to practise vocabulary, grammar, and conversation with AI tutors."
        actionLabel="Start English Guru"
        actionHref="/english-guru"
      />
    );
  }

  const maxCount = useMemo(() => Math.max(...learning.sessionsPerDay.map(d => d.count), 1), [learning.sessionsPerDay]);
  const maxDuration = useMemo(() => Math.max(...learning.sessionsPerDay.map(d => d.durationSeconds), 1), [learning.sessionsPerDay]);

  return (
    <div className="space-y-5">
      {/* 30-day chart */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Sessions in the Last 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={learning.sessionsPerDay} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]!.payload as typeof learning.sessionsPerDay[number];
                  return (
                    <div className="bg-card border rounded-xl shadow-lg px-3 py-2 text-sm">
                      <p className="font-bold text-secondary">{label}</p>
                      <p className="text-primary">{d.count} session{d.count !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-muted-foreground">{formatDuration(d.durationSeconds)} active</p>
                    </div>
                  );
                }}
                cursor={{ fill: "#f97316", opacity: 0.08 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {learning.sessionsPerDay.map((d, i) => (
                  <Cell key={i} fill={d.count > 0 ? "#f97316" : "#e2e8f0"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Tutor breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Top Tutors
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {learning.tutorBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tutor data yet.</p>
            ) : (
              <div className="space-y-3">
                {learning.tutorBreakdown.map(t => (
                  <div key={t.tutorId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{TUTOR_EMOJIS[t.tutorId] ?? "👤"}</span>
                      <span className="text-sm font-semibold text-secondary capitalize">{t.tutorId}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">{t.count} sessions</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode breakdown */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Practice Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {learning.modeBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mode data yet.</p>
            ) : (
              <div className="space-y-3">
                {learning.modeBreakdown.map(m => (
                  <div key={m.mode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-secondary capitalize">{m.mode.replace(/_/g, " ")}</span>
                      <span className="text-sm text-muted-foreground">{m.count} session{m.count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (m.count / Math.max(learning.totalSessions, 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent sessions */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-5 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="space-y-2">
            {learning.recentSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary truncate">{s.activityType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {s.tutorId && <> · Tutor {s.tutorId}</>}
                    {s.mode && <> · {s.mode.replace(/_/g, " ")}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {s.score !== null && <div className="text-sm font-bold text-secondary">{s.score}%</div>}
                  <div className="text-xs text-muted-foreground">{formatDuration(s.duration ?? 0)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
