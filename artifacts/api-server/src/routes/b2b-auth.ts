/**
 * B2B company authentication routes.
 * Companies log in with email + password (PBKDF2-SHA256, no external dependency).
 * Session key is b2bCompanyId (separate from student userId).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, b2bCompaniesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { geolocateIp } from "../lib/geo.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── Password helpers ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN     = 64;
const PBKDF2_DIGEST     = "sha512";

function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const hash = hashPassword(password, salt);
  // constant-time compare
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

// ── IP helper (mirrors auth.ts) ───────────────────────────────────────────────

function clientIp(req: Request): string | null {
  const cf = (req.headers["cf-connecting-ip"] as string | undefined)?.trim();
  if (cf) return cf;
  const realIp = (req.headers["x-real-ip"] as string | undefined)?.trim();
  if (realIp) return realIp;
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xff || req.ip || null;
}

async function recordB2BLogin(companyId: number, req: Request): Promise<void> {
  try {
    const ip = clientIp(req);
    await db
      .update(b2bCompaniesTable)
      .set({
        lastLoginIp: ip,
        lastLoginAt: new Date(),
      })
      .where(eq(b2bCompaniesTable.id, companyId));

    const loc = await geolocateIp(ip);
    if (loc) {
      await db
        .update(b2bCompaniesTable)
        .set({ lastLoginLocation: loc })
        .where(eq(b2bCompaniesTable.id, companyId));
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, companyId }, "recordB2BLogin failed");
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/b2b/auth/register
 * { name, email, password, phone?, industry?, website? }
 */
router.post("/b2b/auth/register", async (req: Request, res: Response) => {
  const { name, email, password, phone, industry, website } = req.body as {
    name?: string; email?: string; password?: string;
    phone?: string; industry?: string; website?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "Company name, email, and password are required" });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  try {
    const existing = await db
      .select({ id: b2bCompaniesTable.id })
      .from(b2bCompaniesTable)
      .where(eq(b2bCompaniesTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const salt         = crypto.randomBytes(32).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const ip           = clientIp(req);

    const [company] = await db
      .insert(b2bCompaniesTable)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        passwordSalt: salt,
        phone: phone?.trim() || null,
        industry: industry?.trim() || null,
        website: website?.trim() || null,
        signupIp: ip,
      })
      .returning();

    // Geo-tag in background
    if (ip) {
      void geolocateIp(ip).then((loc) => {
        if (loc && company) {
          void db
            .update(b2bCompaniesTable)
            .set({ signupLocation: loc })
            .where(eq(b2bCompaniesTable.id, company.id));
        }
      });
    }

    req.session.b2bCompanyId    = company!.id;
    req.session.b2bCompanyEmail = company!.email;
    req.session.b2bCompanyName  = company!.name;
    // B2B login is a separate portal — clear any student/admin session
    delete req.session.isAdmin;
    delete req.session.userId;
    delete req.session.userEmail;
    delete req.session.userName;

    res.json({
      success: true,
      company: { id: company!.id, name: company!.name, email: company!.email, credits: 0 },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "B2B register error");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

/**
 * POST /api/b2b/auth/login
 * { email, password }
 */
router.post("/b2b/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  try {
    const [company] = await db
      .select()
      .from(b2bCompaniesTable)
      .where(eq(b2bCompaniesTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!company || !verifyPassword(password, company.passwordSalt, company.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    req.session.b2bCompanyId    = company.id;
    req.session.b2bCompanyEmail = company.email;
    req.session.b2bCompanyName  = company.name;
    // B2B login — clear any student/admin session
    delete req.session.isAdmin;
    delete req.session.userId;
    delete req.session.userEmail;
    delete req.session.userName;

    void recordB2BLogin(company.id, req);

    res.json({
      success: true,
      company: {
        id: company.id, name: company.name, email: company.email,
        credits: company.credits, industry: company.industry,
      },
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "B2B login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

/** GET /api/b2b/auth/me */
router.get("/b2b/auth/me", async (req: Request, res: Response) => {
  if (!req.session.b2bCompanyId) {
    res.json({ company: null });
    return;
  }
  try {
    const [company] = await db
      .select({
        id: b2bCompaniesTable.id,
        name: b2bCompaniesTable.name,
        email: b2bCompaniesTable.email,
        credits: b2bCompaniesTable.credits,
        phone: b2bCompaniesTable.phone,
        industry: b2bCompaniesTable.industry,
        website: b2bCompaniesTable.website,
        createdAt: b2bCompaniesTable.createdAt,
      })
      .from(b2bCompaniesTable)
      .where(eq(b2bCompaniesTable.id, req.session.b2bCompanyId))
      .limit(1);
    if (!company) { res.json({ company: null }); return; }
    res.json({ company });
  } catch {
    res.json({ company: null });
  }
});

/** POST /api/b2b/auth/logout */
router.post("/b2b/auth/logout", (req: Request, res: Response) => {
  delete req.session.b2bCompanyId;
  delete req.session.b2bCompanyEmail;
  delete req.session.b2bCompanyName;
  res.json({ success: true });
});

export default router;
