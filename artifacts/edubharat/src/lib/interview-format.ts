// ─────────────────────────────────────────────────────────────────────────────
// Structured interview format — Assessment Scorecard
//
// Mock interviews are conducted and scored against a weighted six-competency
// scorecard modelled on a real HR interview assessment form:
//
//   1. Communication & Clarity        15%   (min 10 min) — judged from delivery
//   2. Domain / Role Knowledge        30%   (min 10 min) — the core, role-specific
//   3. Problem-Solving & Approach     20%   (min 15 min)
//   4. Ownership & Culture Fit        15%   (min 15 min)
//   5. Adaptability & Learning Agility 10%  (min 25 min)
//   6. Depth Probe                    10%   (min 25 min) — leadership / initiative
//
// Interview length gates which competencies are covered: a 10-min interview
// covers 1–2, a 15-min covers 1–4, a 25-min covers all six. Each rating is on a
// 1–5 scale calibrated to the candidate's experience level.
//
// Communication & Clarity is scored from HOW the candidate expresses every
// answer, so it has no dedicated question stage — the live question rotation
// targets the other covered competencies, with Domain as the recurring core.
// ─────────────────────────────────────────────────────────────────────────────

export type CompetencyKey =
  | "communication"
  | "domainKnowledge"
  | "problemSolving"
  | "ownership"
  | "adaptability"
  | "depthProbe";

export type CompetencyDef = {
  key: CompetencyKey;
  label: string;
  /** Scorecard weight (0–1). */
  weight: number;
  /** Minimum interview length (minutes) that unlocks this competency. */
  minMinutes: number;
  /** What the interviewer probes / the evaluator scores for this competency. */
  focus: string;
};

/** The weighted scorecard, in display order. Weights sum to 1.0 across all six. */
export const COMPETENCIES: CompetencyDef[] = [
  {
    key: "communication",
    label: "Communication & Clarity",
    weight: 0.15,
    minMinutes: 10,
    focus:
      "how clearly and confidently the candidate articulates ideas, structures answers, and listens to the question",
  },
  {
    key: "domainKnowledge",
    label: "Domain / Role Knowledge",
    weight: 0.3,
    minMinutes: 10,
    focus: "role-specific functional and domain knowledge (the core of the interview)",
  },
  {
    key: "problemSolving",
    label: "Problem-Solving & Approach",
    weight: 0.2,
    minMinutes: 15,
    focus:
      "structured thinking and sound judgement — how they break a problem down, weigh trade-offs, and reach a practical solution",
  },
  {
    key: "ownership",
    label: "Ownership & Culture Fit",
    weight: 0.15,
    minMinutes: 15,
    focus:
      "accountability, attitude and energy — owning outcomes, learning from mistakes, and fit with a collaborative team",
  },
  {
    key: "adaptability",
    label: "Adaptability & Learning Agility",
    weight: 0.1,
    minMinutes: 25,
    focus:
      "comfort with change, ambiguity and feedback, and how quickly they pick up new things",
  },
  {
    key: "depthProbe",
    label: "Depth Probe",
    weight: 0.1,
    minMinutes: 25,
    focus:
      "a deeper probe calibrated to experience — leadership and influence for experienced candidates, initiative and drive for freshers",
  },
];

/** The competencies a given interview length covers (form: 10-min → 1–2,
 *  15-min → 1–4, 25-min → all six). */
export function coveredCompetencies(durationMin: number): CompetencyDef[] {
  return COMPETENCIES.filter((c) => durationMin >= c.minMinutes);
}

/**
 * Total Weighted Score (1–5) over ONLY the competencies covered by this
 * interview length. Weights are renormalised across the covered competencies so
 * the result always stays on the 1–5 scale. Returns 0 if nothing was scored.
 */
