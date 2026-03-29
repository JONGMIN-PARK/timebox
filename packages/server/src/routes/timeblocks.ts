import { Router } from "express";
import { db } from "../db/index.js";
import { timeBlocks, timeBlockTemplates } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const router = Router();

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { date } = req.query;
  const result = date
    ? await db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, date as string)))
    : await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
  res.json({ success: true, data: result });
}));

router.post("/", validate(schemas.createTimeBlock), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { date, startTime, endTime, title, category, color, notes, meta } = req.body;
  const result = await db.insert(timeBlocks).values({
    userId, date, startTime, endTime, title: title.trim(),
    category: category || "other", color: color || null,
    notes: notes?.trim() || null,
    meta: typeof meta === "string" && meta.trim() ? meta.trim() : null,
    completed: false,
  }).returning();
  res.status(201).json({ success: true, data: result[0] });
}));

router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (req.body.date !== undefined) updates.date = req.body.date;
  if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
  if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.color !== undefined) updates.color = req.body.color;
  if (req.body.completed !== undefined) updates.completed = req.body.completed;
  if (req.body.notes !== undefined) updates.notes = req.body.notes === null || req.body.notes === "" ? null : String(req.body.notes).trim();
  if (req.body.meta !== undefined) updates.meta = req.body.meta === null || req.body.meta === "" ? null : String(req.body.meta).trim();

  const result = await db.update(timeBlocks).set(updates).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("Time block"); }
  res.json({ success: true, data: result[0] });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }
  const userId = req.userId!;
  const result = await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("Time block"); }
  res.json({ success: true, data: result[0] });
}));

// ── Templates ──

router.get("/templates", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db.select().from(timeBlockTemplates).where(eq(timeBlockTemplates.userId, userId));
  res.json({ success: true, data: result });
}));

router.post("/templates", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { name, blocks: blockData } = req.body;
  if (!name?.trim()) { throw new ValidationError("Name required"); }

  const result = await db.insert(timeBlockTemplates).values({
    userId, name: name.trim(), blocks: JSON.stringify(blockData || []),
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

router.post("/templates/:id/apply", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  const { date } = req.body;
  if (!date) { throw new ValidationError("Date required"); }

  const templates = await db.select().from(timeBlockTemplates).where(and(eq(timeBlockTemplates.id, id), eq(timeBlockTemplates.userId, userId)));
  const template = templates[0];
  if (!template) { throw new NotFoundError("Template"); }

  const blockData = JSON.parse(template.blocks) as Array<{ startTime: string; endTime: string; title: string; category: string; color: string }>;

  const created = blockData.length > 0 ? await db.insert(timeBlocks).values(blockData.map(b => ({
    userId, date, startTime: b.startTime, endTime: b.endTime,
    title: b.title, category: b.category || "other", color: b.color || null,
    notes: null, meta: null, completed: false,
  }))).returning() : [];

  res.json({ success: true, data: created });
}));

router.delete("/templates/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  await db.delete(timeBlockTemplates).where(and(eq(timeBlockTemplates.id, id), eq(timeBlockTemplates.userId, userId)));
  res.json({ success: true });
}));

export default router;
