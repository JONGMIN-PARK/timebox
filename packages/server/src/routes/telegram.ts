import { Router } from "express";
import { db } from "../db/index.js";
import { telegramConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getTelegramBot } from "../telegram/bot.js";

const router = Router();

// GET /api/telegram/config
router.get("/config", async (req, res) => {
  try {
    const config = await db.select().from(telegramConfig).limit(1);
    res.json({ success: true, data: config[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch telegram config" });
  }
});

// PUT /api/telegram/config
router.put("/config", async (req, res) => {
  try {
    const { chatId, dailyBriefingTime, active } = req.body;
    const config = await db.select().from(telegramConfig).limit(1);

    if (config.length === 0) {
      const result = await db.insert(telegramConfig).values({
        chatId: chatId || null,
        dailyBriefingTime: dailyBriefingTime || null,
        active: active !== undefined ? active : true,
      }).returning();
      res.json({ success: true, data: result[0] });
    } else {
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (chatId !== undefined) updates.chatId = chatId;
      if (dailyBriefingTime !== undefined) updates.dailyBriefingTime = dailyBriefingTime;
      if (active !== undefined) updates.active = active;

      const result = await db.update(telegramConfig)
        .set(updates)
        .where(eq(telegramConfig.id, config[0].id))
        .returning();
      res.json({ success: true, data: result[0] });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update telegram config" });
  }
});

// POST /api/telegram/test
router.post("/test", async (req, res) => {
  try {
    const bot = getTelegramBot();
    if (!bot) {
      res.status(400).json({ success: false, error: "Telegram bot not initialized" });
      return;
    }

    const config = await db.select().from(telegramConfig).limit(1);
    if (!config[0]?.chatId) {
      res.status(400).json({ success: false, error: "Chat ID not configured" });
      return;
    }

    bot.sendMessage(config[0].chatId, "🔔 TimeBox 테스트 메시지입니다!");
    res.json({ success: true, data: { sent: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to send test message" });
  }
});

export default router;
