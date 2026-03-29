import { Router } from "express";
import { db } from "../db/index.js";
import { messages, users } from "../db/schema.js";
import { eq, and, desc, lt, inArray } from "drizzle-orm";
import { projectMemberMiddleware, type ProjectRequest } from "../middleware/projectAuth.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError, NotFoundError, ForbiddenError } from "../lib/errors.js";

const router = Router();

// All routes require project membership
router.use("/:projectId/messages", projectMemberMiddleware);

// GET /api/projects/:projectId/messages?channel=general&limit=50&before=id
router.get("/:projectId/messages", asyncHandler<ProjectRequest>(async (req, res) => {
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
  const senderIds = [...new Set(result.map(m => m.senderId))];
  const senderUsers = senderIds.length > 0
    ? await db.select({ id: users.id, displayName: users.displayName, username: users.username }).from(users).where(inArray(users.id, senderIds))
    : [];
  const userMap = new Map(senderUsers.map(u => [u.id, u.displayName || u.username]));

  const data = result.map(m => ({
    ...m,
    content: m.deleted ? "" : m.content,
    senderName: m.deleted ? "" : (userMap.get(m.senderId) || "Unknown"),
  }));

  // Return in chronological order
  data.reverse();

  res.json({ success: true, data });
}));

// POST /api/projects/:projectId/messages
router.post("/:projectId/messages", asyncHandler<ProjectRequest>(async (req, res) => {
  const { content, channel, type, replyTo } = req.body;
  if (!content?.trim()) {
    throw new ValidationError("Content is required");
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
}));

// DELETE /:projectId/messages/:messageId - Delete own message
router.delete("/:projectId/messages/:messageId", asyncHandler<ProjectRequest>(async (req, res) => {
  const messageId = parseInt(req.params.messageId as string);
  if (isNaN(messageId)) {
    throw new ValidationError("Invalid message ID");
  }

  const [msg] = await db.select().from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.projectId, req.projectId!)));

  if (!msg) {
    throw new NotFoundError("Message");
  }

  if (msg.senderId !== req.userId!) {
    throw new ForbiddenError("Can only delete your own messages");
  }

  await db.update(messages).set({ deleted: true })
    .where(eq(messages.id, messageId));

  res.json({ success: true, data: { deleted: true } });
}));

export default router;
