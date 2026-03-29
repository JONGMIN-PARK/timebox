import { Router } from "express";
import { db } from "../db/index.js";
import { inboxMessages, users, telegramConfig, teamGroupMembers } from "../db/schema.js";
import { eq, and, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { getTelegramBot } from "../telegram/bot.js";
import { emitToUser, emitInboxUpdate } from "../socket/index.js";
import { getUserMap } from "../lib/userEnrichment.js";
import { PAGINATION, TELEGRAM_PARSE_MODE } from "../lib/constants.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { logger } from "../lib/logger.js";
import { ValidationError, ForbiddenError } from "../lib/errors.js";

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

/** After one side purges, delete row if both sides have purged. */
async function deleteInboxRowIfFullyPurged(messageId: number): Promise<{ fromUserId: number; toUserId: number } | null> {
  const [r] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, messageId));
  if (!r) return null;
  if (r.toUserPurgedAt && r.fromUserPurgedAt) {
    await db.delete(inboxMessages).where(eq(inboxMessages.id, messageId));
    return { fromUserId: r.fromUserId, toUserId: r.toUserId };
  }
  return null;
}

const router = Router();

// ── List helpers (received) ──
async function listReceived(userId: number, trashedOnly: boolean) {
  const visibility = trashedOnly
    ? and(
        eq(inboxMessages.toUserId, userId),
        isNull(inboxMessages.toUserPurgedAt),
        isNotNull(inboxMessages.toUserTrashedAt),
      )
    : and(
        eq(inboxMessages.toUserId, userId),
        isNull(inboxMessages.toUserPurgedAt),
        isNull(inboxMessages.toUserTrashedAt),
      );

  const msgs = await db
    .select()
    .from(inboxMessages)
    .where(visibility)
    .orderBy(desc(inboxMessages.createdAt))
    .limit(PAGINATION.INBOX);

  const senderIds = [...new Set(msgs.map((m) => m.fromUserId))];
  const senderMap = await getUserMap(senderIds);
  return msgs.map((m) => ({
    ...m,
    fromName: senderMap.get(m.fromUserId) || "System",
  }));
}

// ── List helpers (sent) ──
async function listSent(userId: number, trashedOnly: boolean) {
  const visibility = trashedOnly
    ? and(
        eq(inboxMessages.fromUserId, userId),
        isNull(inboxMessages.fromUserPurgedAt),
        isNotNull(inboxMessages.fromUserTrashedAt),
      )
    : and(
        eq(inboxMessages.fromUserId, userId),
        isNull(inboxMessages.fromUserPurgedAt),
        isNull(inboxMessages.fromUserTrashedAt),
      );

  const msgs = await db
    .select()
    .from(inboxMessages)
    .where(visibility)
    .orderBy(desc(inboxMessages.createdAt))
    .limit(PAGINATION.INBOX);

  const recipientIds = [...new Set(msgs.map((m) => m.toUserId))];
  const recipientMap = await getUserMap(recipientIds);
  return msgs.map((m) => ({
    ...m,
    toName: recipientMap.get(m.toUserId) || "Unknown",
  }));
}

// GET / — inbox (not trashed)
router.get("/", asyncHandler<AuthRequest>(async (req, res) => {
  const data = await listReceived(req.userId!, false);
  res.json({ success: true, data });
}));

// GET /trash — received trash
router.get("/trash", asyncHandler<AuthRequest>(async (req, res) => {
  const data = await listReceived(req.userId!, true);
  res.json({ success: true, data });
}));

// GET /sent/trash — sent trash (before /sent if Express order matters: register explicit path first)
router.get("/sent/trash", asyncHandler<AuthRequest>(async (req, res) => {
  const data = await listSent(req.userId!, true);
  res.json({ success: true, data });
}));

// GET /sent — sent (not trashed)
router.get("/sent", asyncHandler<AuthRequest>(async (req, res) => {
  const data = await listSent(req.userId!, false);
  res.json({ success: true, data });
}));

// GET /unread-count
router.get("/unread-count", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const msgs = await db
    .select()
    .from(inboxMessages)
    .where(
      and(
        eq(inboxMessages.toUserId, userId),
        eq(inboxMessages.read, false),
        isNull(inboxMessages.toUserTrashedAt),
        isNull(inboxMessages.toUserPurgedAt),
      ),
    );
  res.json({ success: true, data: { count: msgs.length } });
}));

