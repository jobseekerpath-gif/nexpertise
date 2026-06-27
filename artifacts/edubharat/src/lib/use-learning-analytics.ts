import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/,"") ?? "";

export type LearningSession = {
  id: number;
  tool: string;
  activityType: string;
  score: number | null;
  duration: number | null;
  tutorId: string | null;
  mode: string | null;
  createdAt: string;
};

export type DayCount = { date: string; label: string; count: number; durationSeconds: number };

export type LearningAnalytics = {
  sessions: LearningSession[];
  totalSessions: number;
  streak: number;
  totalDurationSeconds: number;
  sessionsPerDay: DayCount[];
  tutorBreakdown: { tutorId: string; count: number }[];
  modeBreakdown: { mode: string; count: number }[];
  recentSessions: LearningSession[];
};

function today() { return new Date().toISOString().slice(0, 10); }

function last30Days(): DayCount[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const date = d.toISOString().slice(0, 10);
    return {
      date,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      count: 0,
      durationSeconds: 0,
    };
  });
}

function computeStreak(sessions: LearningSession[]): number {
  const dates = [...new Set(sessions.map(s => s.createdAt.slice(0, 10)))].sort().reverse();
  let streak = 0;
  const now = new Date();
  for (const date of dates) {
    const diff = Math.round((now.getTime() - new Date(date + "T00:00").getTime()) / 86400000);
    if (diff === streak) streak++;
    else break;
  }
  return streak;
}

export function useLearningAnalytics(): LearningAnalytics {
  const { user } = useAuth();
  const [serverSessions, setServerSessions] = useState<LearningSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    fetch(`${BASE}/api/sessions/learning?limit=200`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { sessions?: LearningSession[] }) => {
        setServerSessions(d.sessions ?? []);
      })
      .catch(() => { /* fall back to local */ })
      .finally(() => setLoaded(true));
  }, [user]);

  const sessions = useMemo(() => {
    if (user && loaded) return serverSessions;
    // local fallback from legacy progress entries
    try {
      const raw = localStorage.getItem("edubharat_progress");
      const progress = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      return progress
        .filter(p => p["tool"] === "English Guru")
        .map((p, i) => ({
          id: Number(p["id"] ?? i),
          tool: String(p["tool"] ?? "English Guru"),
          activityType: String(p["activity"] ?? ""),
          score: typeof p["score"] === "number" ? p["score"] : null,
          duration: typeof p["duration"] === "number" ? p["duration"] : null,
          tutorId: typeof p["tutorId"] === "string" ? p["tutorId"] : null,
          mode: typeof p["mode"] === "string" ? p["mode"] : null,
          createdAt: typeof p["date"] === "string" ? `${p["date"]}T00:00:00.000Z` : new Date().toISOString(),
        }));
    } catch { return []; }
  }, [user, loaded, serverSessions]);

  const totalSessions = sessions.length;
  const totalDurationSeconds = sessions.reduce((a, s) => a + (s.duration ?? 0), 0);
  const streak = computeStreak(sessions);

  const sessionsPerDay = useMemo(() => {
    const days = last30Days();
    for (const s of sessions) {
      const date = s.createdAt.slice(0, 10);
      const day = days.find(d => d.date === date);
      if (day) {
        day.count++;
        day.durationSeconds += s.duration ?? 0;
      }
    }
    return days;
  }, [sessions]);

  const tutorBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.tutorId) map.set(s.tutorId, (map.get(s.tutorId) ?? 0) + 1);
    }
    return [...map.entries()].map(([tutorId, count]) => ({ tutorId, count })).sort((a, b) => b.count - a.count);
  }, [sessions]);

  const modeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      if (s.mode) map.set(s.mode, (map.get(s.mode) ?? 0) + 1);
    }
    return [...map.entries()].map(([mode, count]) => ({ mode, count })).sort((a, b) => b.count - a.count);
  }, [sessions]);

  const recentSessions = useMemo(() => sessions.slice(0, 10), [sessions]);

  return { sessions, totalSessions, streak, totalDurationSeconds, sessionsPerDay, tutorBreakdown, modeBreakdown, recentSessions };
}
