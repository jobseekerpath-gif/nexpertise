import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

export type SavedJob = {
  id: string;
  jobId: string;
  title: string;
  company?: string;
  link: string;
  location?: string;
  salary?: string;
  jobType?: string;
  source?: string;
  savedAt: string;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// User-scoped localStorage key prevents cross-session data leakage
function localKey(userId?: number): string {
  return userId != null ? `edubharat_saved_jobs_${userId}` : "edubharat_saved_jobs_guest";
}

function loadLocal(userId?: number): SavedJob[] {
  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? (JSON.parse(raw) as SavedJob[]) : [];
  } catch { return []; }
}

function saveLocal(jobs: SavedJob[], userId?: number) {
  try { localStorage.setItem(localKey(userId), JSON.stringify(jobs)); } catch { /* ignore */ }
}

export function useSavedJobs() {
  const { user } = useAuth();
  const userId = user?.id;

  // Start from guest cache; when user logs in, useEffect below replaces with server state
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>(() => loadLocal(undefined));
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(loadLocal(undefined).map(j => j.jobId)));
  const syncedRef = useRef(false);
  const prevUserRef = useRef<number | undefined>(undefined);

  // On login: fetch from server and replace state
  useEffect(() => {
    if (!userId) return;
    if (syncedRef.current && prevUserRef.current === userId) return;
    syncedRef.current = true;
    prevUserRef.current = userId;

    fetch(`${BASE}/api/jobs/saved`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { jobs?: Array<Record<string, unknown>> }) => {
        const jobs: SavedJob[] = (data.jobs ?? []).map(j => ({
          id: String(j["id"] ?? ""),
          jobId: String(j["jobId"] ?? ""),
          title: String(j["title"] ?? ""),
          company: typeof j["company"] === "string" ? j["company"] : undefined,
          link: String(j["link"] ?? ""),
          location: typeof j["location"] === "string" ? j["location"] : undefined,
          salary: typeof j["salary"] === "string" ? j["salary"] : undefined,
          jobType: typeof j["jobType"] === "string" ? j["jobType"] : undefined,
          source: typeof j["source"] === "string" ? j["source"] : undefined,
          savedAt: typeof j["savedAt"] === "string" ? j["savedAt"] : new Date().toISOString(),
        }));
        setSavedJobs(jobs);
        setSavedIds(new Set(jobs.map(j => j.jobId)));
        saveLocal(jobs, userId);
      })
      .catch(() => {
        // Keep user-scoped local cache as fallback
        const cached = loadLocal(userId);
        if (cached.length > 0) {
          setSavedJobs(cached);
          setSavedIds(new Set(cached.map(j => j.jobId)));
        }
      });
  }, [userId]);

  // On logout: clear state so prior user's jobs are never visible to next session
  useEffect(() => {
    if (!userId && prevUserRef.current) {
      prevUserRef.current = undefined;
      syncedRef.current = false;
      setSavedJobs([]);
      setSavedIds(new Set());
    }
  }, [userId]);

  const saveJob = useCallback(async (job: Omit<SavedJob, "id" | "savedAt">) => {
    if (savedIds.has(job.jobId)) return;

    const tempJob: SavedJob = { ...job, id: `local-${Date.now()}`, savedAt: new Date().toISOString() };
    setSavedJobs(prev => { const updated = [tempJob, ...prev]; saveLocal(updated, userId); return updated; });
    setSavedIds(prev => new Set([...prev, job.jobId]));

    if (userId) {
      try {
        const res = await fetch(`${BASE}/api/jobs/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(job),
        });
        const data = (await res.json()) as { saved?: Record<string, unknown> };
        if (data.saved) {
          const serverJob: SavedJob = {
            id: String(data.saved["id"] ?? tempJob.id),
            jobId: String(data.saved["jobId"] ?? job.jobId),
            title: String(data.saved["title"] ?? job.title),
            company: typeof data.saved["company"] === "string" ? data.saved["company"] : job.company,
            link: String(data.saved["link"] ?? job.link),
            location: typeof data.saved["location"] === "string" ? data.saved["location"] : job.location,
            salary: typeof data.saved["salary"] === "string" ? data.saved["salary"] : job.salary,
            jobType: typeof data.saved["jobType"] === "string" ? data.saved["jobType"] : job.jobType,
            source: typeof data.saved["source"] === "string" ? data.saved["source"] : job.source,
            savedAt: typeof data.saved["savedAt"] === "string" ? data.saved["savedAt"] : tempJob.savedAt,
          };
          setSavedJobs(prev => { const updated = prev.map(j => j.id === tempJob.id ? serverJob : j); saveLocal(updated, userId); return updated; });
        }
      } catch { /* local already saved */ }
    }
  }, [userId, savedIds]);

  const unsaveJob = useCallback(async (jobId: string) => {
    setSavedJobs(prev => { const updated = prev.filter(j => j.jobId !== jobId); saveLocal(updated, userId); return updated; });
    setSavedIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });

    if (userId) {
      try {
        await fetch(`${BASE}/api/jobs/save/${encodeURIComponent(jobId)}`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch { /* local already removed */ }
    }
  }, [userId]);

  const isJobSaved = useCallback((jobId: string) => savedIds.has(jobId), [savedIds]);

  return { savedJobs, saveJob, unsaveJob, isJobSaved, count: savedJobs.length };
}
