import { Router } from "express";
import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { start, end } = req.query;
    let result;

    if (start && end) {
      result = db.select().from(events)
        .where(and(eq(events.userId, userId), gte(events.startTime, start as string), lte(events.endTime, end as string)))
        .all();
    } else {
      result = db.select().from(events).where(eq(events.userId, userId)).all();
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch events" });
  }
});

router.post("/", (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { title, description, startTime, endTime, allDay, categoryId, recurrenceRule, color } = req.body;
    if (!title?.trim() || !startTime || !endTime) {
      res.status(400).json({ success: false, error: "Title, startTime, endTime are required" });
      return;
    }

    const result = db.insert(events).values({
      userId,
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

router.put("/:id", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
    if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
    if (req.body.allDay !== undefined) updates.allDay = req.body.allDay;
    if (req.body.categoryId !== undefined) updates.categoryId = req.body.categoryId;
    if (req.body.color !== undefined) updates.color = req.body.color;

    const result = db.update(events).set(updates).where(and(eq(events.id, id), eq(events.userId, userId))).returning().get();
    if (!result) {
      res.status(404).json({ success: false, error: "Event not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update event" });
  }
});

router.delete("/:id", (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const result = db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId))).returning().get();
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
