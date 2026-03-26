import { Router } from "express";
import { db } from "../db/index.js";
import { timeBlocks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /api/timeblocks?date=2026-03-26
router.get("/", (req, res) => {
  try {
    const { date } = req.query;
    let result;

    if (date) {
      result = db
        .select()
        .from(timeBlocks)
        .where(eq(timeBlocks.date, date as string))
        .all();
    } else {
      result = db.select().from(timeBlocks).all();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch time blocks" });
  }
});

// POST /api/timeblocks
router.post("/", (req, res) => {
  try {
    const { date, startTime, endTime, title, category, color } = req.body;
    if (!date || !startTime || !endTime || !title?.trim()) {
      res.status(400).json({ success: false, error: "date, startTime, endTime, title are required" });
      return;
    }

    const result = db.insert(timeBlocks).values({
      date,
      startTime,
      endTime,
      title: title.trim(),
      category: category || "other",
      color: color || null,
      completed: false,
    }).returning().get();

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create time block" });
  }
});

// PUT /api/timeblocks/:id
router.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.date !== undefined) updates.date = req.body.date;
    if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
    if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.completed !== undefined) updates.completed = req.body.completed;

    const result = db.update(timeBlocks).set(updates).where(eq(timeBlocks.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Time block not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update time block" });
  }
});

// DELETE /api/timeblocks/:id
router.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.delete(timeBlocks).where(eq(timeBlocks.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Time block not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete time block" });
  }
});

export default router;
