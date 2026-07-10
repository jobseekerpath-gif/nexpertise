// ─────────────────────────────────────────────────────────────────────────────
// Structured interview format — Assessment Scorecard
//
// Mock interviews are conducted and scored against a weighted, nine-parameter
// hiring scorecard modelled on a real BFSI (Banking / Financial Services /
// Insurance) interview assessment form. EVERY parameter is assessed in EVERY
// interview — the interview covers the whole scorecard, not just one area:
//
//   1. Functional Knowledge              25%  — the role-specific core
//   2. Communication Skills              15%  — judged from delivery
//   3. Problem-Solving & Analytical      12%
//   4. Adaptability & Learning Agility   10%
//   5. Ownership & Work Ethic            10%
//   6. Collaboration & Cultural Fit      10%
//   7. Personality & Disposition          8%  — judged from delivery/energy
//   8. Educational Background             5%  — covered by the opening question
//   9. IT Skills                          5%
//
// (weights sum to 1.0). Each parameter is rated 1–5, calibrated to the
// candidate's experience level. Interview LENGTH no longer removes parameters
// from the scorecard — a longer interview simply asks MORE questions (more
// breadth and depth); every parameter is still scored, inferring conservatively
// for any only lightly probed in a short interview.
//
// Communication is scored from HOW the candidate expresses every answer (tone,
// energy, clarity), so it has no dedicated question stage. Personality &
// Disposition is likewise read from delivery, but also gets a warm, one-time
// "getting to know you" opening early on (hobbies, a hobbies follow-up,
// motivation for the role, and strengths / best-fit role) to relax the candidate
// and surface motivation and role fit. Educational Background is covered by the
// opening question. The live question rotation then targets the remaining
// parameters, breadth-first, with Functional Knowledge as the recurring — but
// never dominating — core.
// ─────────────────────────────────────────────────────────────────────────────

export type CompetencyKey =
  | "domainKnowledge"
  | "communication"
  | "problemSolving"
  | "adaptability"
  | "ownership"
  | "collaboration"
  | "personality"
  | "education"
  | "itSkills";

export type CompetencyDef = {
  key: CompetencyKey;
  label: string;
  /** Scorecard weight (0–1). */
  weight: number;
  /** Minimum interview length (minutes) that unlocks this competency. 0 = always
   *  assessed (every parameter is scored in every interview). */
  minMinutes: number;
  /** What the interviewer probes / the evaluator scores for this competency. */
  focus: string;
};

/** The weighted scorecard, in display order. Weights sum to 1.0 across all nine.
 *  Every parameter is assessed in every interview (minMinutes 0). */
export const COMPETENCIES: CompetencyDef[] = [
  {
    key: "domainKnowledge",
    label: "Functional Knowledge",
    weight: 0.25,
    minMinutes: 0,
    focus:
      "role-specific functional and domain knowledge — the core of the interview (practical, product-level and concept questions a real panel would ask)",
  },
  {
    key: "communication",
    label: "Communication Skills",
    weight: 0.15,
    minMinutes: 0,
    focus:
      "communicates clearly and confidently, expresses ideas logically and in sequence, listens attentively and comprehends the question, and is competent in basic English",
  },
  {
    key: "problemSolving",
    label: "Problem-Solving & Analytical Thinking",
    weight: 0.12,
    minMinutes: 0,
    focus:
      "breaks a problem down logically, asks clarifying questions, weighs options, and arrives at sound, practical conclusions",
  },
  {
    key: "adaptability",
    label: "Adaptability & Learning Agility",
    weight: 0.1,
    minMinutes: 0,
    focus:
      "comfort with ambiguity and change, openness to working at different locations, industries and roles, willingness to pick up new tools, and how they take feedback",
  },
  {
    key: "ownership",
    label: "Ownership & Work Ethic",
    weight: 0.1,
    minMinutes: 0,
    focus:
      "takes accountability and follows through, shows integrity between words and actions, and demonstrates conviction and commitment toward accomplishing the task",
  },
  {
    key: "collaboration",
    label: "Collaboration & Cultural Fit",
    weight: 0.1,
    minMinutes: 0,
    focus:
      "works as a team player — coordinates, cooperates and collaborates with others — and aligns with organisational values and a collaborative culture",
  },
  {
    key: "personality",
    label: "Personality & Disposition",
    weight: 0.08,
    minMinutes: 0,
    focus:
      "overall disposition conveyed through the conversation — energy and enthusiasm, honesty and integrity, professional conduct, and self-awareness (assessed from vocal energy, tone and content; visual cues such as body language, eye contact and appearance are not observable in a voice interview)",
  },
  {
    key: "education",
    label: "Educational Background",
    weight: 0.05,
    minMinutes: 0,
    focus:
      "academic background and achievements, including relevant curricular and extra-curricular involvement",
  },
  {
    key: "itSkills",
    label: "IT Skills",
    weight: 0.05,
    minMinutes: 0,
    focus:
      "comfort with everyday technology — office and email applications, smartphones and handheld devices, and awareness of basic data-security practices",
  },
];

/** The competencies a given interview length covers. Every parameter is assessed
 *  in every interview (minMinutes is 0 across the board), so this returns the
 *  full scorecard; the param is kept for call-site stability. */
export function coveredCompetencies(durationMin: number): CompetencyDef[] {
  return COMPETENCIES.filter((c) => durationMin >= c.minMinutes);
}

