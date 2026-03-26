import { Router } from "express";
import { db } from "../db/index.js";
import { ddays } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";

const router = Router();

function calcDaysLeft(targetDate: string): number {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// GET /api/ddays
router.get("/", (req, res) => {
  try {
    const result = db.select().from(ddays).orderBy(asc(ddays.targetDate)).all();
    const withDaysLeft = result.map((d) => ({
      ...d,
      daysLeft: calcDaysLeft(d.targetDate),
    }));

    res.json({ success: true, data: withDaysLeft });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch ddays" });
  }
});

// POST /api/ddays
router.post("/", (req, res) => {
  try {
    const { title, targetDate, color, icon } = req.body;
    if (!title?.trim() || !targetDate) {
      res.status(400).json({ success: false, error: "Title and targetDate are required" });
      return;
    }

    const result = db.insert(ddays).values({
      title: title.trim(),
      targetDate,
      color: color || "#3b82f6",
      icon: icon || null,
    }).returning().get();

    res.json({
      success: true,
      data: { ...result, daysLeft: calcDaysLeft(result.targetDate) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create dday" });
  }
});

// PUT /api/ddays/:id
router.put("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.targetDate !== undefined) updates.targetDate = req.body.targetDate;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;

    const result = db.update(ddays).set(updates).where(eq(ddays.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "D-Day not found" });
      return;
    }

    res.json({
      success: true,
      data: { ...result, daysLeft: calcDaysLeft(result.targetDate) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update dday" });
  }
});

// DELETE /api/ddays/:id
router.delete("/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.delete(ddays).where(eq(ddays.id, id)).returning().get();

    if (!result) {
      res.status(404).json({ success: false, error: "D-Day not found" });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete dday" });
  }
});

export default router;
