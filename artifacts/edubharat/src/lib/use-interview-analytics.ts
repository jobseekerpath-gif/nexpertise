import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/,"") ?? "";

export type InterviewReport = {
  overallScore: number;
  communicationScore: number;
  grammarScore: number;
  confidenceScore: number;
  technicalScore: number;
  roleFit: string;
  strengths: string[];
  concerns: string[];
  improvements: string[];
  nextSteps: string[];
};

export type InterviewSession = {
  id: number;
  role: string;
  experienceLevel: string;
  interviewType: string | null;
  questionsData: string | null;
  overallScore: number | null;
  durationSeconds: number | null;
  feedbackJson: string | null;
  communicationScore: number | null;
  grammarScore: number | null;
  confidenceScore: number | null;
  technicalScore: number | null;
  completedAt: string | null;
  createdAt: string;
};

export type InterviewAnalytics = {
  sessions: InterviewSession[];
  totalInterviews: number;
  averageScore: number;
  scoreTrend: { label: string; score: number; type: string }[];
  latestBreakdown: { label: string; value: number; color: string }[] | null;
  latestReport: InterviewReport | null;
  pastInterviews: InterviewSession[];
};

function parseReport(text: string | null): InterviewReport | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      overallScore: Number(parsed["overallScore"] ?? 0),
      communicationScore: Number(parsed["communicationScore"] ?? 0),
      grammarScore: Number(parsed["grammarScore"] ?? 0),
      confidenceScore: Number(parsed["confidenceScore"] ?? 0),
      technicalScore: Number(parsed["technicalScore"] ?? 0),
      roleFit: String(parsed["roleFit"] ?? ""),
      strengths: Array.isArray(parsed["strengths"]) ? parsed["strengths"].map(String) : [],
      concerns: Array.isArray(parsed["concerns"]) ? parsed["concerns"].map(String) : [],
      improvements: Array.isArray(parsed["improvements"]) ? parsed["improvements"].map(String) : [],
      nextSteps: Array.isArray(parsed["nextSteps"]) ? parsed["nextSteps"].map(String) : [],
    };
  } catch { return null; }
}

export function useInterviewAnalytics(): InterviewAnalytics {
  const { user } = useAuth();
  const [serverSessions, setServerSessions] = useState<InterviewSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    fetch(`${BASE}/api/sessions/interview?limit=20`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { sessions?: InterviewSession[] }) => {
        setServerSessions(d.sessions ?? []);
      })
      .catch(() => { /* fall back to local */ })
      .finally(() => setLoaded(true));
  }, [user]);

  const sessions = useMemo(() => {
    if (user && loaded) return serverSessions;
    try {
      const raw = localStorage.getItem("edubharat_interview_sessions");
      const stored = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      return stored.map((s, i) => ({
        id: Number(s["id"] ?? -i),
        role: String(s["role"] ?? ""),
        experienceLevel: String(s["experienceLevel"] ?? "Fresher"),
        interviewType: typeof s["interviewType"] === "string" ? s["interviewType"] : null,
        questionsData: typeof s["questionsData"] === "string" ? s["questionsData"] : null,
        overallScore: typeof s["overallScore"] === "number" ? s["overallScore"] : null,
        durationSeconds: typeof s["durationSeconds"] === "number" ? s["durationSeconds"] : null,
        feedbackJson: typeof s["feedbackJson"] === "string" ? s["feedbackJson"] : null,
        communicationScore: null,
        grammarScore: null,
        confidenceScore: null,
        technicalScore: null,
        completedAt: typeof s["savedAt"] === "string" ? s["savedAt"] : null,
        createdAt: typeof s["savedAt"] === "string" ? s["savedAt"] : new Date().toISOString(),
      })) as InterviewSession[];
    } catch { return []; }
  }, [user, loaded, serverSessions]);

  const withScore = sessions.filter(s => s.overallScore !== null);
  const totalInterviews = sessions.length;
  const averageScore = withScore.length > 0
    ? Math.round(withScore.reduce((a, s) => a + (s.overallScore ?? 0), 0) / withScore.length)
    : 0;

  const scoreTrend = useMemo(() => {
    return withScore
      .slice(0, 10)
      .reverse()
      .map((s, i) => {
        const type = s.interviewType ?? s.role ?? "Interview";
        // Show short date + type (e.g. "Jun 30 · HR")
        const date = s.completedAt ?? s.createdAt;
        const d = new Date(date);
        const month = d.toLocaleString("en-IN", { month: "short" });
        const day = d.getDate();
        const label = `${day} ${month}`;
        return {
          label,
          score: Math.min(100, Math.max(0, s.overallScore ?? 0)),
          type,
        };
      });
  }, [withScore]);

  const latest = sessions[0] ?? null;
  const latestReport = latest ? parseReport(latest.feedbackJson) : null;
  const latestBreakdown = latestReport
    ? [
      { label: "Communication", value: latestReport.communicationScore, color: "#3b82f6" },
      { label: "Grammar", value: latestReport.grammarScore, color: "#22c55e" },
      { label: "Confidence", value: latestReport.confidenceScore, color: "#f97316" },
      { label: "Technical", value: latestReport.technicalScore, color: "#a855f7" },
    ].filter(d => d.value > 0)
    : null;

  const pastInterviews = useMemo(() => sessions.slice(0, 20), [sessions]);

  return { sessions, totalInterviews, averageScore, scoreTrend, latestBreakdown, latestReport, pastInterviews };
}