// POST / — send
router.post("/", asyncHandler<AuthRequest>(async (req, res) => {
  const fromUserId = req.userId!;
  const { toUserId, subject, content, type, relatedProjectId, relatedTaskId } = req.body;
  if (!toUserId || !subject?.trim() || !content?.trim()) {
    throw new ValidationError("toUserId, subject, and content are required");
  }

  const senderRows = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, fromUserId));
  const fromName = senderRows[0]?.displayName || senderRows[0]?.username || "Unknown";

  const result = await db
    .insert(inboxMessages)
    .values({
      fromUserId,
      toUserId,
      subject: subject.trim(),
      content: content.trim(),
      type: type || "message",
      relatedProjectId: relatedProjectId || null,
      relatedTaskId: relatedTaskId || null,
    })
    .returning();

  emitToUser(toUserId, "inbox:new-message", { message: result[0], fromName });
  emitInboxUpdate(toUserId);
  if (fromUserId !== toUserId) emitInboxUpdate(fromUserId);
  notifyViaTelegram(toUserId, fromName, subject.trim(), content.trim()).catch((e) =>
    logger.error("Telegram notify failed", { error: (e as Error).message }),
  );

  res.status(201).json({ success: true, data: result[0] });
}));

// POST /bulk-trash — soft-delete (move to trash) for current user
router.post("/bulk-trash", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("ids array required");
  }
  const now = new Date().toISOString();
  for (const raw of ids) {
    const id = typeof raw === "number" ? raw : safeParseId(String(raw));
    if (!id) continue;
    const [row] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id));
    if (!row) continue;
    if (row.toUserId === userId && !row.toUserPurgedAt && !row.toUserTrashedAt) {
      await db
        .update(inboxMessages)
        .set({ toUserTrashedAt: now })
        .where(eq(inboxMessages.id, id));
    } else if (row.fromUserId === userId && !row.fromUserPurgedAt && !row.fromUserTrashedAt) {
      await db
        .update(inboxMessages)
        .set({ fromUserTrashedAt: now })
        .where(eq(inboxMessages.id, id));
    }
  }
  emitInboxUpdate(userId);
  res.json({ success: true });
}));

// POST /bulk-purge — permanent delete from trash
router.post("/bulk-purge", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("ids array required");
  }
  const now = new Date().toISOString();
  const othersToNotify = new Set<number>();

  for (const raw of ids) {
    const id = typeof raw === "number" ? raw : safeParseId(String(raw));
    if (!id) continue;
    const [row] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id));
    if (!row) continue;
    if (row.toUserId === userId) {
      if (!row.toUserTrashedAt || row.toUserPurgedAt) continue;
      await db.update(inboxMessages).set({ toUserPurgedAt: now }).where(eq(inboxMessages.id, id));
      othersToNotify.add(row.fromUserId);
    } else if (row.fromUserId === userId) {
      if (!row.fromUserTrashedAt || row.fromUserPurgedAt) continue;
      await db.update(inboxMessages).set({ fromUserPurgedAt: now }).where(eq(inboxMessages.id, id));
      othersToNotify.add(row.toUserId);
    }
    const removed = await deleteInboxRowIfFullyPurged(id);
    if (removed) {
      emitInboxUpdate(removed.fromUserId);
      emitInboxUpdate(removed.toUserId);
      othersToNotify.delete(removed.fromUserId);
      othersToNotify.delete(removed.toUserId);
    }
  }

  emitInboxUpdate(userId);
  othersToNotify.forEach((uid) => emitInboxUpdate(uid));
  res.json({ success: true });
}));

// PUT /read-all
router.put("/read-all", asyncHandler<AuthRequest>(async (req, res) => {
  await db
    .update(inboxMessages)
    .set({ read: true })
    .where(
      and(
        eq(inboxMessages.toUserId, req.userId!),
        eq(inboxMessages.read, false),
        isNull(inboxMessages.toUserTrashedAt),
        isNull(inboxMessages.toUserPurgedAt),
      ),
    );
  emitInboxUpdate(req.userId!);
  res.json({ success: true });
}));

// PUT /:id/read
router.put("/:id/read", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) {
    throw new ValidationError("Invalid ID");
  }

  await db
    .update(inboxMessages)
    .set({ read: true })
    .where(and(eq(inboxMessages.id, id), eq(inboxMessages.toUserId, req.userId!)));
  emitInboxUpdate(req.userId!);
  res.json({ success: true });
}));