export function weightedScoreFor(
  ratings: Partial<Record<CompetencyKey, number>>,
  durationMin: number,
): number {
  let weightSum = 0;
  let ratingSum = 0;
  for (const c of coveredCompetencies(durationMin)) {
    const r = ratings[c.key];
    if (typeof r === "number" && r > 0) {
      weightSum += c.weight;
      ratingSum += c.weight * r;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round((ratingSum / weightSum) * 10) / 10; // one decimal
}

/**
 * Experience-level calibration. The 1–5 scale ("meets expectations" = 3) means
 * something different at each level, so the bar moves with experience.
 */
const CALIBRATION: Record<string, string> = {
  Fresher:
    "This is a FRESHER. Calibrate the bar to fundamentals and potential — sound basics, clear thinking and willingness to learn matter more than deep experience. 'Meets expectations' (3) = solid fundamentals for an entry-level hire.",
  "1-2 years":
    "This candidate has 1-2 years' experience. Calibrate to INDEPENDENT EXECUTION — they should handle routine work on their own with light guidance. 'Meets expectations' (3) = reliably delivers standard tasks independently.",
  "3-5 years":
    "This candidate has 3-5 years' experience. Calibrate to OWNERSHIP & JUDGEMENT — they should own outcomes, make sound calls, and handle ambiguity. 'Meets expectations' (3) = owns their area with good judgement.",
  "5+ years":
    "This candidate has 5+ years' experience. Calibrate to STRATEGIC & LEADERSHIP depth — they should show influence, mentoring and strategic thinking. 'Meets expectations' (3) = a strong senior contributor who elevates the team.",
};

/** Calibration guidance for the given experience level (falls back to Fresher). */
export function calibrationFor(experience: string): string {
  return CALIBRATION[experience] ?? CALIBRATION["Fresher"]!;
}

/** What the Depth Probe should target for a given experience level
 *  (leadership for senior candidates, initiative for freshers). */
export function depthProbeFocus(experience: string): string {
  if (experience === "5+ years")
    return "leadership, influence and strategic thinking — leading teams or initiatives, mentoring others, and driving outcomes beyond their own tasks";
  if (experience === "3-5 years")
    return "ownership and leadership potential — taking initiative beyond the brief, mentoring juniors, and making judgement calls under pressure";
  if (experience === "1-2 years")
    return "initiative and growing ownership — going beyond assigned work, self-direction, and taking responsibility for results";
  return "initiative, self-drive and learning potential — self-started projects, extra-curricular initiative, and how they push themselves to grow";
}

/**
 * Role-specific domain-knowledge focus. Banking and Insurance mirror the sample
 * assessment format exactly; every other role applies the same idea with
 * domain-appropriate, practical topics a real panel would probe.
 */
const FUNCTIONAL_KNOWLEDGE: Record<string, string> = {
  banking:
    "Banking concepts — Retail Assets & Liabilities products (savings/current accounts, loans, credit cards), KYC norms, and basic Underwriting (UW). Ask practical, product-level questions.",
  insurance:
    "Insurance concepts — the concept of Risk & Insurance, the difference between Life and General insurance, retail insurance products, distribution channels, and KYC. Ask practical, product-level questions.",
  finance:
    "Core finance & accounting — financial statements, key ratios, taxation basics, budgeting/forecasting, and compliance. Ask applied, numerical-reasoning questions.",
  software:
    "Software fundamentals — programming basics, data structures, a real project the candidate built, their debugging approach, and relevant frameworks/tools. Ask concrete, example-driven questions.",
  data_analytics:
    "Data & analytics — data cleaning and analysis, Excel/SQL, interpreting results, dashboards/visualisation tools, and turning data into business insight.",
  sales:
    "Sales fundamentals — the sales process, lead generation, handling objections, negotiation and closing, and meeting targets. Ask for real scenarios.",
  marketing:
    "Marketing fundamentals — campaign planning, digital and offline channels, key metrics/ROI, segmentation, and brand positioning.",
  customer_service:
    "Customer service — handling difficult customers, complaint resolution, CRM tools, staying composed under pressure, and service-quality metrics.",
  operations:
    "Operations — process management and efficiency, quality control, cross-team coordination, SLAs, and practical problem-solving.",
  hr: "HR & behavioural depth — situational judgement, people-handling, and the candidate's own domain knowledge relevant to the role they are applying for.",
  freshers:
    "Fundamentals for a fresher — core concepts from their degree, academic/internship projects, and basic aptitude. Keep it encouraging but substantive.",
  government:
    "Exam-relevant knowledge — general awareness and current affairs, reasoning, quantitative aptitude, and the specific service/domain the candidate is targeting.",
};

/** Functional-knowledge guidance for a given interview type. Falls back to a
 *  generic, role-appropriate prompt for any unmapped type. */
export function functionalKnowledgeFor(type: string, roleLabel: string): string {
  return (
    FUNCTIONAL_KNOWLEDGE[type] ??
    `Core functional and domain knowledge directly relevant to a ${roleLabel} role — ask practical, applied questions a real interview panel would ask.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live question rotation
//
// Dedicated questions target the covered competencies EXCEPT Communication
// (which is judged from delivery). Domain/Role Knowledge is the recurring core,
// interleaved with the other covered competencies so consecutive questions
// always differ and Domain never repeats back-to-back. The rotation scales with
// interview length: a 10-min interview asks Domain only; longer interviews add
// Problem-Solving, Ownership, Adaptability and the Depth Probe.
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewArea = {
  key: string;
  label: string;
  /** Fully-composed guidance for what to probe — roughly one question's worth. */
  focus: string;
};

export type BeatContext = {
  durationMin: number;
  experience: string;
  /** Interview type value (e.g. "banking") for role-specific domain topics. */
  type: string;
  roleLabel: string;
};

/** The ordered competency keys to ask dedicated questions on, for a given
 *  interview length. Domain recurs (core) but never back-to-back. */
function questionRotation(durationMin: number): CompetencyKey[] {
  const covered = coveredCompetencies(durationMin)
    .map((c) => c.key)
    .filter((k) => k !== "communication");
  const others = covered.filter((k) => k !== "domainKnowledge");
  if (others.length === 0) return ["domainKnowledge"];
  const rotation: CompetencyKey[] = [];
  for (const key of others) {
    rotation.push("domainKnowledge");
    rotation.push(key);
  }
  return rotation;
}

/**
 * The competency area a given beat targets. Beat 0 is always the opening
 * introduction/background; later beats cycle through the length-aware rotation.
 * The returned `focus` is fully composed (role-specific for domain,
 * experience-specific for the depth probe) so callers can use it directly.
 */
export function areaForBeat(index: number, ctx: BeatContext): InterviewArea {
  if (index <= 0) {
    return {
      key: "background",
      label: "Introduction & Background",
      focus: `a brief self-introduction and their background relevant to the ${ctx.roleLabel} role — key qualifications or experience, main subjects or skills, and any notable achievements`,
    };
  }
  const rotation = questionRotation(ctx.durationMin);
  const key = rotation[(index - 1) % rotation.length]!;
  const def = COMPETENCIES.find((c) => c.key === key)!;
  let focus = def.focus;
  if (key === "domainKnowledge") {
    focus = `${def.focus} — ${functionalKnowledgeFor(ctx.type, ctx.roleLabel)}`;
  } else if (key === "depthProbe") {
    focus = `${def.focus}. Specifically probe ${depthProbeFocus(ctx.experience)}`;
  }
  return { key, label: def.label, focus };
}
