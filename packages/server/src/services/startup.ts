import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../lib/logger.js';
import { initTelegramBot } from '../telegram/bot.js';
import type { Env } from '../lib/env.js';
const __dirname = path.dirname(fileURLToPath(new URL('../index.js', import.meta.url)));
export function startTelegram(env: Env) {
  // Initialize Telegram bot only in production (prevents polling conflict with local dev)
  if (env.NODE_ENV === 'production') {
    initTelegramBot()
      .then(() => logger.info('Telegram bot initialization complete'))
      .catch((err) => logger.error('Telegram bot init failed', { error: (err as Error).message }));

    // Notify admins that server started (deploy notification is handled by CI)
    setTimeout(async () => {
      try {
        const { db } = await import('../db/index.js');
        const { users, telegramConfig } = await import('../db/schema.js');
        const { eq, and } = await import('drizzle-orm');
        const { getTelegramBot } = await import('../telegram/bot.js');
        const bot = getTelegramBot();
        if (!bot) return;

        const fs = await import('fs');

        // Read version
        const versionPath = path.join(__dirname, '../../shared/version.json');
        let version = 'unknown';
        try {
          version = JSON.parse(fs.readFileSync(versionPath, 'utf-8')).version;
        } catch {
          /* Version is optional during local startup. */
        }

        const koTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        const msg = `✅ *TimeBox v${version}* 서버 시작 완료\n⏰ ${koTime}`;

        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
        for (const admin of admins) {
          const [conf] = await db
            .select()
            .from(telegramConfig)
            .where(and(eq(telegramConfig.userId, admin.id), eq(telegramConfig.active, true)));
          if (conf?.chatId) {
            await bot.sendMessage(conf.chatId, msg, { parse_mode: 'Markdown' });
          }
        }
        logger.info('Server start notification sent to admins');
      } catch (e) {
        logger.error('Failed to notify admins', { error: (e as Error).message });
      }
    }, 5000);
  } else {
    logger.info('Telegram bot skipped in dev mode (set NODE_ENV=production to enable)');
  }
}
