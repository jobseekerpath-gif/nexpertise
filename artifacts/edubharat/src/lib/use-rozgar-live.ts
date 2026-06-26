import { useCallback, useState } from "react";

export type RozgarLiveItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  company?: string;
  location?: string;
  jobType?: string;
  remote?: boolean;
  salary?: string;
  kind?: "vacancy" | "news" | "update";
};

export type RozgarLiveResponse = {
  section: string;
  fetchedAt: string;
  sources: Array<{ name: string; query: string }>;
  items: RozgarLiveItem[];
  error?: string;
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function useRozgarLive() {
  const [data, setData] = useState<RozgarLiveResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (section: string, profile: Record<string, string>) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        section,
        location: profile.location ?? "",
        industry: profile.industry ?? "",
        status: profile.status ?? "",
        goal: profile.careerGoal ?? "",
        skills: profile.skills ?? "",
      });

      const response = await fetch(`${BASE}/api/rozgar/live?${params.toString()}`, {
        credentials: "include",
      });

      const json = (await response.json()) as RozgarLiveResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Live source unavailable");
      }

      setData(json);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live source unavailable";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, load, setData };
}