import { useEffect } from "react";
import { useDDayStore } from "@/stores/ddayStore";
import { cn } from "@/lib/utils";

export default function DDayChips() {
  const { ddays, fetchDDays } = useDDayStore();

  useEffect(() => {
    fetchDDays();
  }, [fetchDDays]);

  if (ddays.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-2">
      {ddays.slice(0, 5).map((d) => (
        <div
          key={d.id}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700"
        >
          <span className="text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{d.title}</span>
          <span
            className={cn(
              "text-xs font-bold whitespace-nowrap",
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
        </div>
      ))}
    </div>
  );
}
