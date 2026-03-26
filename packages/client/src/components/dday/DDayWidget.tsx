import { useEffect, useState } from "react";
import { useDDayStore } from "@/stores/ddayStore";
import { Plus, Trash2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DDayWidget() {
  const { ddays, loading, fetchDDays, addDDay, deleteDDay } = useDDayStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    fetchDDays();
  }, [fetchDDays]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetDate) return;
    await addDDay(title.trim(), targetDate);
    setTitle("");
    setTargetDate("");
    setShowAdd(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">D-Day</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event name"
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none"
            autoFocus
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500">Add</button>
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-xs py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg">Cancel</button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {ddays.map((d) => (
          <div key={d.id} className="group flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{d.title}</p>
              <p className="text-xs text-slate-400">{d.targetDate}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  d.daysLeft === 0
                    ? "text-red-500"
                    : d.daysLeft < 0
                      ? "text-slate-400"
                      : d.daysLeft <= 7
                        ? "text-orange-500"
                        : "text-blue-600 dark:text-blue-400",
                )}
              >
                {d.daysLeft === 0 ? "D-Day" : d.daysLeft > 0 ? `D-${d.daysLeft}` : `D+${Math.abs(d.daysLeft)}`}
              </span>
              <button
                onClick={() => deleteDDay(d.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        ))}
        {ddays.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Add your first D-Day
          </div>
        )}
      </div>
    </div>
  );
}
