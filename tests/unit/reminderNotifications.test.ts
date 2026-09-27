import { expect, it, vi } from 'vitest';
import {
  reminderOccurrence,
  notifyReminderOnce,
} from '../../packages/client/src/lib/reminderNotifications';

it('notifies once per occurrence even when a panel remounts', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const Notification = vi.fn();
  Object.assign(Notification, { permission: 'granted' });
  vi.stubGlobal('window', { Notification });
  vi.stubGlobal('Notification', Notification);
  vi.stubGlobal(
    'Audio',
    vi.fn(() => ({ play: () => Promise.resolve(), volume: 0 })),
  );
  const reminder = {
    id: 1,
    title: 'Focus',
    message: null,
    remindAt: '2026-09-27T00:00:00Z',
    snoozedUntil: null,
  };
  notifyReminderOnce(reminder, storage);
  notifyReminderOnce(reminder, storage);
  expect(Notification).toHaveBeenCalledTimes(1);
  notifyReminderOnce({ ...reminder, snoozedUntil: '2026-09-27T00:15:00Z' }, storage);
  expect(Notification).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});
it('rescheduling creates a new occurrence', () => {
  expect(reminderOccurrence({ id: 1, remindAt: 'a', snoozedUntil: null })).not.toBe(
    reminderOccurrence({ id: 1, remindAt: 'b', snoozedUntil: null }),
  );
});
