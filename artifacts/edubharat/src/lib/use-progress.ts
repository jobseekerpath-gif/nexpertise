import { useState, useCallback } from "react";

export type ProgressEntry = {
  id: string;
  date: string;          // YYYY-MM-DD
  tool: "English Guru" | "Interview Ace" | "Rozgar Samachar";
  activity: string;      // e.g. "grammar", "hr", "top_jobs"
  score?: number;        // 0–100
  duration?: number;     // seconds
};

const KEY = "edubharat_progress";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function load(): ProgressEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: ProgressEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function useProgress() {
  const [entries, setEntries] = useState<ProgressEntry[]>(load);

  const track = useCallback((
    tool: ProgressEntry["tool"],
    activity: string,
    score?: number,
    duration?: number
  ) => {
    const entry: ProgressEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: today(),
      tool,
      activity,
      score,
      duration,
    };
    setEntries(prev => {
      const updated = [entry, ...prev];
      persist(updated);
      return updated;
    });
    return entry;
  }, []);

  // Derived metrics
  const interviewScores = entries
    .filter(e => e.tool === "Interview Ace" && e.score !== undefined)
    .slice(0, 20)
    .reverse();

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  const activityByDay = last7Days.map(date => ({
    date,
    label: new Date(date + "T00:00").toLocaleDateString("en-IN", { weekday: "short" }),
    count: entries.filter(e => e.date === date).length,
  }));

  const streak = (() => {
    let s = 0;
    const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
    const ref = new Date();
    for (const d of dates) {
      const diff = Math.round((ref.getTime() - new Date(d + "T00:00").getTime()) / 86400000);
      if (diff === s) s++;
      else break;
    }
    return s;
  })();

  const totalSessions = entries.length;
  const avgScore = interviewScores.length > 0
    ? Math.round(interviewScores.reduce((a, b) => a + (b.score ?? 0), 0) / interviewScores.length)
    : 0;

  const byTool = {
    "English Guru": entries.filter(e => e.tool === "English Guru").length,
    "Interview Ace": entries.filter(e => e.tool === "Interview Ace").length,
    "Rozgar Samachar": entries.filter(e => e.tool === "Rozgar Samachar").length,
  };

  return {
    entries,
    track,
    interviewScores,
    activityByDay,
    streak,
    totalSessions,
    avgScore,
    byTool,
  };
}
