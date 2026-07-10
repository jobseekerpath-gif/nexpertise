// ─────────────────────────────────────────────────────────────────────────────
// Interview scoring scale, weighted-score recommendation bands, and the derived
// Selected / Not Selected result. Shared so the report screen, the downloadable
// transcript, and the saved-report detail on the Progress page never drift.
// ─────────────────────────────────────────────────────────────────────────────

/** The 1–5 rating scale labels from the assessment form (index = rating). */
export const RATING_LABELS = [
  "",
  "Considerable improvement",
  "Moderate improvement",
  "Meets expectations",
  "Exceeds expectations",
  "Outstanding",
] as const;

/** Human label for a 1–5 competency rating (clamped/rounded). */
export function ratingLabel(rating: number): string {
  const i = Math.max(1, Math.min(5, Math.round(rating)));
  return RATING_LABELS[i]!;
}

export type RecommendationLabel = "Strong Hire" | "Hire" | "Hold" | "No Hire";

/**
 * The hiring recommendation for a Total Weighted Score (1–5), using the form's
 * bands: Strong Hire 4.3–5.0 · Hire 3.5–4.2 · Hold 2.5–3.4 · No Hire <2.5.
 * `selected` is true for Strong Hire and Hire (the Hire line is the pass bar).
 */
export function recommendationForWeighted(weighted: number): {
  label: RecommendationLabel;
  selected: boolean;
} {
  if (weighted >= 4.3) return { label: "Strong Hire", selected: true };
  if (weighted >= 3.5) return { label: "Hire", selected: true };
  if (weighted >= 2.5) return { label: "Hold", selected: false };
  return { label: "No Hire", selected: false };
}

/** Same bands, keyed off a 0–100 overall score (weighted × 20). Used by surfaces
 *  that only have the stored overall percentage (e.g. older saved reports). */
export function recommendationForScore(score: number): {
  label: RecommendationLabel;
  selected: boolean;
} {
  return recommendationForWeighted(score / 20);
}

/** Full colour classes per recommendation band (static strings so Tailwind's JIT
 *  always detects them — never build these dynamically). */
export const RECOMMENDATION_STYLES: Record<
  RecommendationLabel,
  { badge: string; text: string }
> = {
  "Strong Hire": { badge: "bg-emerald-100 text-emerald-800 border-emerald-300", text: "text-emerald-700" },
  Hire: { badge: "bg-green-100 text-green-800 border-green-300", text: "text-green-700" },
  Hold: { badge: "bg-amber-100 text-amber-800 border-amber-300", text: "text-amber-700" },
  "No Hire": { badge: "bg-red-100 text-red-800 border-red-300", text: "text-red-700" },
};

/** The overall-score pass bar (0–100). 70 corresponds to the form's Hire line
 *  (3.5 / 5.0 × 20), so Selected/Not Selected agrees with the recommendation. */
export const INTERVIEW_PASS_THRESHOLD = 70;

/** Deterministic Selected / Not Selected result, derived purely from the overall
 *  score so the label can never contradict the recommendation or the score. */
export function interviewVerdict(score: number): { label: "Selected" | "Not Selected"; selected: boolean } {
  const selected = score >= INTERVIEW_PASS_THRESHOLD;
  return { label: selected ? "Selected" : "Not Selected", selected };
}
