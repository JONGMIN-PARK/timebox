import { Router } from "express";
import { db } from "../db/index.js";
import { telegramConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { getTelegramBot, getTelegramBotUsername } from "../telegram/bot.js";
import { type AuthRequest } from "../middleware/auth.js";
import crypto from "crypto";
import { linkCodes } from "../lib/telegramLink.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";

const router = Router();

// GET /api/telegram/config — get MY telegram config
router.get("/config", asyncHandler<AuthRequest>(async (req, res) => {
  const config = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
  res.json({ success: true, data: config[0] || null });
}));

// POST /api/telegram/generate-link — generate a unique link code for this user
router.post("/generate-link", asyncHandler<AuthRequest>(async (req, res) => {
  const code = crypto.randomBytes(4).toString("hex"); // 8-char hex code

  // Store the link code in memory (temporary, expires in 10 minutes)
  linkCodes.set(code, { userId: req.userId!, createdAt: Date.now() });

  // Clean up old codes (older than 10 minutes)
  for (const [k, v] of linkCodes.entries()) {
    if (Date.now() - v.createdAt > 10 * 60 * 1000) linkCodes.delete(k);
  }

  const botName = getTelegramBotUsername();
  const deepLink = botName ? `https://t.me/${botName}?start=link_${code}` : null;
  res.json({ success: true, data: { code, deepLink, instruction: `텔레그램 봇에서 /link ${code} 를 입력하세요` } });
}));

// POST /api/telegram/unlink — disconnect telegram
router.post("/unlink", asyncHandler<AuthRequest>(async (req, res) => {
  await db.delete(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
  res.json({ success: true });
}));

// POST /api/telegram/test — send test message to MY telegram
router.post("/test", asyncHandler<AuthRequest>(async (req, res) => {
  const bot = getTelegramBot();
  if (!bot) { throw new ValidationError("Telegram bot not initialized"); }

  const config = await db.select().from(telegramConfig).where(eq(telegramConfig.userId, req.userId!));
  if (!config[0]?.chatId) { throw new ValidationError("Telegram not linked"); }

  await bot.sendMessage(config[0].chatId, "🔔 TimeBox 테스트 메시지입니다!");
  res.json({ success: true });
}));

export default router;