/**
 * Total Weighted Score (1–5) over ONLY the competencies covered by this
 * interview length. Weights are renormalised across the competencies that
 * actually received a rating so the result always stays on the 1–5 scale.
 * Returns 0 if nothing was scored.
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
// Dedicated questions target the assessable parameters EXCEPT Communication and
// Personality (both judged from delivery) and Educational Background (covered by
// the opening question). Functional Knowledge is the recurring core, but it is
// deliberately interleaved with every other parameter so it never dominates and
// no two consecutive questions target the same area. The interview keeps cycling
// through this rotation until time runs out, so a longer interview naturally
// reaches more areas and probes them more deeply — while even a short interview
// spans functional knowledge, problem-solving, ownership and adaptability rather
// than drilling one topic.
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewArea = {
  key: string;
  label: string;
  /** Fully-composed guidance for what to probe — roughly one question's worth. */
  focus: string;
  /** "warmup" marks the early conversational beats (hobbies, motivation, best-fit
   *  role) that should flow naturally rather than being framed as a switch to a
   *  "different area". Standard rotation beats leave this undefined. */
  kind?: "warmup";
};

export type BeatContext = {
  durationMin: number;
  experience: string;
  /** Interview type value (e.g. "banking") for role-specific domain topics. */
  type: string;
  roleLabel: string;
};

/** Parameters that get a DEDICATED question in the RECURRING rotation, in
 *  priority order. Communication (delivery-judged) and Educational Background
 *  (the opening) are absent. Personality is absent from the recurring rotation
 *  too, but gets warm one-time hobbies beats in the opening (see areaForBeat).
 *  Motivation for the role and best-fit-role are likewise covered once there. */
const DEDICATED_AREAS: CompetencyKey[] = [
  "problemSolving",
  "ownership",
  "adaptability",
  "collaboration",
  "itSkills",
];

/** Breadth-first question rotation: the functional core recurs (never
 *  back-to-back) but does NOT dominate — the functional core is revisited only
 *  after every couple of other areas, so every assessable parameter gets its own
 *  question and the interview never becomes a single-topic drill. */
function questionRotation(): CompetencyKey[] {
  const rotation: CompetencyKey[] = ["domainKnowledge"];
  DEDICATED_AREAS.forEach((key, i) => {
    rotation.push(key);
    // Revisit the functional core after every second other area (but not right
    // at the very end), keeping functional roughly one question in three.
    if (i % 2 === 1 && i < DEDICATED_AREAS.length - 1) rotation.push("domainKnowledge");
  });
  return rotation;
}

/**
 * The competency area a given beat targets. Beat 0 is the opening introduction +
 * educational background; beats 1–4 are a one-time warm "getting to know you"
 * opening (hobbies, a hobbies follow-up, motivation for the role, and strengths /
 * best-fit role); beat 5 onward cycles through the breadth-first competency
 * rotation. The returned `focus` is fully composed (role-specific for functional
 * knowledge) so callers can use it directly.
 */
export function areaForBeat(index: number, ctx: BeatContext): InterviewArea {
  if (index <= 0) {
    return {
      key: "education",
      label: "Introduction & Educational Background",
      focus: `a brief self-introduction and their educational background relevant to the ${ctx.roleLabel} role — qualifications, key subjects or skills, and notable curricular or extra-curricular achievements`,
    };
  }
  // Beats 1–4 are a short, warm "getting to know you" opening that runs once,
  // before the competency rotation. They relax the candidate and surface real
  // signal for Personality & Disposition, motivation and role fit — none of which
  // a functional drill reveals. They are intentionally NOT part of the recurring
  // rotation, so none of them is ever asked twice:
  //   1 — hobbies & interests (ice-breaker)
  //   2 — hobbies & interests (a little deeper)
  //   3 — why this domain and this role (motivation)
  //   4 — strengths & the kind of work they'd thrive in (best-fit role)
  if (index === 1) {
    return {
      key: "personality",
      label: "Hobbies & Interests",
      kind: "warmup",
      focus:
        "a warm, light ice-breaker about the candidate's hobbies, interests or how they like to spend their time outside work or study — what they enjoy and what draws them to it. Use it to put them at ease early and to read their personality, energy and self-awareness. Keep it genuine and conversational, not a test.",
    };
  }
  if (index === 2) {
    return {
      key: "personality",
      label: "More About Their Interests",
      kind: "warmup",
      focus:
        "a natural follow-up that goes a little deeper into the hobbies or interests they just mentioned (or another one) — for example what they enjoy most about it, how they got into it, or something they have learned or achieved through it. Keep it light and curious.",
    };
  }
  if (index === 3) {
    return {
      key: "adaptability",
      label: "Motivation for the Role",
      kind: "warmup",
      focus:
        `why the candidate is interested in the ${ctx.roleLabel} field and in this particular role — what draws them to this domain, what excites them about the work, and what they hope to do or become in it. Use it to gauge genuine motivation and how well their interests align with the role.`,
    };
  }
  if (index === 4) {
    return {
      key: "adaptability",
      label: "Strengths & Best-Fit Role",
      kind: "warmup",
      focus:
        "the candidate's strongest skills and the kind of work, responsibilities or role they feel they would thrive in and enjoy most — and why. Use it to understand where their strengths and interests point, so you can gauge which job role would fit them best.",
    };
  }
  const rotation = questionRotation();
  const key = rotation[(index - 5) % rotation.length]!;
  const def = COMPETENCIES.find((c) => c.key === key)!;
  let focus = def.focus;
  if (key === "domainKnowledge") {
    focus = `${def.focus} — ${functionalKnowledgeFor(ctx.type, ctx.roleLabel)}`;
  }
  return { key, label: def.label, focus };
}
