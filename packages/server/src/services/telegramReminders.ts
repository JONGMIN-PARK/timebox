import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reminders, telegramConfig } from '../db/schema.js';
import { getTelegramBot } from '../telegram/bot.js';
import { logger } from '../lib/logger.js';
import { deliverDueTelegramReminders } from './reminderDelivery.js';

export async function sendDueTelegramReminders() {
  const bot = getTelegramBot();
  if (!bot) return;
  await deliverDueTelegramReminders(
    {
      claimDue: (now, leaseBefore, token) =>
        db
          .update(reminders)
          .set({ telegramClaimToken: token, telegramClaimedAt: now })
          .where(
            and(
              eq(reminders.sent, false),
              inArray(reminders.channel, ['telegram', 'both']),
              lte(reminders.remindAt, now),
              or(isNull(reminders.snoozedUntil), lte(reminders.snoozedUntil, now)),
              isNull(reminders.telegramDeliveredAt),
              or(
                isNull(reminders.telegramClaimedAt),
                lte(reminders.telegramClaimedAt, leaseBefore),
              ),
            ),
          )
          .returning(),
      send: async (reminder) => {
        const [config] = await db
          .select()
          .from(telegramConfig)
          .where(and(eq(telegramConfig.userId, reminder.userId), eq(telegramConfig.active, true)));
        if (!config?.chatId) return false;
        // Plain text avoids invalid Markdown from user-entered titles and messages.
        await bot.sendMessage(
          config.chatId,
          `🔔 리마인더\n\n⏰ ${reminder.title}${reminder.message ? `\n${reminder.message}` : ''}\n\n${new Date(reminder.remindAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        );
        return true;
      },
      delivered: async (id, token, at) => {
        await db
          .update(reminders)
          .set({ telegramDeliveredAt: at, telegramClaimedAt: null, telegramClaimToken: null })
          .where(and(eq(reminders.id, id), eq(reminders.telegramClaimToken, token)));
      },
      release: async (id, token) => {
        await db
          .update(reminders)
          .set({ telegramClaimedAt: null, telegramClaimToken: null })
          .where(and(eq(reminders.id, id), eq(reminders.telegramClaimToken, token)));
      },
      report: (error, reminderId) =>
        logger.error('Telegram reminder failed', {
          reminderId,
          error: error instanceof Error ? error.message : String(error),
        }),
    },
    randomUUID(),
  );
}
