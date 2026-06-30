import { Router, type IRouter } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Resend } from "resend";
import crypto from "crypto";
import { db, usersTable, otpsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { mergeGuestProgress } from "./journey";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userEmail: string;
    userName?: string;
    /** Temporary: guest ID to merge on next successful login (Google OAuth flow) */
    pendingGuestId?: string;
  }
}

const router: IRouter = Router();

/**
 * Determine the Google OAuth callback URL.
 *
 * Priority order:
 *  1. GOOGLE_CALLBACK_URL env var — explicit override, most stable for production.
 *  2. REPLIT_DOMAINS — prefer *.replit.app (deployment), then accept *.replit.dev
 *     (dev preview), then any first domain.
 *  3. localhost fallback for pure local dev.
 */
function getCallbackURL(): string {
  // Explicit override always wins
  const explicit = process.env["GOOGLE_CALLBACK_URL"];
  if (explicit) return explicit;

  const raw = process.env["REPLIT_DOMAINS"] ?? "";
  const domains = raw.split(",").map((d) => d.trim()).filter(Boolean);

  const prodDomain =
    domains.find((d) => d.endsWith(".replit.app")) ??
    domains.find((d) => d.endsWith(".replit.dev")) ??
    domains[0];

  return prodDomain
    ? `https://${prodDomain}/api/auth/google/callback`
    : `http://localhost:${process.env["PORT"] ?? 8080}/api/auth/google/callback`;
}

// Log the callback URL once at startup so it's easy to read in workflow logs.
const _startupCallbackURL = getCallbackURL();
console.log(`[auth] Google OAuth callback URL: ${_startupCallbackURL}`);
console.log(`[auth] To fix redirect_uri_mismatch, add this URL to Google Cloud Console`);
console.log(`[auth]   → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs`);
console.log(`[auth] Or set the GOOGLE_CALLBACK_URL secret to lock it to a stable URL.`);

function setupPassport() {
  // Support both underscore and space variants of secret names
  const clientID = process.env["GOOGLE_CLIENT_ID"] ?? process.env["GOOGLE CLIENT ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? process.env["GOOGLE CLIENT SECRET"];
  if (!clientID || !clientSecret) {
    console.warn("[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        // callbackURL is set here as a default but we ALSO pass it dynamically
        // in the authenticate() middleware calls below so it always reflects the
        // current environment (useful when the domain changes).
        callbackURL: getCallbackURL(),
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from Google"));

          const existing = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.googleId, profile.id))
            .limit(1);

          if (existing.length > 0) {
            return done(null, existing[0]);
          }

          const byEmail = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email))
            .limit(1);

          if (byEmail.length > 0) {
            const updated = await db
              .update(usersTable)
              .set({ googleId: profile.id, authProvider: "google", picture: profile.photos?.[0]?.value, name: profile.displayName })
              .where(eq(usersTable.id, byEmail[0].id))
              .returning();
            return done(null, updated[0]);
          }

          const inserted = await db
            .insert(usersTable)
            .values({
              email,
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
              authProvider: "google",
              googleId: profile.id,
            })
            .returning();
          return done(null, inserted[0]);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => done(null, (user as { id: number }).id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
      done(null, users[0] ?? null);
    } catch (err) {
      done(err);
    }
  });
}

setupPassport();

/**
 * GET /api/auth/config
 * Returns public configuration info for the login page:
 * - Whether Google OAuth is configured
 * - The exact callback URL that must be registered in Google Console
 * - Whether email (Resend) is configured for OTP sending
 */
router.get("/auth/config", (_req, res) => {
  const hasGoogleId = !!(process.env["GOOGLE_CLIENT_ID"] ?? process.env["GOOGLE CLIENT ID"]);
  const hasGoogleSecret = !!(process.env["GOOGLE_CLIENT_SECRET"] ?? process.env["GOOGLE CLIENT SECRET"]);
  const hasResend = !!process.env["RESEND_API_KEY"];

  res.json({
    googleConfigured: hasGoogleId && hasGoogleSecret,
    googleCallbackUrl: getCallbackURL(),
    otpEmailConfigured: hasResend,
    // In dev mode, OTP code is returned in the /auth/otp/send response
    otpDevMode: !hasResend,
  });
});

