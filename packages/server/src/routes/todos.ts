import { Router } from "express";
import { db } from "../db/index.js";
import { todos } from "../db/schema.js";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const router = Router();

/** Check if status column exists in DB (cached) */
let hasStatusColumn: boolean | null = null;
async function checkStatusColumn() {
  if (hasStatusColumn !== null) return hasStatusColumn;
  try {
    await db.execute(sql`SELECT status FROM todos LIMIT 0`);
    hasStatusColumn = true;
  } catch {
    hasStatusColumn = false;
    logger.warn("todos.status column not found - running in compatibility mode. Run DB migration to add it.");
  }
  return hasStatusColumn;
}

/** Derive a status field from DB row for backward compatibility */
function withStatus(row: Record<string, unknown>) {
  const status = row.status || (row.completed ? "completed" : "active");
  return { ...row, status };
}

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const filter = req.query.filter as string | undefined;
  const hasStatus = await checkStatusColumn();
  let result;

  if (filter === "completed") {
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, true))).orderBy(desc(todos.updatedAt));
  } else if (filter === "active" && hasStatus) {
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false), eq(todos.status, "active"))).orderBy(asc(todos.sortOrder));
  } else if (filter === "waiting" && hasStatus) {
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.status, "waiting"))).orderBy(asc(todos.sortOrder));
  } else if (filter === "active" || filter === "waiting") {
    // Fallback: no status column, return all non-completed
    result = await db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.completed, false))).orderBy(asc(todos.sortOrder));
  } else {
    result = await db.select().from(todos).where(eq(todos.userId, userId)).orderBy(asc(todos.sortOrder), desc(todos.createdAt));
  }

  res.json({ success: true, data: result.map(withStatus) });
}));

router.post("/", validate(schemas.createTodo), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, priority, category, dueDate, parentId, status } = req.body;
  const hasStatus = await checkStatusColumn();

  const validStatuses = ["waiting", "active", "completed"];
  const todoStatus = validStatuses.includes(status) ? status : "active";
  const completed = todoStatus === "completed";
  const progress = todoStatus === "completed" ? 100 : 0;

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
    .from(todos)
    .where(eq(todos.userId, userId));

  const values: Record<string, unknown> = {
    userId,
    title: title.trim(),
    priority: priority || "medium",
    category: category || "personal",
    dueDate: dueDate || null,
    parentId: parentId || null,
    sortOrder: (maxOrder[0]?.max || 0) + 1,
    completed,
    progress,
  };
  if (hasStatus) {
    values.status = todoStatus;
  }

  const result = await db.insert(todos).values(values as typeof todos.$inferInsert).returning();

  res.status(201).json({ success: true, data: withStatus(result[0]) });
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

router.put("/:id/status", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const { status } = req.body;
  const hasStatus = await checkStatusColumn();

  const validStatuses = ["waiting", "active", "completed"];
  if (!status || !validStatuses.includes(status)) {
    throw new ValidationError("Status must be one of: waiting, active, completed");
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (hasStatus) {
    updates.status = status;
  }

  if (status === "completed") {
    updates.completed = true;
    updates.progress = 100;
  } else if (status === "active") {
    updates.completed = false;
  } else if (status === "waiting") {
    updates.completed = false;
    updates.progress = 0;
  }

  const result = await db.update(todos).set(updates).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }

  res.json({ success: true, data: withStatus(result[0]) });
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

  // Handle status field
  if (req.body.status !== undefined) {
    const hasStatus = await checkStatusColumn();
    const validStatuses = ["waiting", "active", "completed"];
    if (validStatuses.includes(req.body.status)) {
      if (hasStatus) updates.status = req.body.status;
      if (req.body.status === "completed") {
        updates.completed = true;
        updates.progress = 100;
      } else if (req.body.status === "active") {
        updates.completed = false;
        // keep current progress
      } else if (req.body.status === "waiting") {
        updates.completed = false;
        updates.progress = 0;
      }
    }
  }

  const result = await db.update(todos).set(updates).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }

  res.json({ success: true, data: withStatus(result[0]) });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const result = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }
  res.json({ success: true, data: withStatus(result[0]) });
}));

export default router;
