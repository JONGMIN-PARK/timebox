import { Router } from "express";
import { db } from "../db/index.js";
import { todos } from "../db/schema.js";
import { eq, and, asc, desc, sql, isNull, isNotNull } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { resolveOptionalProjectId } from "../lib/projectAccess.js";

const router = Router();

/** Ensure status column exists in DB, auto-migrate if missing */
let statusColumnReady: boolean | null = null;
async function ensureStatusColumn() {
  if (statusColumnReady !== null) return statusColumnReady;
  try {
    await db.execute(sql`SELECT status FROM todos LIMIT 0`);
    statusColumnReady = true;
  } catch {
    logger.warn("todos.status column not found - auto-migrating...");
    try {
      await db.execute(sql`ALTER TABLE todos ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
      await db.execute(sql`UPDATE todos SET status = 'completed' WHERE completed = true`);
      await db.execute(sql`UPDATE todos SET status = 'active' WHERE completed = false`);
      statusColumnReady = true;
      logger.info("todos.status column added and populated successfully");
    } catch (e) {
      logger.error("Failed to auto-migrate status column", { error: String(e) });
      statusColumnReady = false;
    }
  }
  return statusColumnReady;
}

let deletedAtColumnReady: boolean | null = null;
async function ensureDeletedAtColumn() {
  if (deletedAtColumnReady !== null) return deletedAtColumnReady;
  try {
    await db.execute(sql`SELECT deleted_at FROM todos LIMIT 0`);
    deletedAtColumnReady = true;
  } catch {
    logger.warn("todos.deleted_at column not found - auto-migrating...");
    try {
      await db.execute(sql`ALTER TABLE todos ADD COLUMN deleted_at TEXT`);
      deletedAtColumnReady = true;
      logger.info("todos.deleted_at column added successfully");
    } catch (e) {
      logger.error("Failed to auto-migrate deleted_at column", { error: String(e) });
      deletedAtColumnReady = false;
    }
  }
  return deletedAtColumnReady;
}

// Keep backward compat alias
const checkStatusColumn = ensureStatusColumn;

/** Derive a status field from DB row for backward compatibility */
function withStatus(row: Record<string, unknown>) {
  const status = row.status || (row.completed ? "completed" : "active");
  return { ...row, status };
}

/** Non-trashed todos only (when column exists). */
function notTrashed() {
  return isNull(todos.deletedAt);
}

router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const filter = req.query.filter as string | undefined;
  const hasStatus = await checkStatusColumn();
  await ensureDeletedAtColumn();
  let result;

  if (filter === "trash") {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), isNotNull(todos.deletedAt)))
      .orderBy(desc(todos.updatedAt));
  } else if (filter === "completed") {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.completed, true), notTrashed()))
      .orderBy(desc(todos.updatedAt));
  } else if (filter === "active" && hasStatus) {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.completed, false), eq(todos.status, "active"), notTrashed()))
      .orderBy(asc(todos.sortOrder));
  } else if (filter === "waiting" && hasStatus) {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.status, "waiting"), notTrashed()))
      .orderBy(asc(todos.sortOrder));
  } else if (filter === "active" || filter === "waiting") {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), eq(todos.completed, false), notTrashed()))
      .orderBy(asc(todos.sortOrder));
  } else {
    result = await db
      .select()
      .from(todos)
      .where(and(eq(todos.userId, userId), notTrashed()))
      .orderBy(asc(todos.sortOrder), desc(todos.createdAt));
  }

  res.json({ success: true, data: result.map(withStatus) });
}));

router.post("/", validate(schemas.createTodo), asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const { title, priority, category, dueDate, parentId, status, projectId: bodyProjectId } = req.body;
  const hasStatus = await checkStatusColumn();
  await ensureDeletedAtColumn();

  const validStatuses = ["waiting", "active", "completed"];
  const todoStatus = validStatuses.includes(status) ? status : "active";
  const completed = todoStatus === "completed";
  const progress = todoStatus === "completed" ? 100 : 0;

  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
    .from(todos)
    .where(and(eq(todos.userId, userId), notTrashed()));

  const projectId = await resolveOptionalProjectId(userId, bodyProjectId);

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
    projectId,
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
    await db
      .update(todos)
      .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
      .where(and(eq(todos.id, item.id), eq(todos.userId, userId)));
  }

  res.json({ success: true });
}));

/** Permanently delete every todo in trash for this user. */
router.delete("/trash", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDeletedAtColumn();
  const userId = req.userId!;
  const removed = await db
    .delete(todos)
    .where(and(eq(todos.userId, userId), isNotNull(todos.deletedAt)))
    .returning({ id: todos.id });
  res.json({ success: true, data: { count: removed.length } });
}));

router.post("/:id/restore", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDeletedAtColumn();
  const id = parseInt(req.params.id as string, 10);
  const userId = req.userId!;
  if (Number.isNaN(id)) {
    throw new ValidationError("Invalid todo id");
  }

  const existing = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  if (!existing[0]) {
    throw new NotFoundError("Todo");
  }
  if (!existing[0].deletedAt) {
    res.json({ success: true, data: withStatus(existing[0] as Record<string, unknown>) });
    return;
  }

  const result = await db
    .update(todos)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();

  res.json({ success: true, data: withStatus(result[0] as Record<string, unknown>) });
}));

router.delete("/:id/permanent", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDeletedAtColumn();
  const id = parseInt(req.params.id as string, 10);
  const userId = req.userId!;
  if (Number.isNaN(id)) {
    throw new ValidationError("Invalid todo id");
  }

  const existing = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  if (!existing[0]) {
    throw new NotFoundError("Todo");
  }
  if (!existing[0].deletedAt) {
    throw new ValidationError("Todo must be in trash before permanent delete");
  }

  await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  res.json({ success: true, data: withStatus(existing[0] as Record<string, unknown>) });
}));

router.put("/:id/status", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const { status } = req.body;
  const hasStatus = await checkStatusColumn();
  await ensureDeletedAtColumn();

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

  const result = await db
    .update(todos)
    .set(updates)
    .where(and(eq(todos.id, id), eq(todos.userId, userId), notTrashed()))
    .returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }

  res.json({ success: true, data: withStatus(result[0]) });
}));

router.put("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = parseInt(req.params.id as string);
  const userId = req.userId!;
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  await ensureDeletedAtColumn();

  if (req.body.title !== undefined) updates.title = req.body.title.trim();
  if (req.body.completed !== undefined) updates.completed = req.body.completed;
  if (req.body.priority !== undefined) updates.priority = req.body.priority;
  if (req.body.category !== undefined) updates.category = req.body.category;
  if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
  if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
  if (req.body.progress !== undefined) updates.progress = req.body.progress;
  if (req.body.projectId !== undefined) {
    updates.projectId = await resolveOptionalProjectId(userId, req.body.projectId);
  }

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

  const result = await db
    .update(todos)
    .set(updates)
    .where(and(eq(todos.id, id), eq(todos.userId, userId), notTrashed()))
    .returning();
  if (!result[0]) {
    throw new NotFoundError("Todo");
  }

  res.json({ success: true, data: withStatus(result[0]) });
}));

router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  await ensureDeletedAtColumn();
  const id = parseInt(req.params.id as string, 10);
  const userId = req.userId!;
  if (Number.isNaN(id)) {
    throw new ValidationError("Invalid todo id");
  }

  const existing = await db.select().from(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
  if (!existing[0]) {
    throw new NotFoundError("Todo");
  }
  if (existing[0].deletedAt) {
    res.json({ success: true, data: withStatus(existing[0] as Record<string, unknown>) });
    return;
  }

  const now = new Date().toISOString();
  const result = await db
    .update(todos)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();

  res.json({ success: true, data: withStatus(result[0] as Record<string, unknown>) });
}));

export default router;
