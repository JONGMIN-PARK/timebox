import { Router } from "express";
import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";

const router = Router();

// GET /api/events?start=&end=
router.get("/", (req, res) => {
  try {
    const { start, end } = req.query;
    let result;

    if (start && end) {
      result = db
        .select()
        .from(events)
        .where(and(gte(events.startTime, start as string), lte(events.endTime, end as string)))
        .all();
    } else {
      result = db.select().from(events).all();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

// POST /api/events
router.post("/", (req, res) => {
  try {
    const { title, description, startTime, endTime, allDay, categoryId, recurrenceRule, color } = req.body;
    if (!title?.trim() || !startTime || !endTime) {
      res.status(400).json({ success: false, error: "Title, startTime, endTime are required" });
      return;
    }

    const result = db.insert(events).values({
      title: title.trim(),
      description: description || null,
      startTime,
      endTime,
      allDay: allDay || false,
      categoryId: categoryId || null,
      recurrenceRule: recurrenceRule || null,
      color: color || "#3b82f6",
    }).returning().get();

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create event" });
  }
});

// PUT /api/events/:id
router.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
    if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
    if (req.body.allDay !== undefined) updates.allDay = req.body.allDay;
    if (req.body.categoryId !== undefined) updates.categoryId = req.body.categoryId;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const result = db.update(events).set(updates).where(eq(events.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update event" });
  }
});

// DELETE /api/events/:id
router.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.delete(events).where(eq(events.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete event" });
  }
});

export default router;
