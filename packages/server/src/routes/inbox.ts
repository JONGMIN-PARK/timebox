import { Router } from "express";
import { db } from "../db/index.js";
import { inboxMessages, users, telegramConfig } from "../db/schema.js";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { type AuthRequest, safeParseId } from "../middleware/auth.js";
import { getTelegramBot } from "../telegram/bot.js";

// Send Telegram notification for inbox message
async function notifyViaTelegram(toUserId: number, fromName: string, subject: string, content: string) {
  try {
    const bot = getTelegramBot();
    if (!bot) return;
    const conf = await db.select().from(telegramConfig).limit(1);
    const chatId = conf[0]?.chatId;
    if (!chatId) return;
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;
    const msg = `📬 *새 메시지*\n\n👤 보낸 사람: *${fromName}*\n📌 제목: ${subject}\n\n${preview}`;
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  } catch (e) {
    console.error("telegram-inbox-notify:", e);
  }
}

const router = Router();

// GET / — list my inbox messages
router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const msgs = await db.select().from(inboxMessages)
      .where(eq(inboxMessages.toUserId, userId))
      .orderBy(desc(inboxMessages.createdAt))
      .limit(100);

    // Attach sender names
    const senderIds = [...new Set(msgs.map(m => m.fromUserId))];
    const senders = senderIds.length > 0
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName })
          .from(users).where(inArray(users.id, senderIds))
      : [];
    const senderMap = new Map(senders.map(s => [s.id, s.displayName || s.username]));

    const data = msgs.map(m => ({
      ...m,
      fromName: senderMap.get(m.fromUserId) || "System",
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("inbox:list", error);
    res.status(500).json({ success: false, error: "Failed to fetch inbox" });
  }
});

// GET /sent — list my sent messages
router.get("/sent", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const msgs = await db.select().from(inboxMessages)
      .where(eq(inboxMessages.fromUserId, userId))
      .orderBy(desc(inboxMessages.createdAt))
      .limit(100);

    const recipientIds = [...new Set(msgs.map(m => m.toUserId))];
    const recipients = recipientIds.length > 0
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName })
          .from(users).where(inArray(users.id, recipientIds))
      : [];
    const recipientMap = new Map(recipients.map(r => [r.id, r.displayName || r.username]));

    const data = msgs.map(m => ({
      ...m,
      toName: recipientMap.get(m.toUserId) || "Unknown",
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error("inbox:sent", error);
    res.status(500).json({ success: false, error: "Failed to fetch sent messages" });
  }
});

// GET /unread-count — get unread message count
router.get("/unread-count", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const msgs = await db.select().from(inboxMessages)
      .where(and(eq(inboxMessages.toUserId, userId), eq(inboxMessages.read, false)));
    res.json({ success: true, data: { count: msgs.length } });
  } catch (error) {
    console.error("inbox:unreadCount", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

// POST / — send a message
router.post("/", async (req: AuthRequest, res) => {
  try {
    const fromUserId = req.userId!;
    const { toUserId, subject, content, type, relatedProjectId, relatedTaskId } = req.body;
    if (!toUserId || !subject?.trim() || !content?.trim()) {
      res.status(400).json({ success: false, error: "toUserId, subject, and content are required" });
      return;
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

    // Send Telegram notification (async, non-blocking)
    notifyViaTelegram(toUserId, fromName, subject.trim(), content.trim());

    res.status(201).json({ success: true, data: result[0] });
  } catch (error) {
    console.error("inbox:send", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

// PUT /:id/read — mark as read
router.put("/:id/read", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    await db.update(inboxMessages).set({ read: true })
      .where(and(eq(inboxMessages.id, id), eq(inboxMessages.toUserId, req.userId!)));
    res.json({ success: true });
  } catch (error) {
    console.error("inbox:markRead", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

// PUT /read-all — mark all as read
router.put("/read-all", async (req: AuthRequest, res) => {
  try {
    await db.update(inboxMessages).set({ read: true })
      .where(and(eq(inboxMessages.toUserId, req.userId!), eq(inboxMessages.read, false)));
    res.json({ success: true });
  } catch (error) {
    console.error("inbox:markAllRead", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

// DELETE /:id — delete a message
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = safeParseId(req.params.id);
    if (!id) { res.status(400).json({ success: false, error: "Invalid ID" }); return; }

    await db.delete(inboxMessages)
      .where(and(eq(inboxMessages.id, id), eq(inboxMessages.toUserId, req.userId!)));
    res.json({ success: true });
  } catch (error) {
    console.error("inbox:delete", error);
    res.status(500).json({ success: false, error: "Failed" });
  }
});

export default router;