// GET /users
router.get("/users", asyncHandler<AuthRequest>(async (req, res) => {
  const userId = req.userId!;

  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));

  if (me?.role === "admin") {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(eq(users.active, true));
    res.json({ success: true, data: allUsers.filter((u) => u.id !== userId) });
    return;
  }

  const myGroups = await db
    .select({ groupId: teamGroupMembers.groupId })
    .from(teamGroupMembers)
    .where(eq(teamGroupMembers.userId, userId));
  const myGroupIds = myGroups.map((g) => g.groupId);

  if (myGroupIds.length === 0) {
    const admins = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.active, true), eq(users.role, "admin")));
    res.json({ success: true, data: admins.filter((u) => u.id !== userId) });
    return;
  }

  const groupMembers = await db
    .select({ userId: teamGroupMembers.userId })
    .from(teamGroupMembers)
    .where(inArray(teamGroupMembers.groupId, myGroupIds));
  const memberIds = [...new Set(groupMembers.map((m) => m.userId))];

  const adminUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.active, true), eq(users.role, "admin")));
  const allIds = [...new Set([...memberIds, ...adminUsers.map((a) => a.id)])];

  const contactableUsers = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.id, allIds)));

  res.json({ success: true, data: contactableUsers.filter((u) => u.id !== userId) });
}));

// POST /:id/restore — undo trash (must not be purged)
router.post("/:id/restore", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) {
    throw new ValidationError("Invalid ID");
  }
  const userId = req.userId!;
  const [row] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id));
  if (!row) {
    throw new ValidationError("Not found");
  }
  if (row.toUserId === userId && row.toUserTrashedAt && !row.toUserPurgedAt) {
    await db.update(inboxMessages).set({ toUserTrashedAt: null }).where(eq(inboxMessages.id, id));
  } else if (row.fromUserId === userId && row.fromUserTrashedAt && !row.fromUserPurgedAt) {
    await db.update(inboxMessages).set({ fromUserTrashedAt: null }).where(eq(inboxMessages.id, id));
  } else {
    throw new ForbiddenError("Cannot restore this message");
  }
  emitInboxUpdate(userId);
  res.json({ success: true });
}));

// POST /:id/purge — permanent from trash
router.post("/:id/purge", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) {
    throw new ValidationError("Invalid ID");
  }
  const userId = req.userId!;
  const now = new Date().toISOString();
  const [row] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id));
  if (!row) {
    throw new ValidationError("Not found");
  }

  let otherUserId: number | null = null;
  if (row.toUserId === userId) {
    if (!row.toUserTrashedAt || row.toUserPurgedAt) {
      throw new ValidationError("Message must be in trash first");
    }
    await db.update(inboxMessages).set({ toUserPurgedAt: now }).where(eq(inboxMessages.id, id));
    otherUserId = row.fromUserId;
  } else if (row.fromUserId === userId) {
    if (!row.fromUserTrashedAt || row.fromUserPurgedAt) {
      throw new ValidationError("Message must be in trash first");
    }
    await db.update(inboxMessages).set({ fromUserPurgedAt: now }).where(eq(inboxMessages.id, id));
    otherUserId = row.toUserId;
  } else {
    throw new ForbiddenError("Not your message");
  }

  const removed = await deleteInboxRowIfFullyPurged(id);
  if (removed) {
    emitInboxUpdate(removed.fromUserId);
    emitInboxUpdate(removed.toUserId);
  } else {
    emitInboxUpdate(userId);
    if (otherUserId != null) emitInboxUpdate(otherUserId);
  }
  res.json({ success: true });
}));

// DELETE /:id — move to trash (soft) for recipient or sender
router.delete("/:id", asyncHandler<AuthRequest>(async (req, res) => {
  const id = safeParseId(req.params.id);
  if (!id) {
    throw new ValidationError("Invalid ID");
  }
  const userId = req.userId!;
  const now = new Date().toISOString();
  const [row] = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id));
  if (!row) {
    throw new ValidationError("Not found");
  }
  if (row.toUserId === userId && !row.toUserPurgedAt && !row.toUserTrashedAt) {
    await db.update(inboxMessages).set({ toUserTrashedAt: now }).where(eq(inboxMessages.id, id));
  } else if (row.fromUserId === userId && !row.fromUserPurgedAt && !row.fromUserTrashedAt) {
    await db.update(inboxMessages).set({ fromUserTrashedAt: now }).where(eq(inboxMessages.id, id));
  } else {
    throw new ForbiddenError("Cannot delete this message");
  }
  emitInboxUpdate(userId);
  res.json({ success: true });
}));

export default router;
