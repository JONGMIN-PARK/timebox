import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
} from "@/stores/timeblockStore";

// 5-minute grid system like Elon Musk's paper planner
const BLOCK_SIZE = 5; // minutes per row
const START_HOUR = 5;
const END_HOUR = 23;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / BLOCK_SIZE; // 216 slots
const ROW_HEIGHT = 20; // px per 5-min slot

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Math.floor((h * 60 + m - START_HOUR * 60) / BLOCK_SIZE);
}

function slotToTime(slot: number): string {
  const totalMin = slot * BLOCK_SIZE + START_HOUR * 60;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function slotSpan(startTime: string, endTime: string): number {
  return timeToSlot(endTime) - timeToSlot(startTime);
}

export default function ElonScheduler() {
  const { blocks, loading, selectedDate, setSelectedDate, fetchBlocks, addBlock, updateBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newBlock, setNewBlock] = useState({
    title: "",
    startTime: "09:00",
    endTime: "09:30",
    category: "deep_work" as TimeBlockCategory,
  });
  const [dragState, setDragState] = useState<{
    type: "create" | "resize";
    startSlot: number;
    currentSlot: number;
    blockId?: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBlocks(selectedDate);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && isToday(parseISO(selectedDate))) {
      const now = new Date();
      const currentSlot = timeToSlot(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
      scrollRef.current.scrollTop = Math.max(0, currentSlot * ROW_HEIGHT - 200);
    }
  }, [selectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToSlot(a.startTime) - timeToSlot(b.startTime)),
    [blocks],
  );

  // Build occupied slot map
  const slotMap = useMemo(() => {
    const map = new Map<number, typeof blocks[0]>();
    sortedBlocks.forEach((block) => {
      const start = timeToSlot(block.startTime);
      const end = timeToSlot(block.endTime);
      for (let i = start; i < end; i++) {
        map.set(i, block);
      }
    });
    return map;
  }, [sortedBlocks]);

  // Current time indicator
  const now = new Date();
  const currentTimeSlot = isToday(parseISO(selectedDate))
    ? timeToSlot(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`)
    : -1;

  // Stats
  const stats = useMemo(() => {
    const catMinutes: Record<string, number> = {};
    let totalPlanned = 0;
    let totalCompleted = 0;
    sortedBlocks.forEach((b) => {
      const mins = (timeToSlot(b.endTime) - timeToSlot(b.startTime)) * BLOCK_SIZE;
      catMinutes[b.category] = (catMinutes[b.category] || 0) + mins;
      totalPlanned += mins;
      if (b.completed) totalCompleted += mins;
    });
    return { catMinutes, totalPlanned, totalCompleted };
  }, [sortedBlocks]);

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
    setNewBlock({ title: "", startTime: "09:00", endTime: "09:30", category: "deep_work" });
    setShowAddForm(false);
  };

  // Quick add by clicking empty slot
  const handleSlotClick = (slot: number) => {
    if (slotMap.has(slot)) return;
    const startTime = slotToTime(slot);
    // Find next occupied slot or default 30min
    let endSlot = slot + 6; // 30 min default
    for (let i = slot + 1; i < slot + 12; i++) {
      if (slotMap.has(i)) {
        endSlot = i;
        break;
      }
    }
    endSlot = Math.min(endSlot, TOTAL_SLOTS);
    const endTime = slotToTime(endSlot);
    setNewBlock({ ...newBlock, startTime, endTime });
    setShowAddForm(true);
  };

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  // Render the 5-min grid rows
  const renderGrid = () => {
    const rows: JSX.Element[] = [];
    let i = 0;

    while (i < TOTAL_SLOTS) {
      const block = slotMap.get(i);
      const time = slotToTime(i);
      const isHourMark = i * BLOCK_SIZE % 60 === 0;
      const isHalfHour = i * BLOCK_SIZE % 30 === 0 && !isHourMark;
      const isCurrentSlot = i === currentTimeSlot;

      if (block) {
        // Find the start of this block
        const blockStart = timeToSlot(block.startTime);
        if (i === blockStart) {
          const span = slotSpan(block.startTime, block.endTime);
          const catConfig = CATEGORY_CONFIG[block.category];
          const color = block.color || catConfig.color;

          rows.push(
            <div
              key={`block-${block.id}`}
              className={cn(
                "grid grid-cols-[3.5rem_1fr] border-b border-slate-100 dark:border-slate-700/30 group cursor-pointer transition-opacity",
                block.completed && "opacity-50",
                isCurrentSlot && "ring-1 ring-red-400",
              )}
              style={{ height: span * ROW_HEIGHT }}
            >
              {/* Time label */}
              <div className="flex flex-col justify-start pt-0.5 pr-2 text-right border-r border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {block.startTime}
                </span>
                <span className="text-[9px] text-slate-300 dark:text-slate-600 font-mono">
                  {block.endTime}
                </span>
              </div>
              {/* Block content */}
              <div
                className="relative flex items-start px-2 py-1 border-l-4 overflow-hidden"
                style={{ borderLeftColor: color, backgroundColor: color + "15" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{catConfig.icon}</span>
                    <span className={cn(
                      "text-xs font-medium truncate",
                      block.completed ? "line-through text-slate-400" : "text-slate-900 dark:text-white",
                    )}>
                      {block.title}
                    </span>
                  </div>
                  {span >= 3 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                      {catConfig.label} · {span * BLOCK_SIZE}min
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div className="hidden group-hover:flex items-center gap-0.5 absolute top-1 right-1">
                  <button
                    onClick={() => toggleCompleted(block.id)}
                    className={cn(
                      "w-5 h-5 rounded flex items-center justify-center",
                      block.completed ? "bg-green-500 text-white" : "bg-white/80 dark:bg-slate-700/80 text-slate-500",
                    )}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteBlock(block.id)}
                    className="w-5 h-5 rounded bg-white/80 dark:bg-slate-700/80 text-slate-400 hover:text-red-500 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>,
          );
          i += span;
          continue;
        }
        i++;
        continue;
      }

      // Empty slot
      rows.push(
        <div
          key={`slot-${i}`}
          className={cn(
            "grid grid-cols-[3.5rem_1fr] cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors",
            isHourMark && "border-t border-slate-300 dark:border-slate-600",
            isHalfHour && "border-t border-slate-100 dark:border-slate-700/50",
            !isHourMark && !isHalfHour && "border-t border-slate-50 dark:border-slate-800",
            isCurrentSlot && "bg-red-50 dark:bg-red-900/10",
          )}
          style={{ height: ROW_HEIGHT }}
          onClick={() => handleSlotClick(i)}
        >
          <div className="flex items-center justify-end pr-2 border-r border-slate-200 dark:border-slate-700">
            {isHourMark && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 font-mono">
                {time}
              </span>
            )}
            {isHalfHour && (
              <span className="text-[10px] text-slate-300 dark:text-slate-600 font-mono">
                {time.slice(3)}
              </span>
            )}
          </div>
          <div className="border-l border-transparent">
            {isCurrentSlot && (
              <div className="h-full flex items-center px-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
                <div className="flex-1 h-px bg-red-400" />
              </div>
            )}
          </div>
        </div>,
      );
      i++;
    }

    return rows;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="font-semibold text-slate-900 dark:text-white min-w-[160px] text-center">
            {format(parseISO(selectedDate), "EEE, MMM d", { locale: enUS })}
          </h2>
          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          {!isToday(parseISO(selectedDate)) && (
            <button onClick={goToday} className="text-xs px-2.5 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">
              Today
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:block">
            {Math.floor(stats.totalPlanned / 60)}h {stats.totalPlanned % 60}m planned
            {stats.totalCompleted > 0 && ` · ${Math.floor(stats.totalCompleted / 60)}h ${stats.totalCompleted % 60}m done`}
          </span>
          <button
            onClick={() => setShowAddForm(true)}
            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category stats bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto">
        {Object.entries(stats.catMinutes).map(([cat, mins]) => {
          const config = CATEGORY_CONFIG[cat as TimeBlockCategory];
          return (
            <span key={cat} className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: config.color }} />
              <span>{config.label}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}m` : ""}` : `${mins}m`}
              </span>
            </span>
          );
        })}
        {sortedBlocks.length === 0 && (
          <span className="text-xs text-slate-400">Click any time slot to add a block</span>
        )}
      </div>

      {/* 5-min grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        <div ref={gridRef}>
          {renderGrid()}
        </div>
      </div>

      {/* Add block modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddForm(false)}>
          <form
            onSubmit={handleAdd}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-4 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-xl space-y-4"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Add Time Block
            </h3>
            <input
              type="text"
              value={newBlock.title}
              onChange={(e) => setNewBlock({ ...newBlock, title: e.target.value })}
              placeholder="What are you working on?"
              className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {/* Category */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Category</label>
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
            {/* Time range */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Start</label>
                <input
                  type="time"
                  step="300"
                  value={newBlock.startTime}
                  onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">End</label>
                <input
                  type="time"
                  step="300"
                  value={newBlock.endTime}
                  onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                  className="w-full text-sm bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
            {/* Duration info */}
            <div className="text-xs text-slate-400 text-center">
              {(() => {
                const [sh, sm] = newBlock.startTime.split(":").map(Number);
                const [eh, em] = newBlock.endTime.split(":").map(Number);
                const diff = (eh * 60 + em) - (sh * 60 + sm);
                if (diff <= 0) return "Invalid time range";
                return `${diff} minutes (${Math.floor(diff / BLOCK_SIZE)} blocks)`;
              })()}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg">
                Add Block
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
