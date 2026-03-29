import { Router } from "express";
import { db } from "../db/index.js";
import { todos } from "../db/schema.js";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";

const router = Router();

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const filter = req.query.filter as string | undefined;
  let result;

  if (filter === "completed") {
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, true))).orderBy(desc(todos.updatedAt));
  } else if (filter === "active") {
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))).orderBy(asc(todos.sortOrder));
  } else {
    result = await db.select().from(todos).where(eq(todos.userId, userId)).orderBy(asc(todos.sortOrder), desc(todos.createdAt));
  }

  res.json({ success: true, data: result });
}));

router.post("/", validate(schemas.createTodo), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, priority, category, dueDate, parentId } = req.body;

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
    .from(todos)
    .where(eq(todos.userId, userId));

  const result = await db.insert(todos).values({
    userId,
    title: title.trim(),
    priority: priority || "medium",
    category: category || "personal",
    dueDate: dueDate || null,
    parentId: parentId || null,
    sortOrder: (maxOrder[0]?.max || 0) + 1,
  }).returning();

  res.status(201).json({ success: true, data: result[0] });
}));

router.put("/reorder", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { items } = req.body;
  if (!Array.isArray(items)) {
    throw new ValidationError("Items array is required");
  }

  for (const item of items) {
    await db.update(todos)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
      .where(and(eq(todos.id, item.id), eq(todos.userId, userId)));
  }

  res.json({ success: true });
}));

router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.completed !== undefined) updates.completed = req.body.completed;
  if (req.body.priority !== undefined) updates.priority = req.body.priority;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
  if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
  if (req.body.progress !== undefined) updates.progress = req.body.progress;

  const result = await db.update(todos).set(updates).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }

  res.json({ success: true, data: result[0] });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const result = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }
  res.json({ success: true, data: result[0] });
}));

export default router;
