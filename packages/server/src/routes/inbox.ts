import { Router } from "express";
import { db } from "../db/index.js";
import { inboxMessages, users, telegramConfig, teamGroupMembers } from "../db/schema.js";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { getTelegramBot } from "../telegram/bot.js";
import { emitToUser, emitInboxUpdate } from "../socket/index.js";
import { getUserMap } from "../lib/userEnrichment.js";
import { PAGINATION, TELEGRAM_PARSE_MODE } from "../lib/constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { logger } from "../lib/logger.js";
import { ValidationError } from "../lib/errors.js";

// Send Telegram notification for inbox message
async function notifyViaTelegram(toUserId: number, fromName: string, subject: string, content: string) {
  try {
    const bot = getTelegramBot();
    if (!bot) return;
    const conf = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, toUserId));
    if (!conf[0]?.chatId || !conf[0]?.active) return;
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;
    const msg = `📬 *새 메시지*\n\n👤 보낸 사람: *${fromName}*\n📌 제목: ${subject}\n\n${preview}`;
    await bot.sendMessage(conf[0].chatId, msg, { parse_mode: TELEGRAM_PARSE_MODE });
  } catch (e) {
    logger.error("Telegram inbox notification failed", { toUserId, error: (e as Error).message });
  }
}

const router = Router();

// GET / — list my inbox messages
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const msgs = await db.select().from(inboxMessages)
    .where(eq(inboxMessages.toUserId, userId))
    .orderBy(desc(inboxMessages.createdAt))
    .limit(PAGINATION.INBOX);

  // Attach sender names
  const senderIds = [...new Set(msgs.map(m => m.fromUserId))];
  const senderMap = await getUserMap(senderIds);

  const data = msgs.map(m => ({
    ...m,
    fromName: senderMap.get(m.fromUserId) || "System",
  }));

  res.json({ success: true, data });
}));

// GET /sent — list my sent messages
router.get("/sent", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const msgs = await db.select().from(inboxMessages)
    .where(eq(inboxMessages.fromUserId, userId))
    .orderBy(desc(inboxMessages.createdAt))
    .limit(PAGINATION.INBOX);

  const recipientIds = [...new Set(msgs.map(m => m.toUserId))];
  const recipientMap = await getUserMap(recipientIds);

  const data = msgs.map(m => ({
    ...m,
    toName: recipientMap.get(m.toUserId) || "Unknown",
  }));

  res.json({ success: true, data });
}));

// GET /unread-count — get unread message count
router.get("/unread-count", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const msgs = await db.select().from(inboxMessages)
    .where(and(eq(inboxMessages.toUserId, userId), eq(inboxMessages.read, false)));
  res.json({ success: true, data: { count: msgs.length } });
}));

// POST / — send a message
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const fromUserId = req.userId!;
  const { toUserId, subject, content, type, relatedProjectId, relatedTaskId } = req.body;
  if (!toUserId || !subject?.trim() || !content?.trim()) {
    throw new ValidationError("toUserId, subject, and content are required");
  }

  // Get sender name
  const senderRows = await db.select({ displayName: users.displayName, username: users.username })
    .from(users).where(eq(users.id, fromUserId));
  const fromName = senderRows[0]?.displayName || senderRows[0]?.username || "Unknown";

  const result = await db.insert(inboxMessages).values({
    fromUserId,
    toUserId,
    subject: subject.trim(),
    content: content.trim(),
    type: type || "message",
    relatedProjectId: relatedProjectId || null,
    relatedTaskId: relatedTaskId || null,
  }).returning();

  // Notify recipient via socket
  emitToUser(toUserId, "inbox:new-message", { message: result[0], fromName });
  emitInboxUpdate(toUserId);

  // Send Telegram notification (async, non-blocking)
  notifyViaTelegram(toUserId, fromName, subject.trim(), content.trim()).catch(e => logger.error("Telegram notify failed", { error: (e as Error).message }));

  res.status(201).json({ success: true, data: result[0] });
}));

// PUT /:id/read — mark as read
router.put("/:id/read", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  await db.update(inboxMessages).set({ read: true })
    .where(and(eq(inboxMessages.id, id), eq(inboxMessages.toUserId, req.userId!)));
  emitInboxUpdate(req.userId!);
  res.json({ success: true });
}));

// PUT /read-all — mark all as read
router.put("/read-all", asyncHandler<AuthRequest>(async (req, res) => {
  await db.update(inboxMessages).set({ read: true })
    .where(and(eq(inboxMessages.toUserId, req.userId!), eq(inboxMessages.read, false)));
  emitInboxUpdate(req.userId!);
  res.json({ success: true });
}));

// GET /users — list users I can communicate with (filtered by team group)
router.get("/users", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  // Get current user's role
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));

  if (me?.role === "admin") {
    // Admins can see all active users
    const allUsers = await db.select({
      id: users.id, username: users.username, displayName: users.displayName, role: users.role,
    }).from(users).where(eq(users.active, true));
    res.json({ success: true, data: allUsers.filter(u => u.id !== userId) });
    return;
  }

  // Get my group IDs
  const myGroups = await db.select({ groupId: teamGroupMembers.groupId })
    .from(teamGroupMembers).where(eq(teamGroupMembers.userId, userId));
  const myGroupIds = myGroups.map(g => g.groupId);

  if (myGroupIds.length === 0) {
    // Not in any group - can only see admins
    const admins = await db.select({
      id: users.id, username: users.username, displayName: users.displayName, role: users.role,
    }).from(users).where(and(eq(users.active, true), eq(users.role, "admin")));
    res.json({ success: true, data: admins.filter(u => u.id !== userId) });
    return;
  }

  // Get all users in my groups
  const groupMembers = await db.select({ userId: teamGroupMembers.userId })
    .from(teamGroupMembers).where(inArray(teamGroupMembers.groupId, myGroupIds));
  const memberIds = [...new Set(groupMembers.map(m => m.userId))];

  // Also include all admins
  const adminUsers = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.active, true), eq(users.role, "admin")));
  const allIds = [...new Set([...memberIds, ...adminUsers.map(a => a.id)])];

  const contactableUsers = await db.select({
    id: users.id, username: users.username, displayName: users.displayName, role: users.role,
  }).from(users).where(and(eq(users.active, true), inArray(users.id, allIds)));

  res.json({ success: true, data: contactableUsers.filter(u => u.id !== userId) });
}));

// DELETE /:id — delete a message
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) { throw new ValidationError("Invalid ID"); }

  await db.delete(inboxMessages)
    .where(and(eq(inboxMessages.id, id), eq(inboxMessages.toUserId, req.userId!)));
  emitInboxUpdate(req.userId!);
  res.json({ success: true });
}));

export default router;
