import { Router } from "express";
import { db } from "../db/index.js";
import { todos } from "../db/schema.js";
import { eq, asc, desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/todos
router.get("/", (req, res) => {
  try {
    const filter = req.query.filter as string | undefined;
    let result;

    if (filter === "completed") {
      result = db.select().from(todos).where(eq(todos.completed, true)).orderBy(desc(todos.updatedAt)).all();
    } else if (filter === "active") {
      result = db.select().from(todos).where(eq(todos.completed, false)).orderBy(asc(todos.sortOrder)).all();
    } else {
      result = db.select().from(todos).orderBy(asc(todos.sortOrder), desc(todos.createdAt)).all();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch todos" });
  }
});

// POST /api/todos
router.post("/", (req, res) => {
  try {
    const { title, priority, dueDate, parentId } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: "Title is required" });
      return;
    }

    // Get max sort order
    const maxOrder = db
      .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(todos)
      .get();

    const result = db.insert(todos).values({
      title: title.trim(),
      priority: priority || "medium",
      dueDate: dueDate || null,
      parentId: parentId || null,
      sortOrder: (maxOrder?.max || 0) + 1,
    }).returning().get();

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create todo" });
  }
});

// PUT /api/todos/:id
router.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.completed !== undefined) updates.completed = req.body.completed;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate;
    if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;

    const result = db.update(todos).set(updates).where(eq(todos.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Todo not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update todo" });
  }
});

// DELETE /api/todos/:id
router.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.delete(todos).where(eq(todos.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Todo not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete todo" });
  }
});

// PUT /api/todos/reorder
router.put("/reorder", (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ success: false, error: "Items array is required" });
      return;
    }

    for (const item of items) {
      db.update(todos)
        .set({ sortOrder: item.sortOrder, updatedAt: new Date().toISOString() })
        .where(eq(todos.id, item.id))
        .run();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to reorder todos" });
  }
});

export default router;
