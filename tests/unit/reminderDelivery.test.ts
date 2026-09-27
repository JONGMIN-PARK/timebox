import { expect, it, vi } from 'vitest';
import {
  deliverDueTelegramReminders,
  type ReminderDelivery,
} from '../../packages/server/src/services/reminderDelivery';

const reminder = {
  id: 4,
  userId: 1,
  title: 'Focus',
  message: null,
  remindAt: '2026-09-27T00:00:00Z',
};
function delivery() {
  let delivered = false;
  const value: ReminderDelivery = {
    claimDue: vi.fn(async () => (delivered ? [] : [reminder])),
    send: vi.fn(async () => true),
    delivered: vi.fn(async () => {
      delivered = true;
    }),
    release: vi.fn(async () => {}),
    report: vi.fn(),
  };
  return value;
}
it('sends once across repeated worker passes without requiring user acknowledgement', async () => {
  const value = delivery();
  await deliverDueTelegramReminders(value, 'first');
  await deliverDueTelegramReminders(value, 'second');
  expect(value.send).toHaveBeenCalledTimes(1);
  expect(value.delivered).toHaveBeenCalledWith(4, 'first', expect.any(String));
});
it('does not record a successful delivery when Telegram fails', async () => {
  const value = delivery();
  value.send = vi.fn(async () => {
    throw new Error('Telegram unavailable');
  });
  await deliverDueTelegramReminders(value, 'retry');
  expect(value.delivered).not.toHaveBeenCalled();
  expect(value.release).not.toHaveBeenCalled();
  expect(value.report).toHaveBeenCalledWith(expect.any(Error), 4);
});
it('releases a claim when the user has no enabled Telegram destination', async () => {
  const value = delivery();
  value.send = vi.fn(async () => false);
  await deliverDueTelegramReminders(value, 'missing-config');
  expect(value.delivered).not.toHaveBeenCalled();
  expect(value.release).toHaveBeenCalledWith(4, 'missing-config');
});
it('recovers expired worker leases after five minutes', async () => {
  const value = delivery();
  await deliverDueTelegramReminders(value, 'worker', new Date('2026-09-27T09:00:00Z'));
  expect(value.claimDue).toHaveBeenCalledWith(
    '2026-09-27T09:00:00.000Z',
    '2026-09-27T08:55:00.000Z',
    'worker',
  );
});
