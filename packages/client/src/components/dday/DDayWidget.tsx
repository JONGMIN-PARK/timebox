import { useEffect, useState, memo, useCallback } from "react";
import { useDDayStore } from "@/stores/ddayStore";
import { Plus, Trash2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";

// Memoized individual D-Day item to prevent unnecessary re-renders in the list
const DDayItem = memo(function DDayItem({
  id, title, targetDate, daysLeft, onDelete,
}: {
  id: number; title: string; targetDate: string; daysLeft: number; onDelete: (id: number) => void;
}) {
  return (
    <div className="group flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-900 dark:text-white truncate">{title}</p>
        <p className="text-[11px] text-slate-400">{targetDate}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-base font-bold tabular-nums",
            daysLeft === 0 ? "text-red-500"
              : daysLeft < 0 ? "text-slate-400"
              : daysLeft <= 7 ? "text-orange-500"
              : "text-blue-600 dark:text-blue-400",
          )}
        >
          {daysLeft === 0 ? "D-Day" : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`}
        </span>
        <button onClick={() => onDelete(id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 transition-colors" />
        </button>
      </div>
    </div>
  );
});

export default function DDayWidget() {
  const { ddays, loading, fetchDDays, addDDay, deleteDDay } = useDDayStore();
  const { t } = useI18n();
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
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Flag className="w-4 h-4 text-blue-500" />
          <h3 className="font-semibold text-[13px] text-slate-900 dark:text-white tracking-tight">{t("dday.title")}</h3>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="w-7 h-7 rounded-lg btn-ghost flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="px-4 pb-3 space-y-2 animate-in">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("dday.eventName")}
            className="input-base w-full"
            autoFocus
          />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="input-base w-full"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 text-xs py-2 btn-primary rounded-lg">{t("common.add")}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 text-xs py-2 btn-ghost rounded-lg bg-slate-100 dark:bg-slate-700">{t("common.cancel")}</button>
          </div>
        </form>
      )}

      <div>
        {ddays.map((d) => (
          <DDayItem
            key={d.id}
            id={d.id}
            title={d.title}
            targetDate={d.targetDate}
            daysLeft={d.daysLeft}
            onDelete={deleteDDay}
          />
        ))}
        {ddays.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-400">{t("dday.addFirst")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
