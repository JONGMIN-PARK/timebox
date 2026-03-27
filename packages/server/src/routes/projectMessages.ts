import { Router } from "express";
import { db } from "../db/index.js";
import { messages, users } from "../db/schema.js";
import { eq, and, desc, lt } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";

const router = Router();

// All routes require project membership
router.use("/:projectId/messages", projectMemberMiddleware);

// GET /api/projects/:projectId/messages?channel=general&limit=50&before=id
router.get("/:projectId/messages", async (req: ProjectRequest, res) => {
  try {
    const channel = (req.query.channel as string) || "general";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = parseInt(req.query.before as string);

    const conditions = [
      eq(messages.projectId, req.projectId!),
      eq(messages.channel, channel),
    ];

    if (!isNaN(before) && before > 0) {
      conditions.push(lt(messages.id, before));
    }

    const result = await db.select().from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.id))
      .limit(limit);

    // Attach sender names
    const allUsers = await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users);
    const userMap = new Map(allUsers.map(u => [u.id, u.displayName || u.username]));

    const data = result.map(m => ({
      ...m,
      senderName: userMap.get(m.senderId) || "Unknown",
    }));

    // Return in chronological order
    data.reverse();

    res.json({ success: true, data });
  } catch (error) {
    console.error("projectMessages:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

// POST /api/projects/:projectId/messages
router.post("/:projectId/messages", async (req: ProjectRequest, res) => {
  try {
    const { content, channel, type, replyTo } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ success: false, error: "Content is required" });
      return;
    }

    const result = await db.insert(messages).values({
      projectId: req.projectId!,
      senderId: req.userId!,
      content: content.trim(),
      channel: channel || "general",
      type: type || "text",
      replyTo: replyTo || null,
    }).returning();

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("projectMessages:send", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

export default router;
