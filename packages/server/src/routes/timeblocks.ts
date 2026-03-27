import { Router } from "express";
import { db } from "../db/index.js";
import { timeBlocks, timeBlockTemplates } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { date } = req.query;
    const result = date
      ? await db.select().from(timeBlocks).where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.date, date as string)))
      : await db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("timeblocks:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch time blocks" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { date, startTime, endTime, title, category, color } = req.body;
    if (!date || !startTime || !endTime || !title?.trim()) {
      res.status(400).json({ success: false, error: "date, startTime, endTime, title are required" });
      return;
    }
    const result = await db.insert(timeBlocks).values({ userId, date, startTime, endTime, title: title.trim(), category: category || "other", color: color || null, completed: false }).returning();
    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("timeblocks:create", error);
    res.status(500).json({ success: false, error: "Failed to create time block" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }
    const userId = req.userId!;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (req.body.date !== undefined) updates.date = req.body.date;
    if (req.body.startTime !== undefined) updates.startTime = req.body.startTime;
    if (req.body.endTime !== undefined) updates.endTime = req.body.endTime;
    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.color !== undefined) updates.color = req.body.color;
    if (req.body.completed !== undefined) updates.completed = req.body.completed;

    const result = await db.update(timeBlocks).set(updates).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "Time block not found" }); return; }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("timeblocks:update", error);
    res.status(500).json({ success: false, error: "Failed to update time block" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }
    const userId = req.userId!;
    const result = await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId))).returning();
    if (!result[0]) { res.status(404).json({ success: false, error: "Time block not found" }); return; }
    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error("timeblocks:delete", error);
    res.status(500).json({ success: false, error: "Failed to delete time block" });
  }
});

// ── Templates ──

router.get("/templates", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await db.select().from(timeBlockTemplates).where(eq(timeBlockTemplates.userId, userId));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("timeblocks:listTemplates", error);
    res.status(500).json({ success: false, error: "Failed to fetch templates" });
  }
});

router.post("/templates", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, blocks: blockData } = req.body;
    if (!name?.trim()) { res.status(400).json({ success: false, error: "Name required" }); return; }

    const result = await db.insert(timeBlockTemplates).values({
      userId, name: name.trim(), blocks: JSON.stringify(blockData || []),
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("timeblocks:createTemplate", error);
    res.status(500).json({ success: false, error: "Failed to save template" });
  }
});

router.post("/templates/:id/apply", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    const { date } = req.body;
    if (!date) { res.status(400).json({ success: false, error: "Date required" }); return; }

    const templates = await db.select().from(timeBlockTemplates).where(and(eq(timeBlockTemplates.id, id), eq(timeBlockTemplates.userId, userId)));
    const template = templates[0];
    if (!template) { res.status(404).json({ success: false, error: "Template not found" }); return; }

    const blockData = JSON.parse(template.blocks) as Array<{ startTime: string; endTime: string; title: string; category: string; color: string }>;
    const created: any[] = [];

    for (const b of blockData) {
      const result = await db.insert(timeBlocks).values({
        userId, date, startTime: b.startTime, endTime: b.endTime,
        title: b.title, category: b.category || "other", color: b.color || null, completed: false,
      }).returning();
      created.push(result[0]);
    }

    res.json({ success: true, data: created });
  } catch (error) {
    console.error("timeblocks:applyTemplate", error);
    res.status(500).json({ success: false, error: "Failed to apply template" });
  }
});

router.delete("/templates/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    await db.delete(timeBlockTemplates).where(and(eq(timeBlockTemplates.id, id), eq(timeBlockTemplates.userId, userId)));
    res.json({ success: true });
  } catch (error) {
    console.error("timeblocks:deleteTemplate", error);
    res.status(500).json({ success: false, error: "Failed to delete template" });
  }
});

export default router;
