// ─────────────────────────────────────────────────────────────────────────────
// Structured interview format
//
// Mock interviews follow a FIXED, ordered set of assessment areas modelled on a
// standard HR competency-assessment sheet (Functional Knowledge, Communication,
// Collaboration, Personality/disposition, Educational Background, IT skills,
// Adaptability). The AI must move through these stages in order and stay on the
// current one — it must NOT wander between topics.
//
// Communication skills, overall personality/disposition and integrity are judged
// from HOW the candidate answers throughout, so they are not separate question
// stages; they are scored in the final report instead.
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewStage = {
  key: string;
  label: string;
  /** What the interviewer should probe while in this stage. */
  focus: string;
  /** Progress fraction (0-1) of the questioning window at which this stage ENDS. */
  until: number;
};

/**
 * The fixed interview agenda, in order. `until` values are cumulative fractions
 * of the questioning window (not wall-clock), so the same structure scales to a
 * 10-, 15- or 25-minute interview. Functional/domain knowledge deliberately gets
 * the largest slice — it is the core of the interview.
 */
export const INTERVIEW_STAGES: InterviewStage[] = [
  {
    key: "background",
    label: "Introduction & Educational Background",
    focus:
      "a brief self-introduction and the candidate's educational background — degree, key subjects, and any notable curricular or extra-curricular achievements relevant to this role",
    until: 0.15,
  },
  {
    key: "functional",
    label: "Functional / Domain Knowledge",
    focus:
      "role-specific functional and domain knowledge (this is the core of the interview)",
    until: 0.55,
  },
  {
    key: "collaboration",
    label: "Collaboration & Teamwork",
    focus:
      "how the candidate works within a team — coordination, cooperation, handling disagreement, and a concrete example of collaborating to reach a shared goal",
    until: 0.7,
  },
  {
    key: "it_skills",
    label: "IT & Digital Skills",
    focus:
      "comfort with office and email applications and smartphones/handheld devices, and awareness of basic data-security and confidentiality practices",
    until: 0.82,
  },
  {
    key: "adaptability",
    label: "Adaptability & Flexibility",
    focus:
      "openness to working at different locations, across different industries or roles, and how the candidate copes with change",
    until: 0.92,
  },
  {
    key: "motivation",
    label: "Motivation, Commitment & Closing",
    focus:
      "the candidate's motivation for this role, their commitment and reliability, career goals, and finally whether they have any questions",
    until: 1.01,
  },
];

/** Index of the current stage for a questioning-window progress fraction (0-1). */
export function stageIndexForProgress(progress: number): number {
  const p = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const idx = INTERVIEW_STAGES.findIndex((s) => p < s.until);
  return idx === -1 ? INTERVIEW_STAGES.length - 1 : idx;
}

/** Pick the current stage from questioning-window progress (0-1). */
export function stageForProgress(progress: number): InterviewStage {
  return INTERVIEW_STAGES[stageIndexForProgress(progress)]!;
}

/**
 * Role-specific functional-knowledge focus. Banking and Insurance mirror the
 * sample assessment format exactly; every other role applies the same idea with
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
