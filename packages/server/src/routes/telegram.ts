import { Router } from "express";
import { db } from "../db/index.js";
import { telegramConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getTelegramBot } from "../telegram/bot.js";
import { type AuthRequest } from "../middleware/auth.js";
import crypto from "crypto";
import { linkCodes } from "../lib/telegramLink.js";

const router = Router();

// GET /api/telegram/config — get MY telegram config
router.get("/config", async (req: AuthRequest, res) => {
  try {
    const config = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
    res.json({ success: true, data: config[0] || null });
  } catch (error) {
    console.error("telegram:getConfig", error);
    res.status(500).json({ success: false, error: "Failed to fetch telegram config" });
  }
});

// POST /api/telegram/generate-link — generate a unique link code for this user
router.post("/generate-link", async (req: AuthRequest, res) => {
  try {
    const code = crypto.randomBytes(4).toString("hex"); // 8-char hex code

    // Store the link code in memory (temporary, expires in 10 minutes)
    linkCodes.set(code, { userId: req.userId!, createdAt: Date.now() });

    // Clean up old codes (older than 10 minutes)
    for (const [k, v] of linkCodes.entries()) {
      if (Date.now() - v.createdAt > 10 * 60 * 1000) linkCodes.delete(k);
    }

    res.json({ success: true, data: { code, instruction: `텔레그램 봇에서 /link ${code} 를 입력하세요` } });
  } catch (error) {
    console.error("telegram:generateLink", error);
    res.status(500).json({ success: false, error: "Failed to generate link code" });
  }
});

// POST /api/telegram/unlink — disconnect telegram
router.post("/unlink", async (req: AuthRequest, res) => {
  try {
    await db.delete(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
    res.json({ success: true });
  } catch (error) {
    console.error("telegram:unlink", error);
    res.status(500).json({ success: false, error: "Failed to unlink" });
  }
});

// POST /api/telegram/test — send test message to MY telegram
router.post("/test", async (req: AuthRequest, res) => {
  try {
    const bot = getTelegramBot();
    if (!bot) { res.status(400).json({ success: false, error: "Telegram bot not initialized" }); return; }

    const config = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
    if (!config[0]?.chatId) { res.status(400).json({ success: false, error: "Telegram not linked" }); return; }

    await bot.sendMessage(config[0].chatId, "🔔 TimeBox 테스트 메시지입니다!");
    res.json({ success: true });
  } catch (error) {
    console.error("telegram:test", error);
    res.status(500).json({ success: false, error: "Failed to send test message" });
  }
});

export default router;
