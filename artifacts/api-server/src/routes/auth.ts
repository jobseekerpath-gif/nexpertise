import { Router, type IRouter } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Resend } from "resend";
import crypto from "crypto";
import { db, usersTable, otpsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userEmail: string;
    userName?: string;
  }
}

const router: IRouter = Router();

function getCallbackURL() {
  const domains = process.env["REPLIT_DOMAINS"]?.split(",") ?? [];
  const prodDomain = domains.find((d) => d.endsWith(".replit.app")) ?? domains[0];
  return prodDomain
    ? `https://${prodDomain}/api/auth/google/callback`
    : `http://localhost:${process.env["PORT"] ?? 8080}/api/auth/google/callback`;
}

function setupPassport() {
  // Support both underscore and space variants of secret names
  const clientID = process.env["GOOGLE_CLIENT_ID"] ?? process.env["GOOGLE CLIENT ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"] ?? process.env["GOOGLE CLIENT SECRET"];
  if (!clientID || !clientSecret) return;

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL: getCallbackURL() },
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

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=google_failed" }),
  (req, res) => {
    if (req.user) {
      const u = req.user as { id: number; email: string; name?: string };
      req.session.userId = u.id;
      req.session.userEmail = u.email;
      req.session.userName = u.name ?? undefined;
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
    }

    res.json({ success: true, dev: !resendKey ? code : undefined });
  } catch (err) {
    req.log.error({ err }, "OTP send error");
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

router.post("/auth/otp/verify", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };
  if (!email || !code) {
    res.status(400).json({ error: "Email and code required" });
    return;
  }

  const hashed = crypto.createHash("sha256").update(code).digest("hex");
  const now = new Date();

  try {
    const otps = await db
      .select()
      .from(otpsTable)
      .where(
        and(
          eq(otpsTable.email, email),
          eq(otpsTable.code, hashed),
          eq(otpsTable.used, false),
          gt(otpsTable.expiresAt, now)
        )
      )
      .limit(1);

    if (otps.length === 0) {
      res.status(400).json({ error: "Invalid or expired code" });
      return;
    }

    await db.update(otpsTable).set({ used: true }).where(eq(otpsTable.id, otps[0].id));

    let user = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user.length === 0) {
      const inserted = await db.insert(usersTable).values({ email, authProvider: "email" }).returning();
      user = inserted;
    }

    req.session.userId = user[0].id;
    req.session.userEmail = user[0].email;
    req.session.userName = user[0].name ?? undefined;

    res.json({ success: true, user: { id: user[0].id, email: user[0].email, name: user[0].name } });
  } catch (err) {
    req.log.error({ err }, "OTP verify error");
    res.status(500).json({ error: "Verification failed" });
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
