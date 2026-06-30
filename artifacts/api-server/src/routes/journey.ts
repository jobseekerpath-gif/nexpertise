/**
 * /api/journey/next          — next lessons via SM-2 spaced repetition + interleaving
 * /api/journey/submit-result — record a lesson score; updates SM-2 state
 *
 * SM-2 algorithm (same family Anki uses, grounded in Ebbinghaus forgetting-curve
 * research) decides WHEN a lesson comes back for review.
 *
 * Interleaving (Rohrer & Taylor research) mixes skill types so the same skill
 * never repeats back-to-back in the queue.
 *
 * State is stored in memory keyed by userId.
 * Swap PROGRESS for a real DB table once authentication is fully wired:
 *   (user_id, lesson_id) → { ease, interval, repetitions, due_date, last_score }
 */
import { Router, type Request, type Response } from "express";
import { generateTextWithFallback } from "./ai";

const router = Router();

type Lesson = {
  id: string;
  title: string;
  skill_type: "vocabulary" | "grammar" | "listening" | "speaking" | "reading";
  description: string;
};

type LessonState = {
  ease: number;
  interval: number;
  repetitions: number;
  due_date: string;        // ISO date string "YYYY-MM-DD"
  last_score: number | null;
};

type UserProgress = Record<string, LessonState>;

// In-memory store — replace with DB query (user_id, lesson_id) table
const PROGRESS = new Map<string, UserProgress>();

const LESSON_BANK: Lesson[] = [
  { id: "l1",  title: "Greetings & Introductions",         skill_type: "vocabulary", description: "Common phrases for meeting people at work, shops, and trains." },
  { id: "l2",  title: "Present Simple Tense",              skill_type: "grammar",    description: "I am, You are, He is — daily routines and facts." },
  { id: "l3",  title: "Listening: Ordering at a Shop",     skill_type: "listening",  description: "Understand and respond to a shopkeeper in English." },
  { id: "l4",  title: "Speaking: Describe Your Day",       skill_type: "speaking",   description: "Talk about your morning routine in 4–5 sentences." },
  { id: "l5",  title: "Workplace Vocabulary",              skill_type: "vocabulary", description: "200-word core set for offices, factories, and markets." },
  { id: "l6",  title: "Past Simple Tense",                 skill_type: "grammar",    description: "What happened yesterday — regular and irregular verbs." },
  { id: "l7",  title: "Listening: A Job Interview",        skill_type: "listening",  description: "Hear and understand common HR interview questions." },
  { id: "l8",  title: "Speaking: Answer Interview Questions", skill_type: "speaking", description: "Practise 'Tell me about yourself' and 3 common follow-ups." },
  { id: "l9",  title: "Numbers, Dates & Times",            skill_type: "vocabulary", description: "Dates for forms, bills, and schedules in English." },
  { id: "l10", title: "Question Words",                    skill_type: "grammar",    description: "What, Who, Where, When, Why — asking for directions & help." },
  { id: "l11", title: "Reading: A Job Advertisement",      skill_type: "reading",    description: "Extract key information from a real job posting." },
  { id: "l12", title: "Speaking: Phone & Video Calls",     skill_type: "speaking",   description: "Opening, holding, and closing a professional call." },
];

const LESSON_IDS = new Set(LESSON_BANK.map(l => l.id));

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * SM-2 update.
 * quality: 0-5  (0 = complete blank, 5 = perfect instant recall)
 */
function sm2Update(
  ease: number,
  interval: number,
  repetitions: number,
  quality: number,
): { ease: number; interval: number; repetitions: number } {
  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    if (repetitions === 0)      newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else                         newInterval = Math.round(interval * ease);
    newReps = repetitions + 1;
  }

  const newEase = Math.max(
    1.3,
    ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  return { ease: newEase, interval: newInterval, repetitions: newReps };
}

function getUserProgress(userId: string): UserProgress {
  if (!PROGRESS.has(userId)) PROGRESS.set(userId, {});
  return PROGRESS.get(userId)!;
}

// ------------------------------------------------------------------
// GET /journey/next?userId=<id>
// Returns up to 5 interleaved lessons (due reviews first, then new)
// ------------------------------------------------------------------
router.get("/journey/next", (req: Request, res: Response) => {
  const userId = (req.query["userId"] as string) || "guest";
  const progress = getUserProgress(userId);
  const today = todayStr();

  const due: Lesson[] = [];
  const newLessons: Lesson[] = [];

  for (const lesson of LESSON_BANK) {
    const state = progress[lesson.id];
    if (!state) {
      newLessons.push(lesson);
    } else if (state.due_date <= today) {
      due.push(lesson);
    }
  }

  /**
   * Priority contract: due reviews ALWAYS come before new lessons.
   * Interleaving is applied within each group independently, then the
   * groups are concatenated — so no new lesson can appear while any
   * due review is still available.
   */
  function interleaveBySkillType(lessons: Lesson[]): Lesson[] {
    const byType = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      const bucket = byType.get(lesson.skill_type) ?? [];
      bucket.push(lesson);
      byType.set(lesson.skill_type, bucket);
    }
    const result: Lesson[] = [];
    while ([...byType.values()].some(b => b.length > 0)) {
      for (const [type, bucket] of byType) {
        if (bucket.length > 0) result.push(bucket.shift()!);
        if (byType.get(type)?.length === 0) byType.delete(type);
      }
    }
    return result;
  }

  // Interleave due reviews first, then fill remaining slots with new lessons
  const interleavedDue = interleaveBySkillType(due);
  const interleavedNew = interleaveBySkillType(newLessons);
  const interleaved = [...interleavedDue, ...interleavedNew];

  const result = interleaved.slice(0, 5).map(lesson => {
    const state = progress[lesson.id];
    return {
      ...lesson,
      status: state ? "due for review" : "new lesson",
      last_score: state?.last_score ?? null,
      next_review: state?.due_date ?? null,
    };
  });

  res.json({ lessons: result, total_due: due.length, total_new: newLessons.length });
});

