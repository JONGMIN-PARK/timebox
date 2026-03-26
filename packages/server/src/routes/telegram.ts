import { Router } from "express";
import { db } from "../db/index.js";
import { telegramConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getTelegramBot } from "../telegram/bot.js";

const router = Router();

// GET /api/telegram/config
router.get("/config", (req, res) => {
  try {
    const config = db.select().from(telegramConfig).limit(1).all();
    res.json({ success: true, data: config[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch telegram config" });
  }
});

// PUT /api/telegram/config
router.put("/config", (req, res) => {
  try {
    const { chatId, dailyBriefingTime, active } = req.body;
    const config = db.select().from(telegramConfig).limit(1).all();

    if (config.length === 0) {
      const result = db.insert(telegramConfig).values({
        chatId: chatId || null,
        dailyBriefingTime: dailyBriefingTime || null,
        active: active !== undefined ? active : true,
      }).returning().get();
      res.json({ success: true, data: result });
    } else {
      const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (chatId !== undefined) updates.chatId = chatId;
      if (dailyBriefingTime !== undefined) updates.dailyBriefingTime = dailyBriefingTime;
      if (active !== undefined) updates.active = active;

      const result = db.update(telegramConfig)
        .set(updates)
        .where(eq(telegramConfig.id, config[0].id))
        .returning().get();
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update telegram config" });
  }
});

// POST /api/telegram/test
router.post("/test", (req, res) => {
  try {
    const bot = getTelegramBot();
    if (!bot) {
      res.status(400).json({ success: false, error: "Telegram bot not initialized" });
      return;
    }

    const config = db.select().from(telegramConfig).limit(1).all();
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
