// Shared CEFR A1→C2 English roadmap data, used by the "My Journey" page.
// (Previously lived inside English Guru; consolidated under My Journey.)

export type RoadmapStage = {
  level: string;
  label: string;
  color: string;
  weeks: string;
  dailyGoal: string;
  resources: string;
  milestone: string;
  topics: string[];
};

export const ROADMAP_STAGES: RoadmapStage[] = [
  {
    level: "A1", label: "Foundation", color: "border-slate-300 bg-slate-50 text-slate-700",
    weeks: "Weeks 1–4", dailyGoal: "15 min/day: speak 5 new sentences aloud",
    resources: "BBC Learning English, Duolingo (Hindi→English), EduBharat Live Chat",
    milestone: "Can introduce yourself and ask for basic information in a shop or office",
    topics: [
      "Greetings & apologies — used in offices, trains, markets",
      "Numbers 1–1000, dates, time — for forms, bills, schedules",
      "Simple present tense — I am, You are, He is + daily routines",
      "Family & common objects vocabulary (building 200-word core)",
      "Basic questions: What, Who, Where, When — for directions",
      "Connecting Hindi/regional words to English equivalents daily",
    ],
  },
  {
    level: "A2", label: "Elementary", color: "border-blue-300 bg-blue-50 text-blue-700",
    weeks: "Weeks 5–10", dailyGoal: "20 min/day: write one short message + speak 5 min",
    resources: "British Council Learn English, EduBharat Grammar Fix",
    milestone: "Can handle a phone call and write a short professional message",
    topics: [
      "Past tense: 'I went', 'I worked', 'I studied' — for interviews",
      "Future tense: 'I will', 'I am going to' — for planning conversations",
      "Shopping, food, travel vocabulary — marketplace to airport",
      "Short email writing: leave application, complaint, thank-you note",
      "Telephone phrases: 'May I speak to', 'Please hold', 'I am calling about'",
      "Giving and following directions clearly in English",
    ],
  },
  {
    level: "B1", label: "Intermediate", color: "border-green-300 bg-green-50 text-green-700",
    weeks: "Weeks 11–20", dailyGoal: "25 min/day: 1 mock conversation + 1 written paragraph",
    resources: "EduBharat Interview Ace, EduBharat Live Conversation",
    milestone: "Can confidently appear for a job interview and write professional emails",
    topics: [
      "All 12 tenses with real India-context examples",
      "Job interview language: 'My strength is...', STAR method answers",
      "Expressing opinions: 'I believe...', 'In my view...', 'I disagree because...'",
      "Professional email formats: request, follow-up, complaint, proposal",
      "Telephonic interview practice — common HR questions answered well",
      "Narrating work experiences as compelling stories",
    ],
  },
  {
    level: "B2", label: "Upper-Intermediate", color: "border-yellow-300 bg-yellow-50 text-yellow-700",
    weeks: "Weeks 21–32", dailyGoal: "30 min/day: mock meeting or give a 2-minute talk",
    resources: "EduBharat Interview Ace (advanced), TED Talks with subtitles",
    milestone: "Can lead a meeting, write a formal report, and present ideas confidently",
    topics: [
      "Conditionals: 'If I were', 'Had I known' — for negotiation & persuasion",
      "Idioms common in Indian offices: 'bite the bullet', 'on the fence', 'cut corners'",
      "Meeting English: agenda, minutes, action points, 'Let me circle back'",
      "Formal report writing: executive summary, recommendations, conclusion",
      "Phrasal verbs for the workplace: set up, follow through, hand over, roll out",
      "Presentations: structure, signposting language, handling Q&A",
    ],
  },
  {
    level: "C1", label: "Advanced", color: "border-orange-300 bg-orange-50 text-orange-700",
    weeks: "Weeks 33–44", dailyGoal: "35 min/day: debate a topic or write a 300-word analysis",
    resources: "Harvard Business Review, EduBharat Write Better (C1 mode), BBC News",
    milestone: "Can negotiate, present to senior stakeholders, and write technical documents",
    topics: [
      "Nuanced vocabulary: leverage vs use, facilitate vs help, distinguished vs different",
      "Persuasion & negotiation: anchoring, concession language, closing deals",
      "Public speaking: TED-style storytelling, eliminating filler words (um, basically)",
      "Academic & technical writing: abstract, methodology, discussion, references",
      "Complex reading comprehension: business press, legal documents, research papers",
      "Leadership communication: giving feedback, managing conflict, inspiring teams",
    ],
  },
  {
    level: "C2", label: "Mastery", color: "border-purple-300 bg-purple-50 text-purple-700",
    weeks: "Weeks 45–52+", dailyGoal: "40 min/day: all-English environment challenge",
    resources: "All-English environment challenge, EduBharat tutor conversations (C2 mode)",
    milestone: "Operates at near-native level in any professional or social situation",
    topics: [
      "Near-native fluency: thinking in English with zero translation delay",
      "Subtle register shifts: boardroom vs. client lunch vs. team standup",
      "Humour, irony & cultural references in global business settings",
      "Executive communication: board presentations, investor pitches",
      "Cross-cultural English: UK vs US vs Australian vs Indian nuances",
      "Mentoring others: teaching English concepts simply and clearly",
    ],
  },
];

export const LEVEL_TO_STAGE: Record<string, string> = { Beginner: "A1", Intermediate: "B1", Advanced: "C1" };

/** Map an extended englishLevel field ("Beginner (A1)", "Upper-Intermediate B2", etc.) to a UI level. */
export function mapEnglishLevel(raw: string): string {
  const l = (raw || "").toLowerCase();
  if (l.startsWith("adv") || l.includes("c1") || l.includes("c2")) return "Advanced";
  if (l.startsWith("int") || l.startsWith("upp") || l.includes("b1") || l.includes("b2")) return "Intermediate";
  return "Beginner";
}
