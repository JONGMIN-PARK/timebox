import { Router } from "express";
import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

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
  const { title, description, startTime, endTime, allDay, categoryId, recurrenceRule, color } = req.body;

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

  const result = await db.update(events).set(updates).where(and(eq(events.id, id), eq(events.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Event");
  }

  res.json({ success: true, data: result[0] });
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
