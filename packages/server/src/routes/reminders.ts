import { Router } from "express";
import { db } from "../db/index.js";
import { reminders } from "../db/schema.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";

const router = Router();

// GET /api/reminders?upcoming=true&sent=false
router.get("/", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    let result = db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.remindAt)).all();

    if (req.query.upcoming === "true") {
      const now = new Date().toISOString();
      result = result.filter((r) => !r.sent && r.remindAt >= now);
    }
    if (req.query.sent === "false") {
      result = result.filter((r) => !r.sent);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch reminders" });
  }
});

// POST /api/reminders
router.post("/", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { title, message, remindAt, repeatRule, sourceType, sourceId, channel } = req.body;
    if (!title?.trim() || !remindAt) {
      res.status(400).json({ success: false, error: "Title and remindAt are required" });
      return;
    }

    const result = db.insert(reminders).values({
      userId,
      title: title.trim(),
      message: message?.trim() || null,
      remindAt,
      repeatRule: repeatRule || null,
      sourceType: sourceType || "custom",
      sourceId: sourceId || null,
      channel: channel || "web_push",
    }).returning().get();

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create reminder" });
  }
});

// PUT /api/reminders/:id
router.put("/:id", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.message !== undefined) updates.message = req.body.message;
    if (req.body.remindAt !== undefined) updates.remindAt = req.body.remindAt;
    if (req.body.repeatRule !== undefined) updates.repeatRule = req.body.repeatRule;
    if (req.body.sent !== undefined) updates.sent = req.body.sent;
    if (req.body.channel !== undefined) updates.channel = req.body.channel;

    const result = db.update(reminders).set(updates).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning().get();
    if (!result) { res.status(404).json({ success: false, error: "Reminder not found" }); return; }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update reminder" });
  }
});

// POST /api/reminders/:id/snooze
router.post("/:id/snooze", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const { duration } = req.body; // minutes
    const mins = parseInt(duration) || 15;
    const snoozedUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();

    const result = db.update(reminders).set({
      snoozedUntil,
      sent: false,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning().get();

    if (!result) { res.status(404).json({ success: false, error: "Reminder not found" }); return; }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Snooze failed" });
  }
});

// DELETE /api/reminders/:id
router.delete("/:id", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const result = db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning().get();
    if (!result) { res.status(404).json({ success: false, error: "Reminder not found" }); return; }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

export default router;
