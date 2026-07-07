// ── Editable content registry ────────────────────────────────────────────────
// Central list of text strings that admins can override from the CMS editor.
//
// IMPORTANT: pages read their text with `useContent(key, fallbackDefault)`, and
// the inline fallback is the real source of truth for display. This registry is
// what the ADMIN EDITOR uses to discover which keys exist, their labels, page
// grouping, and default text. Keep each `defaultValue` in sync with the inline
// fallback used on the page. Adding a page's strings here is a mechanical,
// parallelisable step — new keys can be appended without touching existing ones.

export type ContentEntry = {
  key: string;
  page: string;
  label: string;
  defaultValue: string;
  multiline?: boolean;
};

export const CONTENT_REGISTRY: ContentEntry[] = [
  // Home / landing hero
  { key: "home.hero.badge", page: "Home", label: "Hero badge", defaultValue: "AI-powered career platform for India" },
  {
    key: "home.hero.subtitle",
    page: "Home",
    label: "Hero subtitle",
    defaultValue:
      "EduBharat gives every Indian learner a personal AI mentor — for spoken English, mock interviews, and live career updates.",
    multiline: true,
  },
  { key: "home.hero.ctaPrimary", page: "Home", label: "Primary button", defaultValue: "Start Learning Free" },
  { key: "home.hero.ctaSecondary", page: "Home", label: "Secondary button", defaultValue: "Browse Jobs" },

  // Buy Credits hero
  { key: "credits.hero.title", page: "Buy Credits", label: "Hero title", defaultValue: "EduBharat Credits" },
  {
    key: "credits.hero.subtitle",
    page: "Buy Credits",
    label: "Hero subtitle",
    defaultValue: "1 credit = ₹1. Pay via UPI — GPay, PhonePe, Paytm, or any UPI app. Credits never expire.",
    multiline: true,
  },
];

/** Distinct page groups, in first-seen order (for the editor's section list). */
export const CONTENT_PAGES: string[] = Array.from(new Set(CONTENT_REGISTRY.map((e) => e.page)));
