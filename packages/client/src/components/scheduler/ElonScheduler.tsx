import { useEffect, useState, useRef, useMemo } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Trash2, ArrowRight,
  Brain, ListOrdered, Clock, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
} from "@/stores/timeblockStore";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Brain Box Item (localStorage-persisted per date) ──
interface BrainItem {
  id: string;
  text: string;
  category: TimeBlockCategory;
  duration: number; // minutes
  promoted: boolean; // moved to priority
}

function loadBrainItems(date: string): BrainItem[] {
  try {
    return JSON.parse(localStorage.getItem(`tb_brain_${date}`) || "[]");
  } catch { return []; }
}

function saveBrainItems(date: string, items: BrainItem[]) {
  localStorage.setItem(`tb_brain_${date}`, JSON.stringify(items));
}

// ── Priority Item ──
interface PriorityItem {
  id: string;
  text: string;
  category: TimeBlockCategory;
  duration: number;
  rank: number;
  scheduled: boolean;
}

function loadPriorityItems(date: string): PriorityItem[] {
  try {
    return JSON.parse(localStorage.getItem(`tb_priority_${date}`) || "[]");
  } catch { return []; }
}

function savePriorityItems(date: string, items: PriorityItem[]) {
  localStorage.setItem(`tb_priority_${date}`, JSON.stringify(items));
}

