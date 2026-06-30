import { useCallback, useEffect, useRef, useState } from "react";
import type { RozgarLiveItem, RozgarLiveResponse } from "./use-rozgar-live";
import type { StudentProfile } from "./use-student-profile";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Sections to fetch from /api/rozgar/live when the primary endpoint fails
const JOB_SECTIONS = ["top_jobs", "govt_jobs", "private_jobs", "internships"] as const;

export type JobFetchState = {
  data: RozgarLiveItem[];
  isLoading: boolean;
  error: string | null;
  source: "search" | "live" | "fallback" | null;
};

// ─── Type guards ──────────────────────────────────────────────────────────────

type SearchResponse = { items: RozgarLiveItem[]; source: string; total: number; error?: string };

function isSearchResponse(v: unknown): v is SearchResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as Record<string, unknown>).items)
  );
}

function isRozgarResponse(value: unknown): value is RozgarLiveResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).items)
  );
}

// ─── Dedup ───────────────────────────────────────────────────────────────────

function dedup(items: RozgarLiveItem[]): RozgarLiveItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.title}::${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Primary source: /api/jobs/search ────────────────────────────────────────

async function fetchFromSearch(profile: StudentProfile, keyword: string): Promise<RozgarLiveItem[] | null> {
  const params = new URLSearchParams();
  if (keyword) params.set("q", keyword);
  const city = profile.preferredCity || profile.location || "";
  if (city) params.set("city", city);
  const skills = (profile.skills || []).join(", ");
  if (skills) params.set("skills", skills);
  const exp = profile.experienceLevel || "";
  if (exp) params.set("experience", exp.toLowerCase().includes("fresher") ? "fresher" : exp.toLowerCase().includes("junior") || exp.includes("1-3") ? "junior" : exp.toLowerCase().includes("senior") || exp.includes("6+") ? "senior" : "mid");
  const industry = (profile.industryPreference || "").toLowerCase().replace(/\s*\/.*/, "").trim();
  if (industry) params.set("industry", industry);

  const res = await fetch(`${BASE}/api/jobs/search?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return null;

  const json = (await res.json()) as unknown;
  if (!isSearchResponse(json)) return null;
  if (json.items.length === 0 && json.error) return null; // signal failure so we fall back

  return json.items;
}

// ─── Fallback source: /api/rozgar/live (multi-section) ───────────────────────

async function fetchFromLive(profile: StudentProfile): Promise<RozgarLiveItem[]> {
  const params = new URLSearchParams({
    location: profile.preferredCity || profile.location || "India",
    industry: profile.industryPreference || "Technology",
    status: profile.experienceLevel || "Fresher",
    goal: profile.careerGoal || "Private Job",
    skills: (profile.skills || []).join(", "),
  });

  const responses = await Promise.allSettled(
    JOB_SECTIONS.map(section =>
      fetch(`${BASE}/api/rozgar/live?${params.toString()}&section=${section}`, {
        credentials: "include",
      })
    )
  );

  const allItems: RozgarLiveItem[] = [];
  let anyOk = false;

  for (const r of responses) {
    if (r.status !== "fulfilled" || !r.value.ok) continue;
    const json = (await r.value.json()) as unknown;
    if (!isRozgarResponse(json)) continue;
    anyOk = true;
    allItems.push(...json.items);
  }

  if (!anyOk) throw new Error("All live job sources are unavailable right now.");
  return allItems;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRozgarJobs(profile: StudentProfile, keyword = "") {
  const [state, setState] = useState<JobFetchState>({
    data: [],
    isLoading: false,
    error: null,
    source: null,
  });

  // Abort signal for in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ data: [], isLoading: true, error: null, source: null });

    try {
      // 1. Primary: real job search endpoint (Adzuna + Jobicy)
      let items: RozgarLiveItem[] | null = null;
      let source: JobFetchState["source"] = null;

      try {
        items = await fetchFromSearch(profile, keyword);
        if (items !== null) source = "search";
      } catch {
        // Search endpoint unavailable — fall through to live
      }

      if (ctrl.signal.aborted) return;

      // 2. Fallback: per-section /api/rozgar/live scraping
      if (items === null || items.length === 0) {
        try {
          items = await fetchFromLive(profile);
          source = items.length > 0 ? "live" : "fallback";
        } catch (err) {
          if (ctrl.signal.aborted) return;
          // Both sources failed
          const msg = err instanceof Error ? err.message : "Failed to load jobs";
          setState({ data: [], isLoading: false, error: msg, source: "fallback" });
          return;
        }
      }

      if (ctrl.signal.aborted) return;

      setState({
        data: dedup(items ?? []),
        isLoading: false,
        error: null,
        source,
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load jobs";
      setState({ data: [], isLoading: false, error: message, source: null });
    }
  }, [
    profile.preferredCity,
    profile.location,
    profile.industryPreference,
    profile.experienceLevel,
    profile.careerGoal,
    // skills is an array — stringify for stable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(profile.skills),
    keyword,
  ]);

  useEffect(() => {
    void load();
    return () => { abortRef.current?.abort(); };
  }, [load]);

  return { data: state.data, isLoading: state.isLoading, error: state.error, source: state.source, reload: load };
}
