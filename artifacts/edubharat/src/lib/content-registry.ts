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
  // ── Home / landing hero ──────────────────────────────────────────────────
  { key: "home.hero.badge",       page: "Home", label: "Hero badge",       defaultValue: "AI-powered career platform for India" },
  {
    key: "home.hero.subtitle",
    page: "Home",
    label: "Hero subtitle",
    defaultValue: "EduBharat gives every Indian learner a personal AI mentor — for spoken English, mock interviews, and live career updates.",
    multiline: true,
  },
  { key: "home.hero.ctaPrimary",   page: "Home", label: "Primary button",   defaultValue: "Start Learning Free" },
  { key: "home.hero.ctaSecondary", page: "Home", label: "Secondary button", defaultValue: "Browse Jobs" },

  // ── Buy Credits page ─────────────────────────────────────────────────────
  { key: "credits.hero.title", page: "Buy Credits", label: "Hero title", defaultValue: "EduBharat Credits" },
  {
    key: "credits.hero.subtitle",
    page: "Buy Credits",
    label: "Hero subtitle",
    defaultValue: "1 credit = ₹1. Pay via UPI — GPay, PhonePe, Paytm, or any UPI app. Credits never expire.",
    multiline: true,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  {
    key: "footer.tagline",
    page: "Footer",
    label: "Brand tagline",
    defaultValue: "Empowering India's next generation with AI-driven learning tools for English fluency, interview preparation, and career growth.",
    multiline: true,
  },
  { key: "footer.contact.email", page: "Footer", label: "Contact email shown in footer", defaultValue: "support@edubharat.in" },

  // ── Legal pages (shared keys) ─────────────────────────────────────────────
  { key: "legal.company.name",   page: "Legal",  label: "Company name",                   defaultValue: "EduBharat" },
  { key: "legal.jurisdiction",   page: "Legal",  label: "Governing jurisdiction (courts)", defaultValue: "Mumbai, Maharashtra, India" },
  { key: "legal.contact.email",  page: "Legal",  label: "Legal / T&C contact email",      defaultValue: "support@edubharat.in" },

  // ── About Us page ─────────────────────────────────────────────────────────
  {
    key: "about.mission",
    page: "About Us",
    label: "Mission statement (hero paragraph)",
    defaultValue: "We believe every young Indian, whether from a metro city or a small town, deserves access to world-class career preparation. EduBharat makes this possible through AI.",
    multiline: true,
  },

  // ── Contact Us page ──────────────────────────────────────────────────────
  { key: "contact.email",         page: "Contact Us", label: "General support email",  defaultValue: "support@edubharat.in" },
  { key: "contact.billing.email", page: "Contact Us", label: "Billing / payment email", defaultValue: "billing@edubharat.in" },
  { key: "contact.privacy.email", page: "Contact Us", label: "Privacy / data email",   defaultValue: "privacy@edubharat.in" },
  { key: "contact.response.time", page: "Contact Us", label: "Response time shown to users", defaultValue: "2–3 business days" },
];

/** Distinct page groups, in first-seen order (for the editor's section list). */
export const CONTENT_PAGES: string[] = Array.from(new Set(CONTENT_REGISTRY.map((e) => e.page)));
