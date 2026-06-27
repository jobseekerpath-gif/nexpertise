import { Router, type IRouter, type Request, type Response } from "express";
import { db, learningProgressTable, interviewSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "./profile.js";

const router: IRouter = Router();

// POST /api/sessions/learning — log a completed English Guru session
router.post("/sessions/learning", requireAuth, async (req: Request, res: Response) => {
  const { tool, activityType, mode, tutorId, score, duration, data } = req.body as {
    tool?: string;
    activityType?: string;
    mode?: string;
    tutorId?: string;
    score?: number;
    duration?: number;
    data?: string;
  };

  if (!tool || !activityType) {
    res.status(400).json({ error: "tool and activityType required" });
    return;
  }

  try {
    const inserted = await db
      .insert(learningProgressTable)
      .values({
        userId: req.session.userId!,
        tool,
        activityType,
        mode: mode ?? null,
        tutorId: tutorId ?? null,
        score: score ?? null,
        duration: duration ?? null,
        data: data ?? null,
      })
      .returning();

    res.json({ session: inserted[0] });
  } catch (err) {
    req.log.error({ err }, "Learning session insert error");
    res.status(500).json({ error: "Failed to save session" });
  }
});

// GET /api/sessions/learning — paginated learning history
router.get("/sessions/learning", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const sessions = await db
      .select()
      .from(learningProgressTable)
      .where(eq(learningProgressTable.userId, req.session.userId!))
      .orderBy(desc(learningProgressTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ sessions });
  } catch (err) {
    req.log.error({ err }, "Learning sessions fetch error");
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// POST /api/sessions/interview — log a completed interview
router.post("/sessions/interview", requireAuth, async (req: Request, res: Response) => {
  const {
    role, experienceLevel, interviewType, questionsData,
    overallScore, durationSeconds, feedbackJson,
    communicationScore, grammarScore, confidenceScore, technicalScore,
  } = req.body as {
    role?: string;
    experienceLevel?: string;
    interviewType?: string;
    questionsData?: string;
    overallScore?: number;
    durationSeconds?: number;
    feedbackJson?: string;
    communicationScore?: number;
    grammarScore?: number;
    confidenceScore?: number;
    technicalScore?: number;
  };

  if (!role || !experienceLevel) {
    res.status(400).json({ error: "role and experienceLevel required" });
    return;
  }

  try {
    const inserted = await db
      .insert(interviewSessionsTable)
      .values({
        userId: req.session.userId!,
        role,
        experienceLevel,
        interviewType: interviewType ?? null,
        questionsData: questionsData ?? null,
        overallScore: overallScore ?? null,
        durationSeconds: durationSeconds ?? null,
        feedbackJson: feedbackJson ?? null,
        communicationScore: communicationScore ?? null,
        grammarScore: grammarScore ?? null,
        confidenceScore: confidenceScore ?? null,
        technicalScore: technicalScore ?? null,
        completedAt: new Date(),
      })
      .returning();

    res.json({ session: inserted[0] });
  } catch (err) {
    req.log.error({ err }, "Interview session insert error");
    res.status(500).json({ error: "Failed to save interview" });
  }
});

// GET /api/sessions/interview — paginated interview history
router.get("/sessions/interview", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const sessions = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, req.session.userId!))
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ sessions });
  } catch (err) {
    req.log.error({ err }, "Interview sessions fetch error");
    res.status(500).json({ error: "Failed to fetch interviews" });
  }
});

export default router;
