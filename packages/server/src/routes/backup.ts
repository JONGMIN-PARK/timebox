import { Router } from "express";
import { db } from "../db/index.js";
import { todos, events, ddays, timeBlocks } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/backup/export — download all user data as JSON
router.get("/export", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    const data = {
      exportedAt: new Date().toISOString(),
      version: 1,
      todos: await db.select().from(todos).where(eq(todos.userId, userId)),
      events: await db.select().from(events).where(eq(events.userId, userId)),
      ddays: await db.select().from(ddays).where(eq(ddays.userId, userId)),
      timeBlocks: await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=timebox-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json({ success: true, data });
  } catch (error) {
    console.error("backup:export", error);
    res.status(500).json({ success: false, error: "Failed to export data" });
  }
});

// POST /api/backup/import — restore user data from JSON
router.post("/import", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { data, mode } = req.body;

    if (!data || !data.version) {
      res.status(400).json({ success: false, error: "Invalid backup data" });
      return;
    }

    const merge = mode !== "replace";
    let imported = { todos: 0, events: 0, ddays: 0, timeBlocks: 0 };

    // If replace mode, delete existing data first
    if (!merge) {
      await db.delete(todos).where(eq(todos.userId, userId));
      await db.delete(events).where(eq(events.userId, userId));
      await db.delete(ddays).where(eq(ddays.userId, userId));
      await db.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
    }

    // Import todos
    if (data.todos && Array.isArray(data.todos)) {
      for (const t of data.todos) {
        await db.insert(todos).values({
          userId,
          title: t.title,
          completed: t.completed || false,
          priority: t.priority || "medium",
          category: t.category || "personal",
          dueDate: t.dueDate || null,
          sortOrder: t.sortOrder || 0,
          parentId: t.parentId || null,
        });
        imported.todos++;
      }
    }

    // Import events
    if (data.events && Array.isArray(data.events)) {
      for (const e of data.events) {
        await db.insert(events).values({
          userId,
          title: e.title,
          description: e.description || null,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: e.allDay || false,
          categoryId: null,
          color: e.color || "#3b82f6",
        });
        imported.events++;
      }
    }

    // Import ddays
    if (data.ddays && Array.isArray(data.ddays)) {
      for (const d of data.ddays) {
        await db.insert(ddays).values({
          userId,
          title: d.title,
          targetDate: d.targetDate,
          color: d.color || "#3b82f6",
          icon: d.icon || null,
        });
        imported.ddays++;
      }
    }

    // Import timeBlocks
    if (data.timeBlocks && Array.isArray(data.timeBlocks)) {
      for (const b of data.timeBlocks) {
        await db.insert(timeBlocks).values({
          userId,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.title,
          category: b.category || "other",
          color: b.color || null,
          completed: b.completed || false,
        });
        imported.timeBlocks++;
      }
    }

    res.json({ success: true, data: { imported } });
  } catch (error) {
    console.error("backup:import", error);
    res.status(500).json({ success: false, error: "Failed to import data" });
  }
});

export default router;
