/**
 * B2B dashboard routes — campaign management, invite links, credit top-ups,
 * and public interview-completion endpoint.
 */
import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, b2bCompaniesTable, b2bCampaignsTable, b2bInvitesTable, b2bUpiPaymentsTable, b2bCreditTransactionsTable, interviewSessionsTable, usersTable } from "@workspace/db";
import { and, desc, eq, count, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/guards.js";
import { geolocateIp } from "../lib/geo.js";
import {
  getB2BBalance, getB2BTransactions, spendB2BCredits, spendB2BCreditsTx,
  grantB2BCreditsTx, reverseB2BCreditsTx, B2B_INTERVIEW_COST,
} from "../lib/b2b-credits.js";
import { sendEmail } from "../lib/mailer.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── Auth guard ────────────────────────────────────────────────────────────────

function requireB2BAuth(req: Request, res: Response, next: () => void): void {
  if (!req.session.b2bCompanyId) {
    res.status(401).json({ error: "B2B login required" });
    return;
  }
  next();
}

function idParam(req: Request): number {
  const raw = req.params.id;
  return parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
}

function clientIp(req: Request): string | null {
  const cf = (req.headers["cf-connecting-ip"] as string | undefined)?.trim();
  if (cf) return cf;
  const realIp = (req.headers["x-real-ip"] as string | undefined)?.trim();
  if (realIp) return realIp;
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xff || req.ip || null;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

router.get("/b2b/stats", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  try {
    const [total] = await db
      .select({ c: count() })
      .from(b2bInvitesTable)
      .where(eq(b2bInvitesTable.companyId, companyId));
    const [completed] = await db
      .select({ c: count() })
      .from(b2bInvitesTable)
      .where(and(eq(b2bInvitesTable.companyId, companyId), eq(b2bInvitesTable.status, "completed")));
    const [pending] = await db
      .select({ c: count() })
      .from(b2bInvitesTable)
      .where(and(eq(b2bInvitesTable.companyId, companyId), eq(b2bInvitesTable.status, "pending")));

    // Count selected (overallScore >= 60) from linked interview sessions
    const sessions = await db
      .select({ overallScore: interviewSessionsTable.overallScore })
      .from(b2bInvitesTable)
      .innerJoin(interviewSessionsTable, eq(b2bInvitesTable.interviewSessionId, interviewSessionsTable.id))
      .where(and(eq(b2bInvitesTable.companyId, companyId), eq(b2bInvitesTable.status, "completed")));

    const selected = sessions.filter((s) => (s.overallScore ?? 0) >= 60).length;
    const balance = await getB2BBalance(companyId);

    res.json({
      totalInvites: total?.c ?? 0,
      completed: completed?.c ?? 0,
      pending: pending?.c ?? 0,
      selected,
      balance,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b stats error");
    res.status(500).json({ error: "Could not load stats" });
  }
});

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.get("/b2b/campaigns", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  try {
    const campaigns = await db
      .select()
      .from(b2bCampaignsTable)
      .where(eq(b2bCampaignsTable.companyId, companyId))
      .orderBy(desc(b2bCampaignsTable.createdAt));

    // Attach invite counts per campaign
    const counts = await db
      .select({
        campaignId: b2bInvitesTable.campaignId,
        total: count(),
      })
      .from(b2bInvitesTable)
      .where(eq(b2bInvitesTable.companyId, companyId))
      .groupBy(b2bInvitesTable.campaignId);

    const completedCounts = await db
      .select({ campaignId: b2bInvitesTable.campaignId, done: count() })
      .from(b2bInvitesTable)
      .where(and(eq(b2bInvitesTable.companyId, companyId), eq(b2bInvitesTable.status, "completed")))
      .groupBy(b2bInvitesTable.campaignId);

    const countMap = Object.fromEntries(counts.map((r) => [r.campaignId, r.total]));
    const doneMap = Object.fromEntries(completedCounts.map((r) => [r.campaignId, r.done]));

    res.json({
      campaigns: campaigns.map((c) => ({
        ...c,
        inviteCount: countMap[c.id] ?? 0,
        completedCount: doneMap[c.id] ?? 0,
      })),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b list campaigns error");
    res.status(500).json({ error: "Could not load campaigns" });
  }
});

router.post("/b2b/campaigns", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const { title, role, experienceLevel, interviewType, coachId, durationMinutes, description } = req.body as {
    title?: string; role?: string; experienceLevel?: string; interviewType?: string;
    coachId?: string; durationMinutes?: number; description?: string;
  };

  if (!title?.trim() || !role?.trim()) {
    res.status(400).json({ error: "Campaign title and role are required" });
    return;
  }

  try {
    const [campaign] = await db
      .insert(b2bCampaignsTable)
      .values({
        companyId,
        title: title.trim(),
        role: role.trim(),
        experienceLevel: experienceLevel || "Fresher",
        interviewType: interviewType || "hr",
        coachId: coachId || "raj",
        durationMinutes: Math.min(60, Math.max(5, Number(durationMinutes) || 15)),
        description: description?.trim() || null,
      })
      .returning();

    res.json({ campaign });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b create campaign error");
    res.status(500).json({ error: "Could not create campaign" });
  }
});

router.get("/b2b/campaigns/:id", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const id = idParam(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid campaign id" }); return; }

  try {
    const [campaign] = await db
      .select()
      .from(b2bCampaignsTable)
      .where(and(eq(b2bCampaignsTable.id, id), eq(b2bCampaignsTable.companyId, companyId)))
      .limit(1);

    if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

    // Invites with session results
    const invites = await db
      .select({
        id: b2bInvitesTable.id,
        token: b2bInvitesTable.token,
        candidateEmail: b2bInvitesTable.candidateEmail,
        candidateName: b2bInvitesTable.candidateName,
        status: b2bInvitesTable.status,
        candidateIp: b2bInvitesTable.candidateIp,
        candidateLocation: b2bInvitesTable.candidateLocation,
        sentAt: b2bInvitesTable.sentAt,
        startedAt: b2bInvitesTable.startedAt,
        completedAt: b2bInvitesTable.completedAt,
        createdAt: b2bInvitesTable.createdAt,
        overallScore: interviewSessionsTable.overallScore,
        communicationScore: interviewSessionsTable.communicationScore,
        grammarScore: interviewSessionsTable.grammarScore,
        confidenceScore: interviewSessionsTable.confidenceScore,
        technicalScore: interviewSessionsTable.technicalScore,
        feedbackJson: interviewSessionsTable.feedbackJson,
        durationSeconds: interviewSessionsTable.durationSeconds,
      })
      .from(b2bInvitesTable)
      .leftJoin(interviewSessionsTable, eq(b2bInvitesTable.interviewSessionId, interviewSessionsTable.id))
      .where(eq(b2bInvitesTable.campaignId, id))
      .orderBy(desc(b2bInvitesTable.createdAt));

    res.json({ campaign, invites });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b get campaign error");
    res.status(500).json({ error: "Could not load campaign" });
  }
});

// ── Invite management ─────────────────────────────────────────────────────────

/**
 * POST /api/b2b/campaigns/:id/invites
 * { candidates: [{email, name?}], sendEmail?: boolean }
 * Creates one invite per candidate and optionally dispatches invite emails.
 */
router.post("/b2b/campaigns/:id/invites", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const campaignId = idParam(req);
  if (isNaN(campaignId)) { res.status(400).json({ error: "Invalid campaign id" }); return; }

  const { candidates, sendEmail: doSend = false } = req.body as {
    candidates?: Array<{ email?: string; name?: string }>;
    sendEmail?: boolean;
  };

  if (!Array.isArray(candidates) || candidates.length === 0) {
    res.status(400).json({ error: "Provide at least one candidate" });
    return;
  }
  if (candidates.length > 500) {
    res.status(400).json({ error: "Maximum 500 invites per request" });
    return;
  }

  // Verify campaign ownership
  const [campaign] = await db
    .select()
    .from(b2bCampaignsTable)
    .where(and(eq(b2bCampaignsTable.id, campaignId), eq(b2bCampaignsTable.companyId, companyId)))
    .limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  // Get company name for email
  const [company] = await db
    .select({ name: b2bCompaniesTable.name })
    .from(b2bCompaniesTable)
    .where(eq(b2bCompaniesTable.id, companyId))
    .limit(1);

  const baseUrl = (() => {
    const host = req.headers.host ?? "";
    const proto = req.headers["x-forwarded-proto"] as string ?? "https";
    return `${proto}://${host}`;
  })();

  try {
    const inserted = await db
      .insert(b2bInvitesTable)
      .values(
        candidates.map((c) => ({
          companyId,
          campaignId,
          token: randomUUID(),
          candidateEmail: c.email?.trim().toLowerCase() || null,
          candidateName: c.name?.trim() || null,
          status: "pending" as const,
          sentAt: doSend ? new Date() : null,
        })),
      )
      .returning();

    // Send emails in background (fire-and-forget)
    if (doSend) {
      const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
      const urlBase = domain ? `https://${domain}` : baseUrl;
      for (const invite of inserted) {
        if (!invite.candidateEmail) continue;
        const link = `${urlBase}/b2b-interview/${invite.token}`;
        void sendEmail({
          to: invite.candidateEmail,
          subject: `Interview invitation from ${company?.name ?? "a company"} — EduBharat`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1e293b">
            <h2 style="color:#f97316">EduBharat · Interview Invitation</h2>
            <p>Hi${invite.candidateName ? ` ${invite.candidateName}` : ""},</p>
            <p><strong>${company?.name ?? "A company"}</strong> has invited you to complete a <strong>${campaign.role}</strong> interview via EduBharat's AI-powered Interview Ace platform.</p>
            <p>Duration: <strong>${campaign.durationMinutes} minutes</strong> | Type: <strong>${campaign.interviewType}</strong></p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Start Your Interview →</a>
            </p>
            <p style="color:#94a3b8;font-size:12px">This link is unique to you. Do not share it.</p>
          </div>`,
        });
      }
    }

    res.json({ invites: inserted, sent: doSend ? inserted.filter((i) => i.candidateEmail).length : 0 });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b create invites error");
    res.status(500).json({ error: "Could not create invites" });
  }
});

/** DELETE /api/b2b/invites/:id — soft-delete (mark expired) a pending invite. */
router.delete("/b2b/invites/:id", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const id = idParam(req);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid invite id" }); return; }

  const [updated] = await db
    .update(b2bInvitesTable)
    .set({ status: "expired" })
    .where(and(
      eq(b2bInvitesTable.id, id),
      eq(b2bInvitesTable.companyId, companyId),
      eq(b2bInvitesTable.status, "pending"),
    ))
    .returning();

  if (!updated) { res.status(404).json({ error: "Invite not found or already completed" }); return; }
  res.json({ ok: true });
});

// ── Candidates (all completed interviews for this company) ────────────────────

router.get("/b2b/candidates", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  try {
    const rows = await db
      .select({
        inviteId: b2bInvitesTable.id,
        campaignId: b2bInvitesTable.campaignId,
        token: b2bInvitesTable.token,
        candidateEmail: b2bInvitesTable.candidateEmail,
        candidateName: b2bInvitesTable.candidateName,
        candidateIp: b2bInvitesTable.candidateIp,
        candidateLocation: b2bInvitesTable.candidateLocation,
        completedAt: b2bInvitesTable.completedAt,
        campaignTitle: b2bCampaignsTable.title,
        campaignRole: b2bCampaignsTable.role,
        overallScore: interviewSessionsTable.overallScore,
        communicationScore: interviewSessionsTable.communicationScore,
        grammarScore: interviewSessionsTable.grammarScore,
        confidenceScore: interviewSessionsTable.confidenceScore,
        technicalScore: interviewSessionsTable.technicalScore,
        feedbackJson: interviewSessionsTable.feedbackJson,
        durationSeconds: interviewSessionsTable.durationSeconds,
      })
      .from(b2bInvitesTable)
      .innerJoin(b2bCampaignsTable, eq(b2bInvitesTable.campaignId, b2bCampaignsTable.id))
      .leftJoin(interviewSessionsTable, eq(b2bInvitesTable.interviewSessionId, interviewSessionsTable.id))
      .where(and(eq(b2bInvitesTable.companyId, companyId), eq(b2bInvitesTable.status, "completed")))
      .orderBy(desc(b2bInvitesTable.completedAt));

    res.json({ candidates: rows });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b candidates error");
    res.status(500).json({ error: "Could not load candidates" });
  }
});

// ── Credits ───────────────────────────────────────────────────────────────────

router.get("/b2b/credits/balance", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const balance = await getB2BBalance(companyId);
  res.json({ balance });
});

router.get("/b2b/credits/transactions", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const txns = await getB2BTransactions(companyId, 100);
  res.json({ transactions: txns });
});

const MIN_B2B_PURCHASE = 50;
const MAX_B2B_PURCHASE = 500_000;

/** POST /api/b2b/credits/upi/submit { credits, utr } */
router.post("/b2b/credits/upi/submit", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const { credits: rawCredits, utr: rawUtr } = req.body as { credits?: number; utr?: string };
  const credits = Math.floor(Number(rawCredits));
  const utr = (rawUtr ?? "").trim().toUpperCase();

  if (!Number.isFinite(credits) || credits < MIN_B2B_PURCHASE || credits > MAX_B2B_PURCHASE) {
    res.status(400).json({ error: `Choose between ${MIN_B2B_PURCHASE} and ${MAX_B2B_PURCHASE} credits` });
    return;
  }
  if (!utr || utr.length < 6) {
    res.status(400).json({ error: "Enter a valid UTR (at least 6 characters)" });
    return;
  }

  try {
    const [payment] = await db
      .insert(b2bUpiPaymentsTable)
      .values({ companyId, credits, amountInr: credits, utr, status: "pending" })
      .returning();

    res.json({ ok: true, paymentId: payment!.id, status: "pending" });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This UTR has already been submitted" });
      return;
    }
    logger.error({ err: (err as Error).message }, "b2b UPI submit error");
    res.status(500).json({ error: "Could not record payment. Please try again." });
  }
});

/** GET /api/b2b/credits/upi/status/:id */
router.get("/b2b/credits/upi/status/:id", requireB2BAuth, async (req: Request, res: Response) => {
  const companyId = req.session.b2bCompanyId!;
  const paymentId = idParam(req);
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment id" }); return; }

  const [payment] = await db
    .select()
    .from(b2bUpiPaymentsTable)
    .where(eq(b2bUpiPaymentsTable.id, paymentId))
    .limit(1);

  if (!payment || payment.companyId !== companyId) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  res.json({ status: payment.status, credits: payment.credits, rejectionReason: payment.rejectionReason });
});

// ── Public: invite info + interview completion ────────────────────────────────

/**
 * GET /api/b2b/invite/:token/info — public, no auth.
 * Returns campaign config so the landing page can show role/duration/company.
 */
router.get("/b2b/invite/:token/info", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  try {
    const [row] = await db
      .select({
        id: b2bInvitesTable.id,
        status: b2bInvitesTable.status,
        candidateName: b2bInvitesTable.candidateName,
        candidateEmail: b2bInvitesTable.candidateEmail,
        campaignTitle: b2bCampaignsTable.title,
        campaignRole: b2bCampaignsTable.role,
        experienceLevel: b2bCampaignsTable.experienceLevel,
        interviewType: b2bCampaignsTable.interviewType,
        coachId: b2bCampaignsTable.coachId,
        durationMinutes: b2bCampaignsTable.durationMinutes,
        description: b2bCampaignsTable.description,
        companyName: b2bCompaniesTable.name,
        isAnonymous: b2bCompaniesTable.isAnonymous,
      })
      .from(b2bInvitesTable)
      .innerJoin(b2bCampaignsTable, eq(b2bInvitesTable.campaignId, b2bCampaignsTable.id))
      .innerJoin(b2bCompaniesTable, eq(b2bInvitesTable.companyId, b2bCompaniesTable.id))
      .where(eq(b2bInvitesTable.token, token))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Invite not found" }); return; }
    if (row.status === "expired") { res.status(410).json({ error: "This interview link has expired" }); return; }
    if (row.status === "completed") { res.status(409).json({ error: "This interview has already been completed" }); return; }

    // Mask company name if the company opted for anonymity
    const invite = {
      ...row,
      companyName: row.isAnonymous ? "Confidential Company" : row.companyName,
      isAnonymous: undefined, // don't expose the raw flag to the public
    };

    res.json({ invite });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b invite info error");
    res.status(500).json({ error: "Could not load invite" });
  }
});

/**
 * POST /api/b2b/invite/:token/start — public.
 * Marks the invite as started and captures candidate IP.
 * { candidateName? } — if the candidate filled in their name on the landing page.
 */
router.post("/b2b/invite/:token/start", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const { candidateName } = req.body as { candidateName?: string };

  const [invite] = await db
    .select()
    .from(b2bInvitesTable)
    .where(eq(b2bInvitesTable.token, token))
    .limit(1);

  if (!invite) { res.status(404).json({ error: "Invite not found" }); return; }
  if (invite.status === "completed" || invite.status === "expired") {
    res.status(409).json({ error: `Invite is already ${invite.status}` });
    return;
  }

  const ip = clientIp(req);
  await db
    .update(b2bInvitesTable)
    .set({
      status: "started",
      startedAt: new Date(),
      candidateIp: ip,
      ...(candidateName?.trim() ? { candidateName: candidateName.trim() } : {}),
    })
    .where(eq(b2bInvitesTable.token, token));

  // Geo-tag in background
  if (ip) {
    void geolocateIp(ip).then((loc) => {
      if (loc) {
        void db
          .update(b2bInvitesTable)
          .set({ candidateLocation: loc })
          .where(eq(b2bInvitesTable.token, token));
      }
    });
  }

  res.json({ ok: true });
});

/**
 * POST /api/b2b/invite/:token/complete — public (no B2B auth required).
 * Called from interview-ace when a B2B interview session is finished.
 *
 * Fully atomic: FOR UPDATE row lock → save session → spend credits → mark complete
 * in a single transaction.  Duplicate submissions are rejected by the status
 * precondition; duplicate credit deductions are blocked by the idempotency index.
 *
 * Minimum completeness: durationSeconds >= 60 (prevents zero-effort completions).
 */
router.post("/b2b/invite/:token/complete", async (req: Request, res: Response) => {
  const token = req.params.token as string;
  const {
    candidateName, role, experienceLevel, interviewType, questionsData,
    overallScore, durationSeconds, feedbackJson,
    communicationScore, grammarScore, confidenceScore, technicalScore,
  } = req.body as {
    candidateName?: string;
    role?: string; experienceLevel?: string; interviewType?: string;
    questionsData?: string; overallScore?: number; durationSeconds?: number;
    feedbackJson?: string; communicationScore?: number; grammarScore?: number;
    confidenceScore?: number; technicalScore?: number;
  };

  if (!role?.trim() || !experienceLevel?.trim()) {
    res.status(400).json({ error: "role and experienceLevel required" });
    return;
  }
  if (!durationSeconds || durationSeconds < 60) {
    res.status(400).json({ error: "Interview too short to record (minimum 60 seconds)" });
    return;
  }

  const ip = clientIp(req);
  const userId = req.session.userId ?? null;

  type TxResult = { kind: "ok"; sessionId: number } | { kind: "err"; status: number; message: string };

  let txResult: TxResult;
  try {
    txResult = await db.transaction(async (tx): Promise<TxResult> => {
      // --- Step 1: Lock the invite row exclusively ---
      const [locked] = await tx
        .select()
        .from(b2bInvitesTable)
        .where(eq(b2bInvitesTable.token, token))
        .for("update")
        .limit(1);

      if (!locked) return { kind: "err", status: 404, message: "Invite not found" };
      if (locked.status === "completed") return { kind: "err", status: 409, message: "Interview already submitted" };
      if (locked.status === "expired") return { kind: "err", status: 410, message: "Invite expired" };

      // --- Step 2: Deduct credits BEFORE creating the session (fail fast) ---
      const spend = await spendB2BCreditsTx(tx, {
        companyId: locked.companyId,
        amount: B2B_INTERVIEW_COST,
        description: `Interview completed — ${role} (invite #${locked.id})`,
        reference: `b2b_invite:${locked.id}`,
      });
      if (!spend.ok && !spend.already) {
        return { kind: "err", status: 402, message: "Company has insufficient credits" };
      }

      // --- Step 3: Save the interview session ---
      const [session] = await tx
        .insert(interviewSessionsTable)
        .values({
          userId,
          role: role!.trim(),
          experienceLevel: experienceLevel!.trim(),
          interviewType: interviewType ?? null,
          questionsData: questionsData ?? null,
          overallScore: overallScore != null ? Math.round(overallScore) : null,
          durationSeconds: Math.round(durationSeconds),
          feedbackJson: feedbackJson ?? null,
          communicationScore: communicationScore ?? null,
          grammarScore: grammarScore ?? null,
          confidenceScore: confidenceScore ?? null,
          technicalScore: technicalScore ?? null,
          b2bInviteId: locked.id,
          completedAt: new Date(),
        })
        .returning();

      // --- Step 4: Mark invite completed (status precondition prevents races) ---
      const [updated] = await tx
        .update(b2bInvitesTable)
        .set({
          status: "completed",
          completedAt: new Date(),
          interviewSessionId: session!.id,
          candidateIp: ip,
          ...(candidateName?.trim() ? { candidateName: candidateName.trim() } : {}),
        })
        .where(and(eq(b2bInvitesTable.token, token), eq(b2bInvitesTable.status, locked.status)))
        .returning();

      if (!updated) {
        // Another concurrent request changed the status between our FOR UPDATE and this update
        return { kind: "err", status: 409, message: "Invite was already processed" };
      }

      return { kind: "ok", sessionId: session!.id };
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "b2b invite complete error");
    res.status(500).json({ error: "Could not save interview. Please try again." });
    return;
  }

  if (txResult.kind === "err") {
    res.status(txResult.status).json({ error: txResult.message });
    return;
  }

  // Background geo-tag
  if (ip) {
    void geolocateIp(ip).then((loc) => {
      if (loc) {
        void db
          .update(b2bInvitesTable)
          .set({ candidateLocation: loc })
          .where(eq(b2bInvitesTable.token, token));
      }
    });
  }

  res.json({ ok: true, sessionId: txResult.sessionId });
});

// ── Admin: B2B UPI approvals ──────────────────────────────────────────────────

router.get("/admin/b2b/upi/pending", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const payments = await db
      .select({
        id: b2bUpiPaymentsTable.id,
        companyId: b2bUpiPaymentsTable.companyId,
        credits: b2bUpiPaymentsTable.credits,
        amountInr: b2bUpiPaymentsTable.amountInr,
        utr: b2bUpiPaymentsTable.utr,
        status: b2bUpiPaymentsTable.status,
        rejectionReason: b2bUpiPaymentsTable.rejectionReason,
        reversedAt: b2bUpiPaymentsTable.reversedAt,
        createdAt: b2bUpiPaymentsTable.createdAt,
        companyName: b2bCompaniesTable.name,
        companyEmail: b2bCompaniesTable.email,
      })
      .from(b2bUpiPaymentsTable)
      .leftJoin(b2bCompaniesTable, eq(b2bUpiPaymentsTable.companyId, b2bCompaniesTable.id))
      .orderBy(desc(b2bUpiPaymentsTable.createdAt))
      .limit(200);

    res.json({ payments });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin b2b payments error");
    res.status(500).json({ error: "Could not load B2B payments" });
  }
});

router.post("/admin/b2b/upi/approve/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment id" }); return; }

  try {
    const outcome = await db.transaction(async (tx) => {
      const [payment] = await tx
        .update(b2bUpiPaymentsTable)
        .set({ status: "approved", approvedBy: req.session.userId, updatedAt: new Date() })
        .where(and(eq(b2bUpiPaymentsTable.id, paymentId), eq(b2bUpiPaymentsTable.status, "pending")))
        .returning();
      if (!payment) return { kind: "conflict" as const };

      const grant = await grantB2BCreditsTx(tx, {
        companyId: payment.companyId,
        amount: payment.credits,
        type: "purchase",
        description: `UPI top-up — ₹${payment.amountInr} (UTR: ${payment.utr})`,
        reference: `b2b_upi:${payment.id}`,
      });
      if (!grant.ok && !grant.already) throw new Error("GRANT_FAILED");
      return { kind: "ok" as const };
    });

    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "Payment already processed" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin b2b approve error");
    res.status(500).json({ error: "Credit grant failed. Please try again." });
  }
});

