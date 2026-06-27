import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, learningProgressTable, interviewSessionsTable } from "@workspace/db";
import { eq, count, avg, desc, sum, sql } from "drizzle-orm";

export const router: IRouter = Router();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// GET /api/profile — returns full user profile
router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = users[0]!;
    // Parse skills JSON safely
    let skills: string[] = [];
    if (user.skills) {
      try { skills = JSON.parse(user.skills) as string[]; } catch { skills = []; }
    }

    res.json({ profile: { ...user, skills } });
  } catch (err) {
    req.log.error({ err }, "Profile fetch error");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/profile — update profile fields
router.put("/profile", requireAuth, async (req: Request, res: Response) => {
  const {
    name, gender, degree, branch, graduationYear, university,
    skills, careerGoal, preferredRole, industryPreference,
    preferredCity, location, expectedSalary, experienceLevel,
    englishLevel, preferredLanguage, voiceGender, voiceStyle,
    preferredInterviewer, preferredTutor, resumeAnalysis, experienceSummary,
  } = req.body as Record<string, unknown>;

  const patch: Partial<typeof usersTable.$inferInsert> = {};

  if (typeof name === "string") patch.name = name.trim();
  if (typeof gender === "string") patch.gender = gender;
  if (typeof degree === "string") patch.degree = degree;
  if (typeof branch === "string") patch.branch = branch;
  if (typeof graduationYear === "string") patch.graduationYear = graduationYear;
  if (typeof university === "string") patch.university = university;
  if (Array.isArray(skills)) patch.skills = JSON.stringify(skills);
  if (typeof skills === "string") patch.skills = skills;
  if (typeof careerGoal === "string") patch.careerGoal = careerGoal;
  if (typeof preferredRole === "string") patch.preferredRole = preferredRole;
  if (typeof industryPreference === "string") patch.industryPreference = industryPreference;
  if (typeof preferredCity === "string") patch.preferredCity = preferredCity;
  if (typeof location === "string") patch.location = location;
  if (typeof expectedSalary === "string") patch.expectedSalary = expectedSalary;
  if (typeof experienceLevel === "string") patch.experienceLevel = experienceLevel;
  if (typeof englishLevel === "string") patch.englishLevel = englishLevel;
  if (typeof preferredLanguage === "string") patch.preferredLanguage = preferredLanguage;
  if (typeof voiceGender === "string") patch.voiceGender = voiceGender;
  if (typeof voiceStyle === "string") patch.voiceStyle = voiceStyle;
  if (typeof preferredInterviewer === "string") patch.preferredInterviewer = preferredInterviewer;
  if (typeof preferredTutor === "string") patch.preferredTutor = preferredTutor;
  if (typeof resumeAnalysis === "string") patch.resumeAnalysis = resumeAnalysis;
  if (typeof resumeAnalysis === "object" && resumeAnalysis !== null) patch.resumeAnalysis = JSON.stringify(resumeAnalysis);
  if (typeof experienceSummary === "string") patch.experienceSummary = experienceSummary;

  patch.updatedAt = new Date();

  try {
    const updated = await db
      .update(usersTable)
      .set(patch)
      .where(eq(usersTable.id, req.session.userId!))
      .returning();

    const user = updated[0]!;
    let parsedSkills: string[] = [];
    if (user.skills) {
      try { parsedSkills = JSON.parse(user.skills) as string[]; } catch { parsedSkills = []; }
    }

    res.json({ profile: { ...user, skills: parsedSkills } });
  } catch (err) {
    req.log.error({ err }, "Profile update error");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/profile/stats — aggregated activity counts
router.get("/profile/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    const [learnCount, interviewCount, avgScore] = await Promise.all([
      db.select({ count: count() }).from(learningProgressTable).where(eq(learningProgressTable.userId, userId)),
      db.select({ count: count() }).from(interviewSessionsTable).where(eq(interviewSessionsTable.userId, userId)),
      db.select({ avg: avg(interviewSessionsTable.overallScore) })
        .from(interviewSessionsTable)
        .where(eq(interviewSessionsTable.userId, userId)),
    ]);

    const totalLearning = Number(learnCount[0]?.count ?? 0);
    const totalInterviews = Number(interviewCount[0]?.count ?? 0);
    const averageScore = avgScore[0]?.avg ? Math.round(Number(avgScore[0].avg)) : 0;

    // Compute streak from learning sessions
    const recentSessions = await db
      .select({ createdAt: learningProgressTable.createdAt })
      .from(learningProgressTable)
      .where(eq(learningProgressTable.userId, userId))
      .orderBy(desc(learningProgressTable.createdAt))
      .limit(60);

    const uniqueDates = [...new Set(
      recentSessions.map(s => s.createdAt.toISOString().slice(0, 10))
    )].sort().reverse();

    let streak = 0;
    const now = new Date();
    for (const dateStr of uniqueDates) {
      const diff = Math.round((now.getTime() - new Date(dateStr + "T00:00:00Z").getTime()) / 86400000);
      if (diff === streak) streak++;
      else break;
    }

    res.json({ totalLearning, totalInterviews, averageScore, streak });
  } catch (err) {
    req.log.error({ err }, "Profile stats error");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/profile/analytics — richer real analytics for progress dashboard
router.get("/profile/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;

    // 1. Total duration by tool
    const [learningDuration] = await db
      .select({ total: sum(learningProgressTable.duration) })
      .from(learningProgressTable)
      .where(eq(learningProgressTable.userId, userId));
    const [interviewDuration] = await db
      .select({ total: sum(interviewSessionsTable.durationSeconds) })
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, userId));

    const durationByTool = {
      "English Guru": Math.round(Number(learningDuration?.total ?? 0)),
      "Interview Ace": Math.round(Number(interviewDuration?.total ?? 0)),
      "Rozgar Samachar": 0, // Rozgar currently does not store duration
    };

    // 2. Interview skill averages (0-100)
    const [skillAvgs] = await db
      .select({
        communication: avg(interviewSessionsTable.communicationScore),
        grammar: avg(interviewSessionsTable.grammarScore),
        confidence: avg(interviewSessionsTable.confidenceScore),
        technical: avg(interviewSessionsTable.technicalScore),
      })
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, userId));

    const interviewSkillAverages = {
      communication: skillAvgs?.communication ? Math.round(Number(skillAvgs.communication)) : 0,
      grammar: skillAvgs?.grammar ? Math.round(Number(skillAvgs.grammar)) : 0,
      confidence: skillAvgs?.confidence ? Math.round(Number(skillAvgs.confidence)) : 0,
      technical: skillAvgs?.technical ? Math.round(Number(skillAvgs.technical)) : 0,
    };

    const [overallScore] = await db
      .select({ avg: avg(interviewSessionsTable.overallScore) })
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, userId));
    const averageScore = overallScore?.avg ? Math.round(Number(overallScore.avg)) : 0;

    // 3. Learning activity breakdown by activityType
    const learningBreakdown = await db
      .select({ activityType: learningProgressTable.activityType, count: count() })
      .from(learningProgressTable)
      .where(eq(learningProgressTable.userId, userId))
      .groupBy(learningProgressTable.activityType);

    // 4. Weekly activity (last 7 days) — counts + duration
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const recentLearning = await db
      .select({ createdAt: learningProgressTable.createdAt, duration: learningProgressTable.duration })
      .from(learningProgressTable)
      .where(
        sql`${learningProgressTable.userId} = ${userId} AND ${learningProgressTable.createdAt} >= ${new Date(Date.now() - 7 * 86400000).toISOString()}`
      );
    const recentInterviews = await db
      .select({ createdAt: interviewSessionsTable.createdAt, durationSeconds: interviewSessionsTable.durationSeconds })
      .from(interviewSessionsTable)
      .where(
        sql`${interviewSessionsTable.userId} = ${userId} AND ${interviewSessionsTable.createdAt} >= ${new Date(Date.now() - 7 * 86400000).toISOString()}`
      );

    const weeklyActivity = last7Days.map(date => {
      const learnCount = recentLearning.filter(s => s.createdAt.toISOString().slice(0, 10) === date).length;
      const learnSeconds = recentLearning
        .filter(s => s.createdAt.toISOString().slice(0, 10) === date)
        .reduce((a, s) => a + (s.duration ?? 0), 0);
      const interviewCount = recentInterviews.filter(s => s.createdAt.toISOString().slice(0, 10) === date).length;
      const interviewSeconds = recentInterviews
        .filter(s => s.createdAt.toISOString().slice(0, 10) === date)
        .reduce((a, s) => a + (s.durationSeconds ?? 0), 0);
      return {
        date,
        label: new Date(date + "T00:00").toLocaleDateString("en-IN", { weekday: "short" }),
        learningCount: learnCount,
        interviewCount: interviewCount,
        totalDurationSeconds: learnSeconds + interviewSeconds,
      };
    });

    // 5. Most recent interview session (with feedback summary)
    const recentInterviewRows = await db
      .select()
      .from(interviewSessionsTable)
      .where(eq(interviewSessionsTable.userId, userId))
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(1);

    let recentInterview: Record<string, unknown> | null = null;
    if (recentInterviewRows.length) {
      const row = recentInterviewRows[0]!;
      let feedback: Record<string, unknown> | null = null;
      try { feedback = row.feedbackJson ? (JSON.parse(row.feedbackJson) as Record<string, unknown>) : null; } catch { /* ignore */ }
      recentInterview = {
        id: row.id,
        role: row.role,
        interviewType: row.interviewType,
        overallScore: row.overallScore,
        completedAt: row.completedAt?.toISOString(),
        strengths: Array.isArray(feedback?.["strengths"]) ? feedback["strengths"] : [],
        improvements: Array.isArray(feedback?.["improvements"]) ? feedback["improvements"] : [],
      };
    }

    // 6. Career goal / role-fit readiness estimate
    const [userRow] = await db
      .select({ preferredRole: usersTable.preferredRole, careerGoal: usersTable.careerGoal })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const goalTitle = userRow?.preferredRole || userRow?.careerGoal || "Your target role";
    const readiness = interviewSkillAverages.technical > 0
      ? Math.round((interviewSkillAverages.communication + interviewSkillAverages.technical + (averageScore || 0)) / 3)
      : averageScore || 0;

    res.json({
      durationByTool,
      interviewSkillAverages,
      learningBreakdown: learningBreakdown.map(r => ({ activityType: r.activityType, count: Number(r.count) })),
      weeklyActivity,
      recentInterview,
      goal: { title: goalTitle, readiness: Math.min(100, readiness) },
    });
  } catch (err) {
    req.log.error({ err }, "Profile analytics error");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export default router;
