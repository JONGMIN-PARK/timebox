import { Router } from "express";
import { db } from "../db/index.js";
import { ddays } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { NotFoundError } from "../lib/errors.js";
import { calcDaysLeft } from "../lib/kst.js";

const router = Router();

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const result = await db.select().from(ddays).where(eq(ddays.userId, userId)).orderBy(asc(ddays.targetDate));
  const withDaysLeft = result.map((d) => ({ ...d, daysLeft: calcDaysLeft(d.targetDate) }));
  res.json({ success: true, data: withDaysLeft });
}));

router.post("/", validate(schemas.createDDay), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, targetDate, color, icon } = req.body;
  const result = await db.insert(ddays).values({ userId, title: title.trim(), targetDate, color: color || "#3b82f6", icon: icon || null }).returning();
  res.json({ success: true, data: { ...result[0], daysLeft: calcDaysLeft(result[0].targetDate) } });
}));

router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.targetDate !== undefined) updates.targetDate = req.body.targetDate;
  if (req.body.color !== undefined) updates.color = req.body.color;
  if (req.body.icon !== undefined) updates.icon = req.body.icon;

  const result = await db.update(ddays).set(updates).where(and(eq(ddays.id, id), eq(ddays.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("D-Day"); }
  res.json({ success: true, data: { ...result[0], daysLeft: calcDaysLeft(result[0].targetDate) } });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const result = await db.delete(ddays).where(and(eq(ddays.id, id), eq(ddays.userId, userId))).returning();
  if (!result[0]) { throw new NotFoundError("D-Day"); }
  res.json({ success: true, data: result[0] });
}));

export default router;
