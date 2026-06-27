import { useCallback, useEffect, useState } from "react";
import type { RozgarLiveResponse } from "./use-rozgar-live";
import type { StudentProfile } from "./use-student-profile";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const JOB_SECTIONS = ["top_jobs", "govt_jobs", "private_jobs", "internships"] as const;

export type JobFetchState = {
  data: RozgarLiveResponse["items"];
  isLoading: boolean;
  error: string | null;
};

function isRozgarResponse(value: unknown): value is RozgarLiveResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).items)
  );
}

export function useRozgarJobs(profile: StudentProfile) {
  const [state, setState] = useState<JobFetchState>({ data: [], isLoading: false, error: null });

  const load = useCallback(async () => {
    setState({ data: [], isLoading: true, error: null });
    try {
      const params = new URLSearchParams({
        location: profile.preferredCity || profile.location || "India",
        industry: profile.industryPreference || "Technology",
        status: profile.experienceLevel || "Fresher",
        goal: profile.careerGoal || "Private Job",
        skills: (profile.skills || []).join(", "),
      });

      const responses = await Promise.allSettled(
        JOB_SECTIONS.map(section =>
          fetch(`${BASE}/api/rozgar/live?${params.toString()}&section=${section}`, { credentials: "include" })
        )
      );

      let allError = true;
      const allItems: RozgarLiveResponse["items"] = [];

      for (const r of responses) {
        if (r.status !== "fulfilled" || !r.value.ok) continue;
        const json = (await r.value.json()) as unknown;
        if (!isRozgarResponse(json)) continue;
        allError = false;
        allItems.push(...json.items);
      }

      if (allError) {
        setState({ data: [], isLoading: false, error: "Job sources are unavailable right now. Please try again later." });
        return [];
      }

      // Deduplicate by title+link
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = `${item.title}::${item.link}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setState({ data: deduped, isLoading: false, error: null });
      return deduped;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load jobs";
      setState({ data: [], isLoading: false, error: message });
      return [];
    }
  }, [
    profile.preferredCity, profile.location, profile.industryPreference,
    profile.experienceLevel, profile.careerGoal, profile.skills,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