// Pass callbackURL dynamically so both dev-preview and production domains work
// without requiring a server restart when REPLIT_DOMAINS changes.
router.get("/auth/google", (req, res, next) => {
  const callbackURL = getCallbackURL();
  // Stash any guest ID so we can merge progress after OAuth completes.
  const guestId = req.query["guestId"] as string | undefined;
  if (guestId) req.session.pendingGuestId = guestId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passport.authenticate("google", {
    scope: ["profile", "email"],
    callbackURL,
  } as any)(req, res, next);
});

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    const callbackURL = getCallbackURL();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    passport.authenticate("google", {
      failureRedirect: "/login?error=google_failed",
      callbackURL,
    } as any)(req, res, next);
  },
  async (req, res) => {
    if (req.user) {
      const u = req.user as { id: number; email: string; name?: string };
      req.session.userId = u.id;
      req.session.userEmail = u.email;
      req.session.userName = u.name ?? undefined;

      // Merge any guest progress that was saved before login
      const pendingGuestId = req.session.pendingGuestId;
      if (pendingGuestId) {
        delete req.session.pendingGuestId;
        await mergeGuestProgress(pendingGuestId, String(u.id));
      }
    }
    res.redirect("/");
  }
);

router.post("/auth/otp/send", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Invalidate any existing unused OTPs for this email before issuing a new one
    // so only the most-recently issued code is ever valid.
    await db
      .update(otpsTable)
      .set({ used: true })
      .where(and(eq(otpsTable.email, email), eq(otpsTable.used, false)));

    await db.insert(otpsTable).values({ email, code: hashed, expiresAt, used: false });

    const resendKey = process.env["RESEND_API_KEY"];
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "EduBharat <onboarding@resend.dev>",
        to: email,
        subject: "Your EduBharat Login Code",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#f97316">EduBharat</h2>
          <p>Your one-time login code is:</p>
          <h1 style="font-size:48px;letter-spacing:8px;color:#1e293b">${code}</h1>
          <p style="color:#64748b">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>`,
      });
      res.json({ success: true });
    } else {
      // Dev mode: return the code in the response (no email configured)
      res.json({ success: true, dev: code });
    }
  } catch (err) {
    req.log.error({ err }, "OTP send error");
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

router.post("/auth/otp/verify", async (req, res) => {
  const { email, code, guestId } = req.body as { email?: string; code?: string; guestId?: string };
  if (!email || !code) {
    res.status(400).json({ error: "Email and code required" });
    return;
  }

  const hashed = crypto.createHash("sha256").update(code).digest("hex");
  const now = new Date();

  try {
    // Atomic: mark the OTP as used in a single UPDATE…RETURNING so concurrent
    // verify requests can't both succeed against the same code.
    const consumed = await db
      .update(otpsTable)
      .set({ used: true })
      .where(
        and(
          eq(otpsTable.email, email),
          eq(otpsTable.code, hashed),
          eq(otpsTable.used, false),
          gt(otpsTable.expiresAt, now)
        )
      )
      .returning();

    if (consumed.length === 0) {
      res.status(400).json({ error: "Invalid or expired code. Please request a new OTP." });
      return;
    }

    let user = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user.length === 0) {
      const inserted = await db.insert(usersTable).values({ email, authProvider: "email" }).returning();
      user = inserted;
    }

    req.session.userId = user[0].id;
    req.session.userEmail = user[0].email;
    req.session.userName = user[0].name ?? undefined;

    // Merge any lesson progress the user built up as a guest
    if (guestId) {
      await mergeGuestProgress(guestId, String(user[0].id));
    }

    res.json({ success: true, user: { id: user[0].id, email: user[0].email, name: user[0].name } });
  } catch (err) {
    req.log.error({ err }, "OTP verify error");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    if (!users.length) { res.json({ user: null }); return; }
    const user = users[0]!;
    // Parse skills JSON for client convenience
    let skills: string[] = [];
    if (user.skills) { try { skills = JSON.parse(user.skills) as string[]; } catch { skills = []; } }
    res.json({ user: { ...user, skills } });
  } catch {
    res.json({ user: null });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// POST /api/auth/admin-login — username + password login for admin/local accounts
// Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH (sha256 hex) as Replit secrets to enable.
router.post("/auth/admin-login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    const adminUser = process.env["ADMIN_USERNAME"] ?? "admin";
    const adminHash = process.env["ADMIN_PASSWORD_HASH"];

    if (!adminHash) {
      res.status(503).json({ error: "Admin login not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD_HASH secrets." });
      return;
    }

    const incoming = crypto.createHash("sha256").update(password ?? "").digest("hex");
    if (!username || username !== adminUser || incoming !== adminHash) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const adminEmail = "admin@edubharat.in";
    let adminRecords = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail)).limit(1);
    if (adminRecords.length === 0) {
      const inserted = await db.insert(usersTable).values({
        email: adminEmail,
        name: "Admin",
        authProvider: "local",
      }).returning();
      adminRecords = inserted;
    }

    const user = adminRecords[0]!;
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name ?? undefined;

    res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    req.log?.error?.({ err }, "Admin login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

export { setupPassport };
export default router;
