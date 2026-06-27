import { Router, type IRouter, type Request, type Response } from "express";
import { db, historyItemsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "./profile.js";

const router: IRouter = Router();

// POST /api/history/items — save a history item
router.post("/history/items", requireAuth, async (req: Request, res: Response) => {
  const { tool, title, content } = req.body as {
    tool?: string;
    title?: string;
    content?: string;
  };

  if (!tool || !title || !content) {
    res.status(400).json({ error: "tool, title, and content required" });
    return;
  }

  try {
    const inserted = await db
      .insert(historyItemsTable)
      .values({
        userId: req.session.userId!,
        tool,
        title,
        content,
      })
      .returning();

    res.json({ item: inserted[0] });
  } catch (err) {
    req.log.error({ err }, "History item insert error");
    res.status(500).json({ error: "Failed to save item" });
  }
});

// DELETE /api/history/items/:id — delete a history item (scoped to current user)
router.delete("/history/items/:id", requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(historyItemsTable)
      .where(and(eq(historyItemsTable.id, id), eq(historyItemsTable.userId, req.session.userId!)))
      .returning();

    if (!deleted.length) {
      res.status(404).json({ error: "Item not found or not owned by you" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "History item delete error");
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// DELETE /api/history/items — clear all history
router.delete("/history/items", requireAuth, async (req: Request, res: Response) => {
  try {
    await db
      .delete(historyItemsTable)
      .where(eq(historyItemsTable.userId, req.session.userId!));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "History clear error");
    res.status(500).json({ error: "Failed to clear history" });
  }
});

// GET /api/history/items — get paginated history
router.get("/history/items", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const items = await db
      .select()
      .from(historyItemsTable)
      .where(eq(historyItemsTable.userId, req.session.userId!))
      .orderBy(desc(historyItemsTable.savedAt))
      .limit(limit)
      .offset(offset);

    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "History items fetch error");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
