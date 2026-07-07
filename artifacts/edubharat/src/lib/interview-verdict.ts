/** The overall-score pass bar for an interview's Selected / Not Selected result.
 *  60 aligns with grade()'s "Average" band and the common Indian first-class /
 *  pass mark. Shared so the report screen and the saved-report detail can never
 *  drift apart. */
export const INTERVIEW_PASS_THRESHOLD = 60;

/** Deterministic Selected / Not Selected result, derived purely from the overall
 *  score so the label can never contradict the score shown to the candidate. */
export function interviewVerdict(score: number): { label: "Selected" | "Not Selected"; selected: boolean } {
  const selected = score >= INTERVIEW_PASS_THRESHOLD;
  return { label: selected ? "Selected" : "Not Selected", selected };
}