// ------------------------------------------------------------------
// POST /journey/submit-result
// Body: { lesson_id, score (0–100), userId? }
// ------------------------------------------------------------------
router.post("/journey/submit-result", (req: Request, res: Response) => {
  const { lesson_id, score, userId = "guest" } = (req.body ?? {}) as {
    lesson_id?: string;
    score?: number;
    userId?: string;
  };

  if (!lesson_id || !LESSON_IDS.has(lesson_id)) {
    res.status(400).json({ error: "Unknown lesson_id" });
    return;
  }

  const numScore = Math.min(100, Math.max(0, Number(score ?? 0)));
  const progress = getUserProgress(userId);

  const existing = progress[lesson_id] ?? { ease: 2.5, interval: 0, repetitions: 0 };
  const quality = Math.round((numScore / 100) * 5); // map 0-100 → 0-5

  const { ease, interval, repetitions } = sm2Update(
    existing.ease,
    existing.interval,
    existing.repetitions,
    quality,
  );

  const due_date = addDays(todayStr(), interval);

  progress[lesson_id] = { ease, interval, repetitions, due_date, last_score: numScore };

  res.json({ ok: true, next_review: due_date, interval_days: interval });
});

// -----------------------------------------------------------------------
// In-memory lesson-content cache: key = `${lessonId}|${level}|${goal}`
// Max 200 entries; evict oldest when full to prevent unbounded growth.
// -----------------------------------------------------------------------
const CONTENT_CACHE = new Map<string, { concept: string; examples: string[]; practice: string }>();
const CACHE_MAX = 200;
function cacheSet(key: string, value: { concept: string; examples: string[]; practice: string }) {
  if (CONTENT_CACHE.size >= CACHE_MAX) {
    // Evict the oldest inserted entry (Maps preserve insertion order)
    const firstKey = CONTENT_CACHE.keys().next().value;
    if (firstKey !== undefined) CONTENT_CACHE.delete(firstKey);
  }
  CONTENT_CACHE.set(key, value);
}

// ------------------------------------------------------------------
// GET /journey/lesson-content/:lessonId — AI-generated lesson content
// ------------------------------------------------------------------
router.get("/journey/lesson-content/:lessonId", async (req: Request, res: Response) => {
  const { lessonId } = req.params as { lessonId: string };
  const lesson = LESSON_BANK.find(l => l.id === lessonId);
  if (!lesson) { res.status(404).json({ error: "Lesson not found" }); return; }

  const level = (req.query["level"] as string) || "Beginner";
  const goal = (req.query["goal"] as string) || "Private Job";
  const nativeLang = (req.query["nativeLang"] as string) || "Hindi";
  const name = (req.query["name"] as string) || "";
  const skills = (req.query["skills"] as string) || "";

  const cacheKey = `${lessonId}|${level}|${goal}|${nativeLang}`;
  const cached = CONTENT_CACHE.get(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const profileCtx = [
      name && `Name: ${name}`,
      `English level: ${level}`,
      `Career goal: ${goal}`,
      `Native language: ${nativeLang}`,
      skills && `Skills: ${skills}`,
    ].filter(Boolean).join(" | ");

    const raw = await generateTextWithFallback({
      prompt: `You are a warm, practical English teacher for Indian job-seekers.

Lesson: "${lesson.title}"
Skill: ${lesson.skill_type}
Description: ${lesson.description}
Student: ${profileCtx}

Create lesson content tailored to this student. Return ONLY valid JSON with these exact keys:
{
  "concept": "2–3 plain sentences explaining the core idea. Use Indian contexts — office, shop, phone call, interview. No jargon.",
  "examples": [
    "Example 1 with context label in brackets",
    "Example 2 — different scenario",
    "Example 3 — career/job relevant"
  ],
  "practice": "One specific task the student can do right now in 30–60 seconds. Tie it to ${goal}."
}`,
      maxTokens: 450,
      log: req.log,
    });

    // Strip accidental markdown fences
    const clean = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const content = JSON.parse(clean) as { concept: string; examples: string[]; practice: string };
    cacheSet(cacheKey, content);
    res.json(content);
  } catch (err) {
    req.log.error({ err }, "Lesson content AI error");
    res.status(500).json({ error: "Could not generate lesson content" });
  }
});

// ------------------------------------------------------------------
// GET /journey/progress?userId=<id>  — full state for all lessons
// ------------------------------------------------------------------
router.get("/journey/progress", (req: Request, res: Response) => {
  const userId = (req.query["userId"] as string) || "guest";
  const progress = getUserProgress(userId);
  const today = todayStr();

  const items = LESSON_BANK.map(lesson => {
    const state = progress[lesson.id];
    return {
      ...lesson,
      studied: Boolean(state),
      last_score: state?.last_score ?? null,
      due_date: state?.due_date ?? null,
      overdue: state ? state.due_date <= today : false,
      repetitions: state?.repetitions ?? 0,
    };
  });

  const studied = items.filter(l => l.studied).length;
  const overdue = items.filter(l => l.overdue).length;

  res.json({ lessons: items, summary: { total: LESSON_BANK.length, studied, overdue } });
});

export default router;
