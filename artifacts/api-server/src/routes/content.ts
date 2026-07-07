import { Router, type IRouter, type Request, type Response } from "express";
import { db, siteContentTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/guards.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const MAX_VALUE_LEN = 20_000;

// GET /api/content — public map of { key: value } overrides. Defaults live in the
// client's content registry; only overridden keys are returned here.
router.get("/content", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ key: siteContentTable.key, value: siteContentTable.value })
      .from(siteContentTable);
    const content: Record<string, string> = {};
    for (const r of rows) content[r.key] = r.value;
    res.setHeader("Cache-Control", "no-store");
    res.json({ content });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content fetch failed");
    res.json({ content: {} });
  }
});

// PUT /api/admin/content { key, value } — upsert an override, or clear it (revert
// to the code default) when value is empty. Admin only.
router.put("/admin/content", requireAdmin, async (req: Request, res: Response) => {
  const { key, value } = req.body as { key?: string; value?: string };
  if (!key || typeof key !== "string" || key.length > 200) {
    res.status(400).json({ error: "A valid content key is required" });
    return;
  }
  const text = (value ?? "").toString();
  if (text.length > MAX_VALUE_LEN) {
    res.status(400).json({ error: "Content is too long" });
    return;
  }
  try {
    if (text.length === 0) {
      // Empty → remove the override so the code default shows again.
      await db.delete(siteContentTable).where(eq(siteContentTable.key, key));
      res.json({ ok: true, cleared: true });
      return;
    }
    await db
      .insert(siteContentTable)
      .values({ key, value: text, updatedBy: req.session.userId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteContentTable.key,
        set: { value: text, updatedBy: req.session.userId, updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "content save failed");
    res.status(500).json({ error: "Could not save content" });
  }
});

export default router;
