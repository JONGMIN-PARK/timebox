import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, Plus, Trash2, Clock, X, AlarmClock } from "lucide-react";

interface Reminder {
  id: number; title: string; message: string | null; remindAt: string;
  repeatRule: string | null; sourceType: string; channel: string;
  sent: boolean; snoozedUntil: string | null; createdAt: string;
}

export default function ReminderPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", remindAt: "", message: "", repeatRule: "" });

  const fetchReminders = async () => {
    const res = await api.get<Reminder[]>("/reminders");
    if (res.success && res.data) setReminders(res.data);
  };

  useEffect(() => { fetchReminders(); }, []);

  // Check for due reminders and show notification
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString();
      reminders.filter((r) => !r.sent && r.remindAt <= now && (!r.snoozedUntil || r.snoozedUntil <= now))
        .forEach(async (r) => {
          // Show browser notification
          if (Notification.permission === "granted") {
            new Notification(`⏰ ${r.title}`, { body: r.message || "Reminder!", icon: "/icon-192.png" });
          }
          // Mark as sent
          await api.put(`/reminders/${r.id}`, { sent: true });
          fetchReminders();
        });
    }, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [reminders]);

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
    fetchReminders();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/reminders/${id}`);
    fetchReminders();
  };

  const requestNotifPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  useEffect(() => { requestNotifPermission(); }, []);

  const upcoming = reminders.filter((r) => !r.sent);
  const past = reminders.filter((r) => r.sent);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">Reminders</h3>
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
            placeholder="Reminder title" className="input-base w-full" autoFocus />
          <input type="datetime-local" value={form.remindAt} onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
            className="input-base w-full" />
          <select value={form.repeatRule} onChange={(e) => setForm({ ...form, repeatRule: e.target.value })}
            className="input-base w-full">
            <option value="">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 text-xs py-2 btn-primary rounded-lg">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-xs py-2 btn-ghost rounded-lg bg-slate-100 dark:bg-slate-700">Cancel</button>
          </div>
        </form>
      )}

      <div>
        {upcoming.map((r) => (
          <div key={r.id} className="group flex items-start gap-2 px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors stagger-item">
            <AlarmClock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{r.title}</p>
              <p className="text-[11px] text-slate-400">{new Date(r.remindAt).toLocaleString()}</p>
              {r.repeatRule && <p className="text-[10px] text-blue-500">🔁 {r.repeatRule}</p>}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
              <button onClick={() => handleSnooze(r.id, 15)} title="Snooze 15m"
                className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center text-[10px] font-medium text-slate-400">15m</button>
              <button onClick={() => handleSnooze(r.id, 60)} title="Snooze 1h"
                className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center text-[10px] font-medium text-slate-400">1h</button>
              <button onClick={() => handleDelete(r.id)}
                className="w-6 h-6 rounded-lg btn-ghost flex items-center justify-center">
                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {upcoming.length === 0 && !showAdd && (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-slate-400">No upcoming reminders</p>
          </div>
        )}
      </div>
    </div>
  );
}
