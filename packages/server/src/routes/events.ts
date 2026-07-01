import { Router } from "express";
import { db } from "../db/index.js";
import { events, users, inboxMessages } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import { resolveOptionalProjectId } from "../lib/projectAccess.js";
import { emitToUser, emitInboxUpdate } from "../socket/index.js";

const router = Router();

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { start, end } = req.query;
  let result;

  if (start && end) {
    result = await db.select().from(events)
      .where(and(eq(events.userId, userId), gte(events.startTime, start as string), lte(events.endTime, end as string)));
  } else {
    result = await db.select().from(events).where(eq(events.userId, userId));
  }

  res.json({ success: true, data: result });
}));

router.post("/", validate(schemas.createEvent), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, description, startTime, endTime, allDay, categoryId, recurrenceRule, color, projectId: bodyProjectId } = req.body;

  const projectId = await resolveOptionalProjectId(userId, bodyProjectId);

  const result = await db.insert(events).values({
    userId,
    title: title.trim(),
    description: description || null,
    startTime,
    endTime,
    allDay: allDay || false,
    categoryId: categoryId || null,
    recurrenceRule: recurrenceRule || null,
    color: color || "#3b82f6",
    projectId,
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.description !== undefined) updates.description = req.body.description;
  if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
  if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
  if (req.body.allDay !== undefined) updates.allDay = req.body.allDay;
  if (req.body.categoryId !== undefined) updates.categoryId = req.body.categoryId;
  if (req.body.color !== undefined) updates.color = req.body.color;
  if (req.body.recurrenceRule !== undefined) updates.recurrenceRule = req.body.recurrenceRule;
  if (req.body.projectId !== undefined) {
    updates.projectId = await resolveOptionalProjectId(userId, req.body.projectId);
  }

  const result = await db.update(events).set(updates).where(and(eq(events.id, id), eq(events.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Event");
  }

  res.json({ success: true, data: result[0] });
}));

// POST /api/events/:id/forward — copy an event into another user's calendar
router.post("/:id/forward", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) throw new ValidationError("Invalid ID");
  const fromUserId = req.userId!;
  const targetId = Number(req.body.toUserId);
  if (!targetId || Number.isNaN(targetId)) throw new ValidationError("toUserId is required");
  if (targetId === fromUserId) throw new ValidationError("Cannot forward to yourself");

  const [event] = await db.select().from(events).where(and(eq(events.id, id), eq(events.userId, fromUserId)));
  if (!event) throw new NotFoundError("Event");
  const [target] = await db.select().from(users).where(and(eq(users.id, targetId), eq(users.active, true)));
  if (!target) throw new NotFoundError("Recipient");

  // Copy into the recipient's calendar. Category/project reference the sender's
  // own records, so drop them — keep the human-visible fields and the color.
  const [copy] = await db
    .insert(events)
    .values({
      userId: targetId,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      categoryId: null,
      recurrenceRule: event.recurrenceRule,
      color: event.color,
      projectId: null,
    })
    .returning();

  // Notify the recipient via their inbox.
  const [sender] = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, fromUserId));
  const fromName = sender?.displayName || sender?.username || "Someone";
  const when = event.allDay ? event.startTime.slice(0, 10) : `${event.startTime.slice(0, 10)} ${event.startTime.slice(11, 16)}`;
  const [msg] = await db
    .insert(inboxMessages)
    .values({
      fromUserId,
      toUserId: targetId,
      subject: `📅 ${fromName}님이 일정을 보냈습니다`,
      content: `${event.title}\n🗓 ${when}`,
      type: "system",
    })
    .returning();
  emitToUser(targetId, "inbox:new-message", { message: msg, fromName });
  emitInboxUpdate(targetId);
  // Nudge the recipient's calendar to refresh if they have it open.
  emitToUser(targetId, "events:updated", { reason: "forward" });

  res.status(201).json({ success: true, data: copy });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }
  const userId = req.userId!;
  const result = await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Event");
  }
  res.json({ success: true, data: result[0] });
}));

export default router;
