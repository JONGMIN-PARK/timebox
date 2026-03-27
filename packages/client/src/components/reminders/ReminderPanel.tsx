import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, Plus, Trash2, Clock, X, AlarmClock, Check, Volume2 } from "lucide-react";

interface Reminder {
  id: number; title: string; message: string | null; remindAt: string;
  repeatRule: string | null; sourceType: string; channel: string;
  sent: boolean; snoozedUntil: string | null; createdAt: string;
}

export default function ReminderPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", remindAt: "", message: "", repeatRule: "" });
  const [alertReminder, setAlertReminder] = useState<Reminder | null>(null);
  const [showPast, setShowPast] = useState(false);

  const fetchReminders = async () => {
    const res = await api.get<Reminder[]>("/reminders");
    if (res.success && res.data) setReminders(res.data);
  };

  useEffect(() => { fetchReminders(); }, []);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Check for due reminders every 10 seconds
  const checkDueReminders = useCallback(() => {
    const now = new Date().toISOString();
    const due = reminders.filter((r) =>
      !r.sent &&
      r.remindAt <= now &&
      (!r.snoozedUntil || r.snoozedUntil <= now)
    );

    if (due.length > 0) {
      const r = due[0];
      // Show in-app alert popup
      setAlertReminder(r);

      // Also try browser notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`⏰ ${r.title}`, {
          body: r.message || "리마인더 시간입니다!",
          icon: "/icon-192.png",
          tag: `reminder-${r.id}`,
        });
      }

      // Play sound
      try {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczJ1OBmb2xfEEqR3aQrLKHUTZHa42nq5FdPkRngZ+kl2hIQ2N6kJeYdFBCW3OGi4l1WkxaaX2Bfm9gVGBteHd1aWBZZHF0cWxkX2JucHBsZ2Nkam1tamZlZmpsbGlnZmdpa2tpZ2doaWpqaWhnZ2lpaWhoaGhpaWloaGdo");
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}
    }
  }, [reminders]);

  useEffect(() => {
    checkDueReminders(); // Check immediately
    const interval = setInterval(checkDueReminders, 10000); // Then every 10s
    return () => clearInterval(interval);
  }, [checkDueReminders]);

  const handleDismiss = async (id: number) => {
    await api.put(`/reminders/${id}`, { sent: true });
    setAlertReminder(null);
    fetchReminders();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.remindAt) return;
    await api.post("/reminders", {
      title: form.title.trim(),
      message: form.message.trim() || null,
      remindAt: new Date(form.remindAt).toISOString(),
      repeatRule: form.repeatRule || null,
      channel: "web_push",
    });
    setForm({ title: "", remindAt: "", message: "", repeatRule: "" });
    setShowAdd(false);
    fetchReminders();
  };

  const handleSnooze = async (id: number, mins: number) => {
    await api.post(`/reminders/${id}/snooze`, { duration: mins });
    setAlertReminder(null);
    fetchReminders();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/reminders/${id}`);
    if (alertReminder?.id === id) setAlertReminder(null);
    fetchReminders();
  };

  const upcoming = reminders.filter((r) => !r.sent);
  const past = reminders.filter((r) => r.sent);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const mins = Math.round(diff / 60000);

    if (mins > 0 && mins < 60) return `${mins}분 후`;
    if (mins >= 60 && mins < 1440) return `${Math.round(mins / 60)}시간 후`;
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Alert popup for due reminders */}
      {alertReminder && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 animate-in">
          <div className="w-full max-w-xs mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-amber-500 px-4 py-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-white animate-bounce" />
              <span className="text-white font-semibold text-sm">리마인더</span>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-base font-bold text-slate-900 dark:text-white">{alertReminder.title}</p>
              {alertReminder.message && (
                <p className="text-sm text-slate-500 dark:text-slate-400">{alertReminder.message}</p>
              )}
              <p className="text-xs text-slate-400">{new Date(alertReminder.remindAt).toLocaleString("ko-KR")}</p>
            </div>
            <div className="flex border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => handleSnooze(alertReminder.id, 15)}
                className="flex-1 py-3 text-xs font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                15분 후
              </button>
              <button onClick={() => handleSnooze(alertReminder.id, 60)}
                className="flex-1 py-3 text-xs font-medium text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-x border-slate-200 dark:border-slate-700 transition-colors">
                1시간 후
              </button>
              <button onClick={() => handleDismiss(alertReminder.id)}
                className="flex-1 py-3 text-xs font-medium text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">리마인더</h3>
            {upcoming.length > 0 && (
              <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/15 text-[10px] font-bold text-amber-600 dark:text-amber-400 px-1">
                {upcoming.length}
              </span>
            )}
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center">
            <Plus className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {showAdd && (
          <form onSubmit={handleAdd} className="px-4 pb-3 space-y-2 animate-in">
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="리마인더 제목" className="input-base w-full" autoFocus />
            <input type="datetime-local" value={form.remindAt} onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
              className="input-base w-full" />
            <input type="text" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="메모 (선택)" className="input-base w-full" />
            <select value={form.repeatRule} onChange={(e) => setForm({ ...form, repeatRule: e.target.value })}
              className="input-base w-full">
              <option value="">반복 없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 text-xs py-2 btn-primary rounded-lg">추가</button>
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-xs py-2 btn-ghost rounded-lg bg-slate-100 dark:bg-slate-700">취소</button>
            </div>
          </form>
        )}

        <div className="max-h-64 overflow-y-auto">
          {/* Upcoming reminders */}
          {upcoming.map((r) => {
            const isDue = r.remindAt <= new Date().toISOString() && (!r.snoozedUntil || r.snoozedUntil <= new Date().toISOString());
            return (
              <div key={r.id} className={cn(
                "group flex items-start gap-2 px-4 py-2.5 transition-colors",
                isDue ? "bg-amber-50 dark:bg-amber-900/20" : "hover:bg-slate-50/80 dark:hover:bg-slate-700/30",
              )}>
                <AlarmClock className={cn("w-4 h-4 mt-0.5 flex-shrink-0", isDue ? "text-red-500 animate-pulse" : "text-amber-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{r.title}</p>
                  <p className={cn("text-[11px]", isDue ? "text-red-500 font-medium" : "text-slate-400")}>
                    {isDue ? "⏰ 알림 시간!" : formatTime(r.remindAt)}
                  </p>
                  {r.repeatRule && <p className="text-[10px] text-blue-500">🔁 {r.repeatRule === "daily" ? "매일" : r.repeatRule === "weekly" ? "매주" : "매월"}</p>}
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
                  <button onClick={() => handleSnooze(r.id, 15)} title="15분 후"
                    className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center text-[10px] font-medium text-slate-400">15m</button>
                  <button onClick={() => handleSnooze(r.id, 60)} title="1시간 후"
                    className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center text-[10px] font-medium text-slate-400">1h</button>
                  <button onClick={() => handleDelete(r.id)}
                    className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center">
                    <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}

          {upcoming.length === 0 && !showAdd && (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-slate-400">예정된 리마인더 없음</p>
            </div>
          )}

          {/* Past reminders toggle */}
          {past.length > 0 && (
            <>
              <button onClick={() => setShowPast(!showPast)}
                className="w-full px-4 py-2 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-left border-t border-slate-100 dark:border-slate-700/50">
                {showPast ? "▾" : "▸"} 완료된 알림 ({past.length})
              </button>
              {showPast && past.slice(-5).map((r) => (
                <div key={r.id} className="group flex items-start gap-2 px-4 py-2 opacity-50">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-500 line-through truncate">{r.title}</p>
                    <p className="text-[10px] text-slate-400">{new Date(r.remindAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <button onClick={() => handleDelete(r.id)}
                    className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
