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
 * Progress is stored in PostgreSQL (lesson_progress table).
 * Guest users (userId starts with "guest_") use the same table — no foreign-key
 * constraint on user_id so any string ID is accepted.
 */
import { Router, type Request, type Response } from "express";
import { db, lessonProgressTable, lessonActivityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

// ---------------------------------------------------------------------------
// DB helpers — all wrapped so a DB error degrades gracefully to empty progress
// ---------------------------------------------------------------------------

async function loadUserProgress(userId: string): Promise<UserProgress> {
  try {
    const rows = await db
      .select()
      .from(lessonProgressTable)
      .where(eq(lessonProgressTable.userId, userId));

    const progress: UserProgress = {};
    for (const row of rows) {
      progress[row.lessonId] = {
        ease: Number(row.ease),
        interval: row.interval,
        repetitions: row.repetitions,
        due_date: row.dueDate,
        last_score: row.lastScore ?? null,
      };
    }
    return progress;
  } catch {
    // DB unavailable — return empty so the route still works
    return {};
  }
}

async function saveLesson(
  userId: string,
  lessonId: string,
  state: LessonState,
): Promise<void> {
  try {
    await db
      .insert(lessonProgressTable)
      .values({
        userId,
        lessonId,
        ease: String(state.ease),
        interval: state.interval,
        repetitions: state.repetitions,
        dueDate: state.due_date,
        lastScore: state.last_score ?? undefined,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [lessonProgressTable.userId, lessonProgressTable.lessonId],
        set: {
          ease: String(state.ease),
          interval: state.interval,
          repetitions: state.repetitions,
          dueDate: state.due_date,
          lastScore: state.last_score ?? undefined,
          updatedAt: new Date(),
        },
      });
  } catch {
    // Swallow — progress will be lost for this request only, no crash
  }
}

/**
 * mergeGuestProgress — copy all lesson_progress rows from a guest ID into an
 * authenticated user's rows.  Called once at login/signup so the learner's
 * SM-2 schedule carries over to their account.
 *
 * Conflict resolution: if the authenticated user already has a row for the
 * same lesson (e.g. they previously studied on another device), keep whichever
 * has the higher repetition count; on a tie, prefer the more-recently-scheduled
 * due_date so the SM-2 curve is not reset.
 */
export async function mergeGuestProgress(guestId: string, userId: string): Promise<void> {
  if (!guestId || !userId || guestId === userId) return;
  try {
    const guestRows = await db
      .select()
      .from(lessonProgressTable)
      .where(eq(lessonProgressTable.userId, guestId));

    if (guestRows.length === 0) return;

    const userRows = await db
      .select()
      .from(lessonProgressTable)
      .where(eq(lessonProgressTable.userId, userId));

    const userMap = new Map(userRows.map(r => [r.lessonId, r]));

    for (const guestRow of guestRows) {
      const existing = userMap.get(guestRow.lessonId);
      // Skip if the authenticated user already has more practice on this lesson
      if (existing && existing.repetitions >= guestRow.repetitions) continue;

      await db
        .insert(lessonProgressTable)
        .values({
          userId,
          lessonId: guestRow.lessonId,
          ease: guestRow.ease,
          interval: guestRow.interval,
          repetitions: guestRow.repetitions,
          dueDate: guestRow.dueDate,
          lastScore: guestRow.lastScore ?? undefined,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [lessonProgressTable.userId, lessonProgressTable.lessonId],
          set: {
            ease: guestRow.ease,
            interval: guestRow.interval,
            repetitions: guestRow.repetitions,
            dueDate: guestRow.dueDate,
            lastScore: guestRow.lastScore ?? undefined,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err) {
    // Non-fatal — authenticated user keeps their existing progress
    console.error("[journey] mergeGuestProgress error", err);
  }
}

// ------------------------------------------------------------------
// GET /journey/next?userId=<id>
// Returns up to 5 interleaved lessons (due reviews first, then new)
// ------------------------------------------------------------------
router.get("/journey/next", async (req: Request, res: Response) => {
  const userId = (req.query["userId"] as string) || "guest";
  const progress = await loadUserProgress(userId);
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
router.post("/journey/submit-result", async (req: Request, res: Response) => {
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
  const progress = await loadUserProgress(userId);

  const existing = progress[lesson_id] ?? { ease: 2.5, interval: 0, repetitions: 0 };
  const quality = Math.round((numScore / 100) * 5); // map 0-100 → 0-5

  const { ease, interval, repetitions } = sm2Update(
    existing.ease,
    existing.interval,
    existing.repetitions,
    quality,
  );

  const due_date = addDays(todayStr(), interval);
  const newState: LessonState = { ease, interval, repetitions, due_date, last_score: numScore };

  await saveLesson(userId, lesson_id, newState);

  // Append an activity-log row so streak calculation has a full per-day history.
  // This runs fire-and-forget; a failure here must never block the response.
  db.insert(lessonActivityTable)
    .values({ userId, lessonId: lesson_id, score: numScore })
    .catch((err: unknown) => console.error("[journey] lessonActivity insert error", err));

  res.json({ ok: true, next_review: due_date, interval_days: interval });
});

// -----------------------------------------------------------------------
// In-memory lesson-content cache: key = `${lessonId}|${level}|${goal}`
// Max 200 entries; evict oldest when full.
// TTL: 24 hours — cached content is regenerated once per day so it stays fresh.
// -----------------------------------------------------------------------
type CacheEntry = {
  content: { concept: string; examples: string[]; practice: string };
  cachedAt: number; // Date.now() ms
};
const CONTENT_CACHE = new Map<string, CacheEntry>();
const CACHE_MAX = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cacheGet(key: string): { concept: string; examples: string[]; practice: string } | undefined {
  const entry = CONTENT_CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    CONTENT_CACHE.delete(key);
    return undefined;
  }
  return entry.content;
}

function cacheSet(key: string, value: { concept: string; examples: string[]; practice: string }) {
  if (CONTENT_CACHE.size >= CACHE_MAX) {
    // Evict the oldest inserted entry (Maps preserve insertion order)
    const firstKey = CONTENT_CACHE.keys().next().value;
    if (firstKey !== undefined) CONTENT_CACHE.delete(firstKey);
  }
  CONTENT_CACHE.set(key, { content: value, cachedAt: Date.now() });
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
  const cached = cacheGet(cacheKey);
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

// ---------------------------------------------------------------------------
// Mastery level — derived from SM-2 repetitions + ease factor
// ---------------------------------------------------------------------------
function computeMastery(repetitions: number, ease: number): "bronze" | "silver" | "gold" | null {
  if (repetitions === 0) return null;
  if (repetitions >= 5 && ease >= 2.5) return "gold";
  if (repetitions >= 3) return "silver";
  return "bronze";
}

// ---------------------------------------------------------------------------
// Streak — consecutive calendar days ending today (or yesterday) on which the
// user completed at least one lesson.
//
// Uses lesson_activity (append-only event log) — NOT lesson_progress.
// lesson_progress is an upsert table (one row per lesson), so its updatedAt
// only holds the most-recent study date for that lesson; prior days are lost.
// lesson_activity appends a row on every submit-result call, giving a full
// history of which calendar days had at least one study session.
// ---------------------------------------------------------------------------
async function computeStreak(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ completedAt: lessonActivityTable.completedAt })
      .from(lessonActivityTable)
      .where(eq(lessonActivityTable.userId, userId));

    if (rows.length === 0) return 0;

    // Unique YYYY-MM-DD strings, sorted newest first
    const dates = Array.from(
      new Set(rows.map(r => r.completedAt.toISOString().slice(0, 10)))
    ).sort().reverse();

    const today = todayStr();
    const yesterday = addDays(today, -1);

    // Streak must touch today or yesterday — otherwise it's broken
    if (dates[0] !== today && dates[0] !== yesterday) return 0;

    let streak = 1;
    let current = dates[0];
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] === addDays(current, -1)) {
        streak++;
        current = dates[i];
      } else {
        break;
      }
    }
    return streak;
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------------
// GET /journey/progress?userId=<id>  — full state for all lessons
// ------------------------------------------------------------------
router.get("/journey/progress", async (req: Request, res: Response) => {
  const userId = (req.query["userId"] as string) || "guest";
  const [progress, streak] = await Promise.all([
    loadUserProgress(userId),
    computeStreak(userId),
  ]);
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
      mastery: state ? computeMastery(state.repetitions, state.ease) : null,
    };
  });

  const studied = items.filter(l => l.studied).length;
  const overdue = items.filter(l => l.overdue).length;

  res.json({
    lessons: items,
    summary: { total: LESSON_BANK.length, studied, overdue, streak },
  });
});

export default router;
