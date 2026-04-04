import { useState, useEffect, useMemo } from "react";
import {
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { timeblockApi } from "@/lib/apiService";
import { CATEGORY_CONFIG } from "@/stores/timeblockStore";
import { useI18n } from "@/lib/useI18n";
import type { TimeBlock } from "@timebox/shared";

interface TimeStatsProps {
  selectedDate: string;
  onClose: () => void;
}

type RangeMode = "week" | "month";

/** Parse "HH:mm" time strings and return duration in hours */
function blockHours(block: TimeBlock): number {
  const [sh, sm] = (block.startTime ?? "00:00").split(":").map(Number);
  const [eh, em] = (block.endTime ?? "00:00").split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

export default function TimeStats({ selectedDate, onClose }: TimeStatsProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<RangeMode>("week");
  const [blocksByDate, setBlocksByDate] = useState<Record<string, TimeBlock[]>>({});
  const [loading, setLoading] = useState(false);

  const dateObj = useMemo(() => new Date(selectedDate), [selectedDate]);

  const days = useMemo(() => {
    const interval =
      mode === "week"
        ? { start: startOfWeek(dateObj, { weekStartsOn: 1 }), end: endOfWeek(dateObj, { weekStartsOn: 1 }) }
        : { start: startOfMonth(dateObj), end: endOfMonth(dateObj) };
    return eachDayOfInterval(interval);
  }, [dateObj, mode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchAll = async () => {
      const startStr = format(days[0], "yyyy-MM-dd");
      const endStr = format(days[days.length - 1], "yyyy-MM-dd");
      try {
        const res = await timeblockApi.getRange(startStr, endStr);
        if (!cancelled && res.success && res.data) {
          const grouped: Record<string, TimeBlock[]> = {};
          for (const block of res.data) {
            const d = block.date;
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(block);
          }
          setBlocksByDate(grouped);
        }
      } catch {
        /* skip on error */
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [days]);

  // Compute stats
  const allBlocks = useMemo(
    () => Object.values(blocksByDate).flat(),
    [blocksByDate],
  );

  const totalHours = useMemo(
    () => allBlocks.reduce((sum, b) => sum + blockHours(b), 0),
    [allBlocks],
  );

  const completionRate = useMemo(() => {
    if (allBlocks.length === 0) return 0;
    const completed = allBlocks.filter((b) => b.completed).length;
    return Math.round((completed / allBlocks.length) * 100);
  }, [allBlocks]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { hours: number; count: number }> = {};
    for (const b of allBlocks) {
      const cat = b.category || "other";
      if (!map[cat]) map[cat] = { hours: 0, count: 0 };
      map[cat].hours += blockHours(b);
      map[cat].count += 1;
    }
    return map;
  }, [allBlocks]);

  // Find max hours in a single day for bar scaling
  const maxDayHours = useMemo(() => {
    let max = 0;
    for (const day of days) {
      const dateStr = format(day, "yyyy-MM-dd");
      const blocks = blocksByDate[dateStr] ?? [];
      const h = blocks.reduce((s, b) => s + blockHours(b), 0);
      if (h > max) max = h;
    }
    return max || 1;
  }, [days, blocksByDate]);

  return (
    <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-4 max-h-[300px] overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Header + toggle */}
      <div className="flex items-center gap-3 mb-3 -mx-4 -mt-4 px-4 pt-3 pb-2 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-transparent dark:from-slate-700/50 dark:via-slate-800/30 dark:to-transparent rounded-t-xl">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t("timebox.stats")}
        </h3>
        <div className="flex rounded-md bg-gray-100 dark:bg-gray-700 p-0.5 text-xs">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                mode === m
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {t(`timebox.stats.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">
          {t("timebox.stats.loading")}
        </div>
      ) : (
        <>
          {/* Stacked bar chart */}
          <div className="space-y-1 mb-3">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const blocks = blocksByDate[dateStr] ?? [];
              const dayHours = blocks.reduce((s, b) => s + blockHours(b), 0);
              // Group by category
              const segments: { category: string; hours: number }[] = [];
              const catMap: Record<string, number> = {};
              for (const b of blocks) {
                const cat = b.category || "other";
                catMap[cat] = (catMap[cat] ?? 0) + blockHours(b);
              }
              for (const [cat, hours] of Object.entries(catMap)) {
                segments.push({ category: cat, hours });
              }

              return (
                <div key={dateStr} className="flex items-center gap-2">
                  <span className="text-[10px] w-8 text-gray-500 dark:text-gray-400 shrink-0">
                    {format(day, "EEE")}
                  </span>
                  <div
                    className="flex h-3.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-1 shadow-inner"
                  >
                    {segments.map((seg) => {
                      const cfg = CATEGORY_CONFIG[seg.category] ?? { color: "#94a3b8" };
                      const widthPct = (seg.hours / maxDayHours) * 100;
                      return (
                        <div
                          key={seg.category}
                          title={`${cfg.label ?? seg.category}: ${seg.hours.toFixed(1)}h`}
                          className="first:rounded-l-full last:rounded-r-full shadow-sm"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: cfg.color,
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] w-8 text-right text-gray-400 dark:text-gray-500 shrink-0">
                    {dayHours > 0 ? `${dayHours.toFixed(1)}h` : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg px-2 py-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t("timebox.stats.totalHours")}</span>
              <span className="ml-1 font-semibold text-gray-800 dark:text-gray-100">
                {totalHours.toFixed(1)}h
              </span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg px-2 py-1.5">
              <span className="text-gray-500 dark:text-gray-400">{t("timebox.stats.completion")}</span>
              <span className="ml-1 font-semibold text-gray-800 dark:text-gray-100 glow-pulse inline-block">
                {completionRate}%
              </span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(categoryBreakdown).map(([cat, { hours }]) => {
              const cfg = CATEGORY_CONFIG[cat] ?? { color: "#94a3b8", icon: "", label: cat };
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border-l-2"
                  style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, borderLeftColor: cfg.color }}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span className="font-medium">{hours.toFixed(1)}h</span>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
