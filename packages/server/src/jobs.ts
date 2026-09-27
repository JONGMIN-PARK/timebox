import cron from 'node-cron';
import { logger } from './lib/logger.js';
import { KST_TIMEZONE } from './lib/kst.js';
import { sendDueTelegramReminders } from './services/telegramReminders.js';

export function startJobs() {
  const jobs: cron.ScheduledTask[] = [];
  // Check for due reminders every minute and send Telegram notifications
  jobs.push(
    cron.schedule('* * * * *', async () => {
      try {
        await sendDueTelegramReminders();
      } catch (error) {
        logger.error('Reminder cron failed', { error: (error as Error).message });
      }
    }),
  );

  // Check for due note reminders every minute; fire once (realtime + Telegram), then clear.
  jobs.push(
    cron.schedule('* * * * *', async () => {
      try {
        const { db } = await import('./db/index.js');
        const { notes, telegramConfig } = await import('./db/schema.js');
        const { eq, and, lte, isNotNull, isNull } = await import('drizzle-orm');
        const { getTelegramBot } = await import('./telegram/bot.js');
        const { emitToUser } = await import('./socket/index.js');

        const now = new Date().toISOString();
        const due = await db
          .select()
          .from(notes)
          .where(and(isNotNull(notes.remindAt), lte(notes.remindAt, now), isNull(notes.trashedAt)));

        if (due.length === 0) return;
        logger.info('Due note reminders found', { count: due.length });

        const bot = getTelegramBot();
        for (const n of due) {
          // Clear the reminder first so it never double-fires.
          await db.update(notes).set({ remindAt: null }).where(eq(notes.id, n.id));
          const title = n.title || (n.content ? n.content.split('\n')[0].slice(0, 60) : '메모');
          emitToUser(n.userId, 'note:reminder', { id: n.id, title });
          if (bot) {
            const conf = await db
              .select()
              .from(telegramConfig)
              .where(eq(telegramConfig.userId, n.userId));
            if (conf[0]?.chatId && conf[0]?.active) {
              const msg = `🔔 *메모 리마인더*\n\n📝 *${title}*${n.content ? `\n${n.content.slice(0, 200)}` : ''}`;
              try {
                await bot.sendMessage(conf[0].chatId, msg, { parse_mode: 'Markdown' });
              } catch (e) {
                logger.error('Telegram note reminder failed', { error: (e as Error).message });
              }
            }
          }
        }
      } catch (err) {
        logger.error('Note reminder cron failed', { error: (err as Error).message });
      }
    }),
  );

  // Auto-cleanup: permanently delete soft-deleted messages older than 30 days (runs daily at 3 AM KST)
  jobs.push(
    cron.schedule(
      '0 3 * * *',
      async () => {
        try {
          const { db } = await import('./db/index.js');
          const { chatMessages, messages } = await import('./db/schema.js');
          const { and, eq, lte } = await import('drizzle-orm');

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const cutoffStr = cutoff.toISOString();

          await db
            .delete(chatMessages)
            .where(and(eq(chatMessages.deleted, true), lte(chatMessages.createdAt, cutoffStr)));

          await db
            .delete(messages)
            .where(and(eq(messages.deleted, true), lte(messages.createdAt, cutoffStr)));

          logger.info('Cleanup: removed old deleted messages');
        } catch (err) {
          logger.error('Cleanup cron failed', { error: (err as Error).message });
        }
      },
      { timezone: KST_TIMEZONE },
    ),
  );

  return () => jobs.forEach((job) => job.stop());
}
