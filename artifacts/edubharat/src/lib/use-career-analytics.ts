import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./use-auth";
import { useStudentProfile } from "./use-student-profile";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/,"") ?? "";

export type SavedJob = {
  id: number | string;
  jobId: string;
  title: string;
  company: string | null;
  link: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  source: string | null;
  applicationStatus: string | null;
  savedAt: string;
};

export type CareerAnalytics = {
  savedJobs: SavedJob[];
  savedJobsCount: number;
  applicationStatusBreakdown: { status: string; count: number }[];
  recentSavedJobs: SavedJob[];
  resumeScore: number | null;
  resumeFileName: string | null;
  profileCompletion: number;
};

// Align with use-saved-jobs.ts key scheme
function localKey(userId?: number): string {
  return userId != null ? `edubharat_saved_jobs_${userId}` : "edubharat_saved_jobs_guest";
}

export function useCareerAnalytics(): CareerAnalytics {
  const { user } = useAuth();
  const { profile, completionPct } = useStudentProfile();
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [loaded, setLoaded] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    fetch(`${BASE}/api/jobs/saved`, { credentials: "include" })
      .then(r => r.json())
      .then((d: { jobs?: SavedJob[] }) => {
        setSavedJobs(d.jobs ?? []);
      })
      .catch(() => { /* fall back to local */ })
      .finally(() => setLoaded(true));
  }, [user]);

  const localSavedJobs = useMemo(() => {
    try {
      const raw = localStorage.getItem(localKey(userId));
      return raw ? (JSON.parse(raw) as SavedJob[]) : [];
    } catch { return []; }
  }, [userId]);

  const jobs = useMemo(() => {
    if (user && loaded) return savedJobs;
    return localSavedJobs;
  }, [user, loaded, savedJobs, localSavedJobs]);

  const applicationStatusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      const status = job.applicationStatus ?? "saved";
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return [...map.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
  }, [jobs]);

  const resumeScore = profile.resumeAnalysis?.overallScore ?? null;

  return {
    savedJobs: jobs,
    savedJobsCount: jobs.length,
    applicationStatusBreakdown,
    recentSavedJobs: jobs.slice(0, 5),
    resumeScore,
    resumeFileName: profile.resumeFileName || null,
    profileCompletion: completionPct,
  };
}
