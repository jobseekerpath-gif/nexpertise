import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, upiPaymentsTable, creditTransactionsTable, interviewSessionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "../lib/guards.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

/** Parse the numeric :id route param (normalises the string | string[] param type). */
function idParam(req: Request): number {
  const raw = req.params.id;
  return parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
}

// Directory projection — registration details + IP/location + balance, but not
// the heavy resume blobs (those load in the per-user detail view on demand).
const userDirectoryColumns = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  picture: usersTable.picture,
  authProvider: usersTable.authProvider,
  preferredLanguage: usersTable.preferredLanguage,
  age: usersTable.age,
  education: usersTable.education,
  careerGoal: usersTable.careerGoal,
  location: usersTable.location,
  industryPreference: usersTable.industryPreference,
  gender: usersTable.gender,
  degree: usersTable.degree,
  branch: usersTable.branch,
  graduationYear: usersTable.graduationYear,
  university: usersTable.university,
  preferredRole: usersTable.preferredRole,
  preferredCity: usersTable.preferredCity,
  expectedSalary: usersTable.expectedSalary,
  experienceLevel: usersTable.experienceLevel,
  englishLevel: usersTable.englishLevel,
  credits: usersTable.credits,
  signupIp: usersTable.signupIp,
  signupLocation: usersTable.signupLocation,
  lastLoginIp: usersTable.lastLoginIp,
  lastLoginLocation: usersTable.lastLoginLocation,
  lastLoginAt: usersTable.lastLoginAt,
  createdAt: usersTable.createdAt,
};

// GET /api/admin/users — full user directory (newest first).
router.get("/admin/users", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await db
      .select(userDirectoryColumns)
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(2000);
    res.setHeader("Cache-Control", "no-store");
    res.json({ users });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin users list failed");
    res.status(500).json({ error: "Could not load users" });
  }
});

// GET /api/admin/users/:id — one user + their purchases and credit ledger.
router.get("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = idParam(req);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const purchases = await db
      .select()
      .from(upiPaymentsTable)
      .where(eq(upiPaymentsTable.userId, id))
      .orderBy(desc(upiPaymentsTable.createdAt));
    const transactions = await db
      .select()
      .from(creditTransactionsTable)
      .where(eq(creditTransactionsTable.userId, id))
      .orderBy(desc(creditTransactionsTable.createdAt))
      .limit(200);

    // Parse skills JSON for display convenience.
    let skills: string[] = [];
    if (user.skills) {
      try { skills = JSON.parse(user.skills) as string[]; } catch { skills = []; }
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ user: { ...user, skills }, purchases, transactions });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin user detail failed");
    res.status(500).json({ error: "Could not load user" });
  }
});

// GET /api/admin/interviews — all interview sessions joined with user data (newest first).
// verdict: overallScore >= 60 → "Selected", else "Not Selected", null score → "Pending"
router.get("/admin/interviews", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        // interview fields
        id: interviewSessionsTable.id,
        role: interviewSessionsTable.role,
        experienceLevel: interviewSessionsTable.experienceLevel,
        interviewType: interviewSessionsTable.interviewType,
        overallScore: interviewSessionsTable.overallScore,
        communicationScore: interviewSessionsTable.communicationScore,
        grammarScore: interviewSessionsTable.grammarScore,
        confidenceScore: interviewSessionsTable.confidenceScore,
        technicalScore: interviewSessionsTable.technicalScore,
        feedbackJson: interviewSessionsTable.feedbackJson,
        durationSeconds: interviewSessionsTable.durationSeconds,
        completedAt: interviewSessionsTable.completedAt,
        createdAt: interviewSessionsTable.createdAt,
        // user fields
        userId: usersTable.id,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userLocation: usersTable.location,
        signupLocation: usersTable.signupLocation,
        lastLoginLocation: usersTable.lastLoginLocation,
        signupIp: usersTable.signupIp,
        lastLoginIp: usersTable.lastLoginIp,
        preferredCity: usersTable.preferredCity,
        education: usersTable.education,
        degree: usersTable.degree,
        branch: usersTable.branch,
        university: usersTable.university,
      })
      .from(interviewSessionsTable)
      .leftJoin(usersTable, eq(interviewSessionsTable.userId, usersTable.id))
      .orderBy(desc(interviewSessionsTable.createdAt))
      .limit(2000);

    res.setHeader("Cache-Control", "no-store");
    res.json({ interviews: rows });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin interviews list failed");
    res.status(500).json({ error: "Could not load interviews" });
  }
});

export default router;