router.post("/admin/b2b/upi/reject/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  const reason = ((req.body as { reason?: string }).reason ?? "").trim() || null;
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment id" }); return; }

  const [payment] = await db
    .update(b2bUpiPaymentsTable)
    .set({ status: "rejected", rejectionReason: reason, approvedBy: req.session.userId, updatedAt: new Date() })
    .where(and(eq(b2bUpiPaymentsTable.id, paymentId), eq(b2bUpiPaymentsTable.status, "pending")))
    .returning();

  if (!payment) { res.status(409).json({ error: "Payment already processed" }); return; }
  res.json({ ok: true });
});

router.post("/admin/b2b/upi/reverse/:id", requireAdmin, async (req: Request, res: Response) => {
  const paymentId = idParam(req);
  const reason = ((req.body as { reason?: string }).reason ?? "").trim() || null;
  if (isNaN(paymentId)) { res.status(400).json({ error: "Invalid payment id" }); return; }

  try {
    const outcome = await db.transaction(async (tx) => {
      const [payment] = await tx
        .update(b2bUpiPaymentsTable)
        .set({ status: "reversed", rejectionReason: reason, reversedBy: req.session.userId, reversedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(b2bUpiPaymentsTable.id, paymentId), eq(b2bUpiPaymentsTable.status, "approved")))
        .returning();
      if (!payment) return { kind: "conflict" as const };

      await reverseB2BCreditsTx(tx, {
        companyId: payment.companyId,
        amount: payment.credits,
        description: `Reversed UPI top-up (UTR: ${payment.utr})`,
        reference: `b2b_reverse:${payment.id}`,
      });
      return { kind: "ok" as const };
    });

    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "Only approved payments can be reversed" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "admin b2b reverse error");
    res.status(500).json({ error: "Reversal failed. Please try again." });
  }
});

export default router;
