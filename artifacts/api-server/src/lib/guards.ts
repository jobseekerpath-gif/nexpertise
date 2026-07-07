import type { Request, Response, NextFunction } from "express";

/**
 * Gate a route to admins only.
 *
 * `req.session.isAdmin` is set ONLY by the admin-login route after password-hash
 * verification — never by OTP or Google OAuth — so this is the single trusted
 * admin check. Never authorise on email alone (OTP dev-mode can mint any email).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
