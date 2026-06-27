import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, learningProgressTable, interviewSessionsTable } from "@workspace/db";
import { eq, count, avg, desc } from "drizzle-orm";

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
    preferredInterviewer, preferredTutor,
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

export default router;
