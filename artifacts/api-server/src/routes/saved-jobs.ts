import { Router, type IRouter, type Request, type Response } from "express";
import { db, savedJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./profile.js";

const router: IRouter = Router();

// POST /api/jobs/save — save a job
router.post("/jobs/save", requireAuth, async (req: Request, res: Response) => {
  const { jobId, title, company, link, location, salary, jobType, source, applicationStatus } = req.body as {
    jobId?: string;
    title?: string;
    company?: string;
    link?: string;
    location?: string;
    salary?: string;
    jobType?: string;
    source?: string;
    applicationStatus?: string;
  };

  if (!jobId || !title || !link) {
    res.status(400).json({ error: "jobId, title, and link required" });
    return;
  }

  try {
    // Check if already saved
    const existing = await db
      .select()
      .from(savedJobsTable)
      .where(and(eq(savedJobsTable.userId, req.session.userId!), eq(savedJobsTable.jobId, jobId)))
      .limit(1);

    if (existing.length > 0) {
      res.json({ saved: existing[0], alreadySaved: true });
      return;
    }

    const inserted = await db
      .insert(savedJobsTable)
      .values({
        userId: req.session.userId!,
        jobId,
        title,
        company: company ?? null,
        link,
        location: location ?? null,
        salary: salary ?? null,
        jobType: jobType ?? null,
        source: source ?? null,
        applicationStatus: applicationStatus ?? "saved",
      })
      .returning();

    res.json({ saved: inserted[0] });
  } catch (err) {
    req.log.error({ err }, "Save job error");
    res.status(500).json({ error: "Failed to save job" });
  }
});

// PATCH /api/jobs/save/:jobId — update application status
router.patch("/jobs/save/:jobId", requireAuth, async (req: Request, res: Response) => {
  const { jobId } = req.params as { jobId: string };
  const { applicationStatus } = req.body as { applicationStatus?: string };

  if (!applicationStatus) {
    res.status(400).json({ error: "applicationStatus required" });
    return;
  }

  try {
    const updated = await db
      .update(savedJobsTable)
      .set({ applicationStatus })
      .where(and(eq(savedJobsTable.userId, req.session.userId!), eq(savedJobsTable.jobId, jobId)))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Saved job not found" });
      return;
    }

    res.json({ saved: updated[0] });
  } catch (err) {
    req.log.error({ err }, "Update job status error");
    res.status(500).json({ error: "Failed to update job status" });
  }
});

// DELETE /api/jobs/save/:jobId — unsave a job
router.delete("/jobs/save/:jobId", requireAuth, async (req: Request, res: Response) => {
  const { jobId } = req.params as { jobId: string };

  try {
    await db
      .delete(savedJobsTable)
      .where(and(eq(savedJobsTable.userId, req.session.userId!), eq(savedJobsTable.jobId, jobId)));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Unsave job error");
    res.status(500).json({ error: "Failed to unsave job" });
  }
});

// GET /api/jobs/saved — get all saved jobs
router.get("/jobs/saved", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobs = await db
      .select()
      .from(savedJobsTable)
      .where(eq(savedJobsTable.userId, req.session.userId!))
      .orderBy(desc(savedJobsTable.savedAt));

    res.json({ jobs });
  } catch (err) {
    req.log.error({ err }, "Fetch saved jobs error");
    res.status(500).json({ error: "Failed to fetch saved jobs" });
  }
});

// GET /api/jobs/saved/ids — get just the saved job IDs (for quick lookup)
router.get("/jobs/saved/ids", requireAuth, async (req: Request, res: Response) => {
  try {
    const jobs = await db
      .select({ jobId: savedJobsTable.jobId })
      .from(savedJobsTable)
      .where(eq(savedJobsTable.userId, req.session.userId!));

    res.json({ ids: jobs.map(j => j.jobId) });
  } catch (err) {
    req.log.error({ err }, "Fetch saved job IDs error");
    res.status(500).json({ error: "Failed to fetch saved job IDs" });
  }
});

export default router;
