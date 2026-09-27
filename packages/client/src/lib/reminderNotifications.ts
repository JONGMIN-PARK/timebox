type DueReminder = {
  id: number;
  title: string;
  message: string | null;
  remindAt: string;
  snoozedUntil: string | null;
};

/** A snoozed or rescheduled reminder is a new occurrence; polling is not. */
export function reminderOccurrence(
  reminder: Pick<DueReminder, 'id' | 'remindAt' | 'snoozedUntil'>,
) {
  return `timebox-reminder:${reminder.id}:${reminder.remindAt}:${reminder.snoozedUntil ?? ''}`;
}
export function notifyReminderOnce(
  reminder: DueReminder,
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
) {
  const key = reminderOccurrence(reminder);
  try {
    if (storage.getItem(key)) return;
    storage.setItem(key, 'shown');
  } catch {
    /* Notifications still work when storage is disabled. */
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⏰ ${reminder.title}`, {
      body: reminder.message || "It's time for your reminder!",
      icon: '/icon-192.png',
      tag: `reminder-${reminder.id}`,
      requireInteraction: true,
    });
  }
  try {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczJ1OBmb2xfEEqR3aQrLKHUTZHa42nq5FdPkRngZ+kl2hIQ2N6kJeYdFBCW3OGi4l1WkxaaX2Bfm9gVGBteHd1aWBZZHF0cWxkX2JucHBsZ2Nkam1tamZlZmpsbGlnZmdpa2tpZ2doaWpqaWhnZ2lpaWhoaGhpaWloaGdo',
    );
    audio.volume = 0.5;
    void audio.play().catch(() => undefined);
  } catch {
    /* Audio may be unavailable on this device. */
  }
}
