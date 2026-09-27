export interface TelegramReminder {
  id: number;
  userId: number;
  title: string;
  message: string | null;
  remindAt: string;
}
export interface ReminderDelivery {
  claimDue(now: string, leaseBefore: string, token: string): Promise<TelegramReminder[]>;
  send(reminder: TelegramReminder): Promise<boolean>;
  delivered(id: number, token: string, at: string): Promise<void>;
  release(id: number, token: string): Promise<void>;
  report(error: unknown, reminderId: number): void;
}

/** Delivery receipts are independent of user acknowledgement (`sent`). */
export async function deliverDueTelegramReminders(
  delivery: ReminderDelivery,
  token: string,
  now = new Date(),
) {
  const rows = await delivery.claimDue(
    now.toISOString(),
    new Date(now.getTime() - 5 * 60_000).toISOString(),
    token,
  );
  for (const row of rows) {
    try {
      if (await delivery.send(row))
        await delivery.delivered(row.id, token, new Date().toISOString());
      else await delivery.release(row.id, token);
    } catch (error) {
      delivery.report(error, row.id);
      // Keep the lease for the retry delay, including when the receipt write fails.
      // An expired lease is recovered by the next worker pass.
    }
  }
}
