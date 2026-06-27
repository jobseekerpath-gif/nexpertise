import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

export type ProgressEntry = {
  id: string;
  date: string;          // YYYY-MM-DD
  tool: "English Guru" | "Interview Ace" | "Rozgar Samachar";
  activity: string;
  score?: number;
  duration?: number;
};

const KEY = "edubharat_progress";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function today() { return new Date().toISOString().slice(0, 10); }

function loadLocal(): ProgressEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressEntry[]) : [];
  } catch { return []; }
}

function persistLocal(entries: ProgressEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 500))); } catch { /* ignore */ }
}

function apiEntryToLocal(s: Record<string, unknown>): ProgressEntry {
  return {
    id: String(s["id"] ?? ""),
    date: typeof s["createdAt"] === "string" ? s["createdAt"].slice(0, 10) : today(),
    tool: (s["tool"] as ProgressEntry["tool"]) ?? "English Guru",
    activity: typeof s["activityType"] === "string" ? s["activityType"] : "",
    score: typeof s["score"] === "number" ? s["score"] : undefined,
    duration: typeof s["duration"] === "number" ? s["duration"] : undefined,
  };
}

export function useProgress() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<ProgressEntry[]>(loadLocal);
  const syncedRef = useRef(false);

  // Fetch server sessions on login
  useEffect(() => {
    if (!user || syncedRef.current) return;
    syncedRef.current = true;

    Promise.all([
      fetch(`${BASE}/api/sessions/learning?limit=200`, { credentials: "include" }).then(r => r.json()),
      fetch(`${BASE}/api/sessions/interview?limit=100`, { credentials: "include" }).then(r => r.json()),
    ]).then(([learningData, interviewData]: [
      { sessions?: Record<string, unknown>[] },
      { sessions?: Record<string, unknown>[] }
    ]) => {
      const learningEntries = (learningData.sessions ?? []).map(apiEntryToLocal);
      const interviewEntries = (interviewData.sessions ?? []).map(s => ({
        ...apiEntryToLocal(s),
        tool: "Interview Ace" as const,
        activity: typeof s["interviewType"] === "string" ? s["interviewType"] : (typeof s["role"] === "string" ? s["role"] : "hr"),
        score: typeof s["overallScore"] === "number" ? s["overallScore"] : undefined,
      }));

      const merged = [...learningEntries, ...interviewEntries]
        .sort((a, b) => b.date.localeCompare(a.date));

      setEntries(merged);
      persistLocal(merged);
    }).catch(() => { /* keep local */ });
  }, [user]);

  useEffect(() => { if (!user) { syncedRef.current = false; } }, [user]);

  const track = useCallback(async (
    tool: ProgressEntry["tool"],
    activity: string,
    score?: number,
    duration?: number,
    extras?: {
      tutorId?: string;
      mode?: string;
      communicationScore?: number;
      grammarScore?: number;
      confidenceScore?: number;
      technicalScore?: number;
      interviewType?: string;
      experienceLevel?: string;
    }
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
      persistLocal(updated);
      return updated;
    });

    // Persist to server if logged in
    if (user) {
      const isInterview = tool === "Interview Ace";
      const url = isInterview ? `${BASE}/api/sessions/interview` : `${BASE}/api/sessions/learning`;
      const body = isInterview
        ? {
            role: activity,
            experienceLevel: extras?.experienceLevel ?? "Fresher",
            interviewType: extras?.interviewType ?? activity,
            overallScore: score,
            durationSeconds: duration,
            communicationScore: extras?.communicationScore,
            grammarScore: extras?.grammarScore,
            confidenceScore: extras?.confidenceScore,
            technicalScore: extras?.technicalScore,
          }
        : { tool, activityType: activity, mode: extras?.mode, tutorId: extras?.tutorId, score, duration };

      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).catch(() => { /* local already saved */ });
    }

    return entry;
  }, [user]);

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

  return { entries, track, interviewScores, activityByDay, streak, totalSessions, avgScore, byTool };
}
