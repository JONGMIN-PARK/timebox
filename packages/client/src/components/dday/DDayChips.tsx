import { useEffect, memo } from "react";
import { useDDayStore } from "@/stores/ddayStore";
import { cn } from "@/lib/utils";

// Memoized individual D-Day chip to prevent unnecessary re-renders
const DDayChip = memo(function DDayChip({ title, daysLeft }: { title: string; daysLeft: number }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-700/50">
      <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{title}</span>
      <span
        className={cn(
          "text-[11px] font-semibold whitespace-nowrap tabular-nums",
          daysLeft === 0 ? "text-red-500"
            : daysLeft < 0 ? "text-slate-400"
            : daysLeft <= 7 ? "text-orange-500"
            : "text-blue-600 dark:text-blue-400",
        )}
      >
        {daysLeft === 0 ? "D-Day" : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`}
      </span>
    </div>
  );
});

export default function DDayChips() {
  const { ddays, fetchDDays } = useDDayStore();

  useEffect(() => {
    fetchDDays();
  }, [fetchDDays]);

  if (ddays.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-1">
      {ddays.slice(0, 5).map((d) => (
        <DDayChip key={d.id} title={d.title} daysLeft={d.daysLeft} />
      ))}
    </div>
  );
}
