import { useEffect, useState, useRef, useMemo } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
  type TimeBlock,
} from "@/stores/timeblockStore";

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 6;
const END_HOUR = 24;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function blockTop(startTime: string): number {
  const minutes = timeToMinutes(startTime);
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function blockHeight(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return ((end - start) / 60) * HOUR_HEIGHT;
}

export default function TimeBoxView() {
  const { blocks, loading, selectedDate, setSelectedDate, fetchBlocks, addBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();
  const { t } = useI18n();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    category: "deep_work" as TimeBlockCategory,
  });
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlocks(selectedDate);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current && isToday(parseISO(selectedDate))) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const scrollTo = ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT - 100;
      timelineRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [selectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [blocks],
  );

  // Current time indicator
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showCurrentTime = isToday(parseISO(selectedDate)) && currentMinutes >= START_HOUR * 60;
  const currentTimeTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlock.title.trim()) return;
    const catConfig = CATEGORY_CONFIG[newBlock.category];
    await addBlock({
      date: selectedDate,
      startTime: newBlock.startTime,
      endTime: newBlock.endTime,
      title: newBlock.title.trim(),
      category: newBlock.category,
      color: catConfig.color,
    });
    setNewBlock({ title: "", startTime: "09:00", endTime: "10:00", category: "deep_work" });
    setShowAddForm(false);
  };

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="flex flex-col h-full">
      {/* Date navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="font-semibold text-slate-900 dark:text-white min-w-[140px] text-center">
            {format(parseISO(selectedDate), "MMM d (EEE)", { locale: enUS })}
          </h2>
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday(parseISO(selectedDate)) && (
            <button
              onClick={goToday}
              className="text-xs px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            >
              {t("common.today")}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto">
        {Object.entries(
          sortedBlocks.reduce(
            (acc, b) => {
              const dur = timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
              acc[b.category] = (acc[b.category] || 0) + dur;
              return acc;
            },
            {} as Record<string, number>,
          ),
        ).map(([cat, mins]) => {
          const config = CATEGORY_CONFIG[cat as TimeBlockCategory];
          return (
            <span key={cat} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span>{config.icon}</span>
              <span>{config.label}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {Math.floor(mins / 60)}h{mins % 60 > 0 ? `${mins % 60}m` : ""}
              </span>
            </span>
          );
        })}
        {sortedBlocks.length === 0 && (
          <span className="text-xs text-slate-400">{t("timebox.addTimeBlocks")}</span>
        )}
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto relative">
        <div className="relative" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
          {/* Hour lines */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/50"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            >
              <span className="absolute -top-2.5 left-2 text-xs text-slate-400 dark:text-slate-500 w-10">
                {hour.toString().padStart(2, "0")}:00
              </span>
            </div>
          ))}

          {/* Current time indicator */}
          {showCurrentTime && (
            <div
              className="absolute left-12 right-2 z-20 flex items-center pointer-events-none"
              style={{ top: currentTimeTop }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
              <div className="flex-1 h-0.5 bg-red-500" />
            </div>
          )}

          {/* Time blocks */}
          {sortedBlocks.map((block) => {
            const catConfig = CATEGORY_CONFIG[block.category];
            const color = block.color || catConfig.color;
            const top = blockTop(block.startTime);
            const height = blockHeight(block.startTime, block.endTime);

            return (
              <div
                key={block.id}
                className={cn(
                  "absolute left-14 right-2 rounded-lg border-l-4 px-3 py-1.5 cursor-pointer group transition-opacity",
                  block.completed && "opacity-50",
                )}
                style={{
                  top,
                  height: Math.max(height, 24),
                  borderLeftColor: color,
                  backgroundColor: color + "18",
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        block.completed
                          ? "line-through text-slate-400 dark:text-slate-500"
                          : "text-slate-900 dark:text-white",
                      )}
                    >
                      {catConfig.icon} {block.title}
                    </p>
                    {height >= 40 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {block.startTime} - {block.endTime}
                      </p>
                    )}
                  </div>
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => toggleCompleted(block.id)}
                      className={cn(
                        "w-6 h-6 rounded flex items-center justify-center",
                        block.completed
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBlock(block.id)}
                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add form modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddForm(false)}>
          <form
            onSubmit={handleAdd}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-xl space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {format(parseISO(selectedDate), "MMM d", { locale: enUS })} — {t("timebox.addBlock")}
            </h3>
            <input
              type="text"
              value={newBlock.title}
              onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              placeholder={t("timebox.blockTitle")}
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {/* Category selector */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">{t("calendar.category")}</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.entries(CATEGORY_CONFIG) as [TimeBlockCategory, typeof CATEGORY_CONFIG[TimeBlockCategory]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewBlock({ ...newBlock, category: key })}
                      className={cn(
                        "text-xs py-1.5 px-1 rounded-lg border-2 transition-colors text-center",
                        newBlock.category === key
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-transparent bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700",
                      )}
                    >
                      <span className="block text-base">{config.icon}</span>
                      <span className="text-slate-600 dark:text-slate-400">{config.label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.start")}</label>
                <input
                  type="time"
                  value={newBlock.startTime}
                  onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">{t("calendar.end")}</label>
                <input
                  type="time"
                  value={newBlock.endTime}
                  onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                {t("common.add")}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
