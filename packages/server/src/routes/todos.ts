import { Router } from "express";
import { db } from "../db/index.js";
import { todos } from "../db/schema.js";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    console.error("todos:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch todos" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { title, priority, category, dueDate, parentId } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: "Title is required" });
      return;
    }

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
  } catch (error) {
    console.error("todos:create", error);
    res.status(500).json({ success: false, error: "Failed to create todo" });
  }
});

router.put("/reorder", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: "Items array is required" });
      return;
    }

    for (const item of items) {
      await db.update(todos)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
        .where(and(eq(todos.id, item.id), eq(todos.userId, userId)));
    }

    res.json({ success: true });
  } catch (error) {
    console.error("todos:reorder", error);
    res.status(500).json({ success: false, error: "Failed to reorder todos" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.completed !== undefined) updates.completed = req.body.completed;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
    if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;

    const result = await db.update(todos).set(updates).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
    if (!result[0]) {
      res.status(404).json({ success: false, error: "Todo not found" });
      return;
    }

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("todos:update", error);
    res.status(500).json({ success: false, error: "Failed to update todo" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const result = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId))).returning();
    if (!result[0]) {
      res.status(404).json({ success: false, error: "Todo not found" });
      return;
    }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("todos:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete todo" });
  }
});

export default router;
