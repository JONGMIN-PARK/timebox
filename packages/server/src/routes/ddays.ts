import { Router } from "express";
import { db } from "../db/index.js";
import { ddays } from "../db/schema.js";
import { eq, and, asc } from "drizzle-orm";
import { type AuthRequest } from "../middleware/auth.js";

const router = Router();

function calcDaysLeft(targetDate: string): number {
  const target = new Date(targetDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await db.select().from(ddays).where(eq(ddays.userId, userId)).orderBy(asc(ddays.targetDate));
    const withDaysLeft = result.map((d) => ({ ...d, daysLeft: calcDaysLeft(d.targetDate) }));
    res.json({ success: true, data: withDaysLeft });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch ddays" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { title, targetDate, color, icon } = req.body;
    if (!title?.trim() || !targetDate) {
      res.status(400).json({ success: false, error: "Title and targetDate are required" });
      return;
    }
    const result = await db.insert(ddays).values({ userId, title: title.trim(), targetDate, color: color || "#3b82f6", icon: icon || null }).returning();
    res.json({ success: true, data: { ...result[0], daysLeft: calcDaysLeft(result[0].targetDate) } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to create dday" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.targetDate !== undefined) updates.targetDate = req.body.targetDate;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;

    const result = await db.update(ddays).set(updates).where(and(eq(ddays.id, id), eq(ddays.userId, userId))).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "D-Day not found" }); return; }
    res.json({ success: true, data: { ...result[0], daysLeft: calcDaysLeft(result[0].targetDate) } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update dday" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.userId!;
    const result = await db.delete(ddays).where(and(eq(ddays.id, id), eq(ddays.userId, userId))).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "D-Day not found" }); return; }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to delete dday" });
  }
});

export default router;
