import { Router } from "express";
import { db } from "../db/index.js";
import { reminders } from "../db/schema.js";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const router = Router();

// GET /api/reminders?upcoming=true&sent=false
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  let result = await db.select().from(reminders).where(eq(reminders.userId, userId)).orderBy(asc(reminders.remindAt));

  if (req.query.upcoming === "true") {
    const now = new Date().toISOString();
    result = result.filter((r) => !r.sent && r.remindAt >= now);
  }
  if (req.query.sent === "false") {
    result = result.filter((r) => !r.sent);
  }

  res.json({ success: true, data: result });
}));

// GET /api/reminders/due - get reminders that are due now (for notification polling)
router.get("/due", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const now = new Date().toISOString();
  const all = await db.select().from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.sent, false)));

  const due = all.filter(r => r.remindAt <= now && (!r.snoozedUntil || r.snoozedUntil <= now));
  res.json({ success: true, data: due });
}));

// POST /api/reminders
router.post("/", validate(schemas.createReminder), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, message, remindAt, repeatRule, sourceType, sourceId, channel } = req.body;

  const result = await db.insert(reminders).values({
    userId,
    title: title.trim(),
    message: message?.trim() || null,
    remindAt,
    repeatRule: repeatRule || null,
    sourceType: sourceType || "custom",
    sourceId: sourceId || null,
    channel: channel || "web_push",
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

// PUT /api/reminders/:id
router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.message !== undefined) updates.message = req.body.message;
  if (req.body.remindAt !== undefined) updates.remindAt = req.body.remindAt;
  if (req.body.repeatRule !== undefined) updates.repeatRule = req.body.repeatRule;
  if (req.body.sent !== undefined) updates.sent = req.body.sent;
  if (req.body.channel !== undefined) updates.channel = req.body.channel;

  const result = await db.update(reminders).set(updates).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("Reminder"); }

  res.json({ success: true, data: result[0] });
}));

// POST /api/reminders/:id/snooze
router.post("/:id/snooze", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const { duration } = req.body; // minutes
  const mins = parseInt(duration) || 15;
  const snoozedUntil = new Date(Date.now() + mins * 60 * 1000).toISOString();

  const result = await db.update(reminders).set({
    snoozedUntil,
    sent: false,
    updatedAt: new Date().toISOString(),
  }).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning();

  if (!result[0]) { throw new NotFoundError("Reminder"); }
  res.json({ success: true, data: result[0] });
}));

// DELETE /api/reminders/:id
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const result = await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("Reminder"); }
  res.json({ success: true });
}));

export default router;
