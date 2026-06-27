import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, analyticsEventsTable, webVitalsTable } from "@workspace/db";
import { logger } from "../lib/logger.js";

const eventSchema = z.object({
  anonymousId: z.string().max(64),
  event: z.string().max(64),
  path: z.string().max(512),
  properties: z.record(z.string(), z.unknown()).optional(),
});

const webVitalSchema = z.object({
  anonymousId: z.string().max(64),
  name: z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  delta: z.number().optional(),
  navigationType: z.string().optional(),
  path: z.string().max(512),
});

const router: IRouter = Router();

router.post("/analytics/events", async (req, res) => {
  const parse = eventSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid event payload" });
    return;
  }
  const userId = req.user ? (req.user as { id: number }).id : null;
  const { anonymousId, event, path, properties } = parse.data;
  try {
    await db.insert(analyticsEventsTable).values({
      userId,
      anonymousId,
      event,
      path,
      properties: properties ? JSON.stringify(properties) : null,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to insert analytics event");
    res.status(500).json({ error: "Failed to store event" });
  }
});

router.post("/analytics/web-vitals", async (req, res) => {
  const parse = webVitalSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid web vital payload" });
    return;
  }
  const userId = req.user ? (req.user as { id: number }).id : null;
  const { anonymousId, name, value, rating, delta, navigationType, path } = parse.data;
  try {
    await db.insert(webVitalsTable).values({
      userId,
      anonymousId,
      name,
      value: String(value),
      rating,
      delta: delta !== undefined ? String(delta) : null,
      navigationType,
      path,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to insert web vital");
    res.status(500).json({ error: "Failed to store web vital" });
  }
});

export default router;