// ── Time Grid ──
const BLOCK_SIZE = 5;
const START_HOUR = 5;
const END_HOUR = 23;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / BLOCK_SIZE;
const ROW_HEIGHT = 20;

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

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Sortable Priority Item ──
function SortablePriItem({ item, onRemove, onSchedule }: {
  item: PriorityItem;
  onRemove: () => void;
  onSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const config = CATEGORY_CONFIG[item.category];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all",
        item.scheduled
          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 opacity-50"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700",
        isDragging && "opacity-40 shadow-lg",
      )}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
      </button>
      <span className="text-xs">{config.icon}</span>
      <span className={cn("flex-1 truncate", item.scheduled && "line-through text-slate-400")}>
        {item.text}
      </span>
      <span className="text-[10px] text-slate-400 whitespace-nowrap">{item.duration}m</span>
      {!item.scheduled && (
        <button onClick={onSchedule} className="hidden group-hover:flex w-4 h-4 items-center justify-center text-blue-500 hover:text-blue-600" title="Schedule">
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
      <button onClick={onRemove} className="hidden group-hover:flex w-4 h-4 items-center justify-center text-slate-400 hover:text-red-500">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ElonScheduler() {
  const { blocks, selectedDate, setSelectedDate, fetchBlocks, addBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();

  const [brainItems, setBrainItems] = useState<BrainItem[]>([]);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [brainInput, setBrainInput] = useState("");
  const [brainCategory, setBrainCategory] = useState<TimeBlockCategory>("deep_work");
  const [brainDuration, setBrainDuration] = useState(30);
  const [scheduleItem, setScheduleItem] = useState<PriorityItem | null>(null);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  useEffect(() => {
    fetchBlocks(selectedDate);
    setBrainItems(loadBrainItems(selectedDate));
    setPriorityItems(loadPriorityItems(selectedDate));
  }, [selectedDate]);

  // Scroll to current time
  useEffect(() => {
    if (scrollRef.current && isToday(parseISO(selectedDate))) {
      const now = new Date();
      const slot = timeToSlot(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
      scrollRef.current.scrollTop = Math.max(0, slot * ROW_HEIGHT - 150);
    }
  }, [selectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToSlot(a.startTime) - timeToSlot(b.startTime)),
    [blocks],
  );

  const slotMap = useMemo(() => {
    const map = new Map<number, typeof blocks[0]>();
    sortedBlocks.forEach((block) => {
      const s = timeToSlot(block.startTime);
      const e = timeToSlot(block.endTime);
      for (let i = s; i < e; i++) map.set(i, block);
    });
    return map;
  }, [sortedBlocks]);

  const now = new Date();
  const currentTimeSlot = isToday(parseISO(selectedDate))
    ? timeToSlot(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`)
    : -1;

  // ── STEP 1: Brain Box ──
  const handleBrainAdd = () => {
    if (!brainInput.trim()) return;
    const newItems = [...brainItems, { id: uid(), text: brainInput.trim(), category: brainCategory, duration: brainDuration, promoted: false }];
    setBrainItems(newItems);
    saveBrainItems(selectedDate, newItems);
    setBrainInput("");
  };

  const handleBrainRemove = (id: string) => {
    const newItems = brainItems.filter((i) => i.id !== id);
    setBrainItems(newItems);
    saveBrainItems(selectedDate, newItems);
  };

  // ── STEP 2: Promote to Priority ──
  const handlePromote = (item: BrainItem) => {
    // Mark as promoted in brain
    const newBrain = brainItems.map((i) => i.id === item.id ? { ...i, promoted: true } : i);
    setBrainItems(newBrain);
    saveBrainItems(selectedDate, newBrain);
    // Add to priority
    const newPri = [...priorityItems, { id: uid(), text: item.text, category: item.category, duration: item.duration, rank: priorityItems.length, scheduled: false }];
    setPriorityItems(newPri);
    savePriorityItems(selectedDate, newPri);
  };

  const handlePriorityReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = priorityItems.findIndex((i) => i.id === active.id);
    const newIdx = priorityItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(priorityItems, oldIdx, newIdx).map((item, i) => ({ ...item, rank: i }));
    setPriorityItems(reordered);
    savePriorityItems(selectedDate, reordered);
  };

  const handlePriorityRemove = (id: string) => {
    const newItems = priorityItems.filter((i) => i.id !== id);
    setPriorityItems(newItems);
    savePriorityItems(selectedDate, newItems);
  };

  // ── STEP 3: Schedule to Time Grid ──
  const handleScheduleStart = (item: PriorityItem) => {
    setScheduleItem(item);
    setScheduleTime("09:00");
  };

  const handleScheduleConfirm = async () => {
    if (!scheduleItem) return;
    const config = CATEGORY_CONFIG[scheduleItem.category];
    const [sh, sm] = scheduleTime.split(":").map(Number);
    const endMin = sh * 60 + sm + scheduleItem.duration;
    const endTime = `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`;

    await addBlock({
      date: selectedDate,
      startTime: scheduleTime,
      endTime,
      title: scheduleItem.text,
      category: scheduleItem.category,
      color: config.color,
    });

    // Mark as scheduled
    const newPri = priorityItems.map((i) => i.id === scheduleItem.id ? { ...i, scheduled: true } : i);
    setPriorityItems(newPri);
    savePriorityItems(selectedDate, newPri);
    setScheduleItem(null);
  };

  const handleSlotClick = (slot: number) => {
    if (slotMap.has(slot)) return;
    // If scheduling an item, set time
    if (scheduleItem) {
      setScheduleTime(slotToTime(slot));
      return;
    }
  };

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  // ── Stats ──
  const stats = useMemo(() => {
    let totalPlanned = 0;
    let totalCompleted = 0;
    sortedBlocks.forEach((b) => {
      const mins = (timeToSlot(b.endTime) - timeToSlot(b.startTime)) * BLOCK_SIZE;
      totalPlanned += mins;
      if (b.completed) totalCompleted += mins;
    });
    return { totalPlanned, totalCompleted };
  }, [sortedBlocks]);

  // ── Render Grid ──
  const renderGrid = () => {
    const rows: JSX.Element[] = [];
    let i = 0;
    while (i < TOTAL_SLOTS) {
      const block = slotMap.get(i);
      const time = slotToTime(i);
      const isHourMark = (i * BLOCK_SIZE) % 60 === 0;
      const isHalfHour = (i * BLOCK_SIZE) % 30 === 0 && !isHourMark;
      const isCurrent = i === currentTimeSlot;

      if (block && i === timeToSlot(block.startTime)) {
        const span = slotSpan(block.startTime, block.endTime);
        const catConfig = CATEGORY_CONFIG[block.category];
        const color = block.color || catConfig.color;
        rows.push(
          <div key={`b-${block.id}`}
            className={cn("grid grid-cols-[2.5rem_1fr] group cursor-pointer", block.completed && "opacity-50")}
            style={{ height: span * ROW_HEIGHT }}>
            <div className="flex flex-col pt-0.5 pr-1 text-right border-r border-slate-200 dark:border-slate-700">
              <span className="text-[9px] text-slate-400 font-mono">{block.startTime}</span>
            </div>
            <div className="relative flex items-start px-1.5 py-0.5 border-l-3 overflow-hidden"
              style={{ borderLeftColor: color, backgroundColor: color + "15" }}>
              <div className="flex-1 min-w-0">
                <span className={cn("text-[11px] font-medium truncate block", block.completed && "line-through text-slate-400")}>
                  {catConfig.icon} {block.title}
                </span>
                {span >= 3 && <span className="text-[9px] text-slate-400 block">{span * BLOCK_SIZE}m</span>}
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5 absolute top-0.5 right-0.5">
                <button onClick={() => toggleCompleted(block.id)}
                  className={cn("w-4 h-4 rounded flex items-center justify-center", block.completed ? "bg-green-500 text-white" : "bg-white/80 dark:bg-slate-700/80 text-slate-500")}>
                  <Check className="w-2.5 h-2.5" />
                </button>
                <button onClick={() => deleteBlock(block.id)}
                  className="w-4 h-4 rounded bg-white/80 dark:bg-slate-700/80 text-slate-400 hover:text-red-500 flex items-center justify-center">
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>,
        );
        i += span;
        continue;
      }
      if (block) { i++; continue; }

      rows.push(
        <div key={`s-${i}`}
          className={cn(
            "grid grid-cols-[2.5rem_1fr] cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10",
            isHourMark && "border-t border-slate-300 dark:border-slate-600",
            isHalfHour && "border-t border-slate-200 dark:border-slate-700/50",
            !isHourMark && !isHalfHour && "border-t border-slate-50 dark:border-slate-800",
            isCurrent && "bg-red-50 dark:bg-red-900/10",
            scheduleItem && "hover:bg-green-50 dark:hover:bg-green-900/10",
          )}
          style={{ height: ROW_HEIGHT }}
          onClick={() => handleSlotClick(i)}>
          <div className="flex items-center justify-end pr-1 border-r border-slate-200 dark:border-slate-700">
            {isHourMark && <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono">{time}</span>}
          </div>
          <div>
            {isCurrent && (
              <div className="h-full flex items-center px-1">
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="font-semibold text-sm text-slate-900 dark:text-white min-w-[120px] text-center">
            {format(parseISO(selectedDate), "EEE, MMM d", { locale: enUS })}
          </h2>
          <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          {!isToday(parseISO(selectedDate)) && (
            <button onClick={goToday} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Today</button>
          )}
        </div>
        <span className="text-[11px] text-slate-400">
          {Math.floor(stats.totalPlanned / 60)}h{stats.totalPlanned % 60}m planned
          {stats.totalCompleted > 0 && ` · ${Math.floor(stats.totalCompleted / 60)}h${stats.totalCompleted % 60}m done`}
        </span>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Panel 1: Brain Box ── */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
            <Brain className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Brain Box</span>
            <span className="text-[10px] text-slate-400 ml-auto">{brainItems.filter((i) => !i.promoted).length}</span>
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 space-y-1.5">
            <input
              type="text"
              value={brainInput}
              onChange={(e) => setBrainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBrainAdd()}
              placeholder="Dump everything here..."
              className="w-full text-xs bg-slate-50 dark:bg-slate-700 rounded px-2 py-1.5 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-purple-400"
            />
            <div className="flex items-center gap-1">
              <select
                value={brainCategory}
                onChange={(e) => setBrainCategory(e.target.value as TimeBlockCategory)}
                className="flex-1 text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
              >
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
              <select
                value={brainDuration}
                onChange={(e) => setBrainDuration(Number(e.target.value))}
                className="w-16 text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-700 dark:text-slate-300 outline-none"
              >
                {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m}m</option>
                ))}
              </select>
              <button onClick={handleBrainAdd} disabled={!brainInput.trim()}
                className="w-6 h-6 rounded bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-600 flex items-center justify-center text-white">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Brain items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {brainItems.filter((i) => !i.promoted).map((item) => {
              const config = CATEGORY_CONFIG[item.category];
              return (
                <div key={item.id} className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/10">
                  <span>{config.icon}</span>
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{item.text}</span>
                  <span className="text-[10px] text-slate-400">{item.duration}m</span>
                  <button onClick={() => handlePromote(item)}
                    className="hidden group-hover:flex w-4 h-4 items-center justify-center text-purple-500 hover:text-purple-600" title="Move to Priority">
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleBrainRemove(item.id)}
                    className="hidden group-hover:flex w-4 h-4 items-center justify-center text-slate-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {brainItems.filter((i) => !i.promoted).length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-4">Dump all your tasks here first</p>
            )}
          </div>
        </div>

        {/* ── Panel 2: Priority ── */}
        <div className="w-56 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
            <ListOrdered className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Priority</span>
            <span className="text-[10px] text-slate-400 ml-auto">
              {priorityItems.filter((i) => !i.scheduled).length} left
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityReorder}>
              <SortableContext items={priorityItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {priorityItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-1">
                    <span className={cn(
                      "w-4 text-[10px] font-bold text-center",
                      idx === 0 ? "text-red-500" : idx <= 2 ? "text-amber-500" : "text-slate-400",
                    )}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <SortablePriItem
                        item={item}
                        onRemove={() => handlePriorityRemove(item.id)}
                        onSchedule={() => handleScheduleStart(item)}
                      />
                    </div>
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            {priorityItems.length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-4">
                Promote items from Brain Box →<br />then drag to reorder by priority
              </p>
            )}
          </div>
        </div>

        {/* ── Panel 3: Time Grid ── */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Time Grid</span>
            {scheduleItem && (
              <div className="flex items-center gap-2 ml-2 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[11px]">
                <span>Scheduling: <strong>{scheduleItem.text}</strong> ({scheduleItem.duration}m)</span>
                <input type="time" step="300" value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="text-[11px] bg-white dark:bg-slate-700 rounded px-1 py-0.5 outline-none w-20" />
                <button onClick={handleScheduleConfirm} className="px-1.5 py-0.5 rounded bg-green-600 text-white text-[10px] hover:bg-green-500">
                  Place
                </button>
                <button onClick={() => setScheduleItem(null)} className="text-slate-400 hover:text-red-500">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
            {renderGrid()}
          </div>
        </div>
      </div>
    </div>
  );
}
