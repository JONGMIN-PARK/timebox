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

// ── Brain/Priority items (localStorage per date) ──
interface BrainItem {
  id: string;
  text: string;
  category: TimeBlockCategory;
  duration: number;
  promoted: boolean;
}

interface PriorityItem {
  id: string;
  text: string;
  category: TimeBlockCategory;
  duration: number;
  rank: number;
  scheduled: boolean;
}

function loadBrainItems(date: string): BrainItem[] {
  try { return JSON.parse(localStorage.getItem(`tb_brain_${date}`) || "[]"); } catch { return []; }
}
function saveBrainItems(date: string, items: BrainItem[]) {
  localStorage.setItem(`tb_brain_${date}`, JSON.stringify(items));
}
function loadPriorityItems(date: string): PriorityItem[] {
  try { return JSON.parse(localStorage.getItem(`tb_priority_${date}`) || "[]"); } catch { return []; }
}
function savePriorityItems(date: string, items: PriorityItem[]) {
  localStorage.setItem(`tb_priority_${date}`, JSON.stringify(items));
}

// ── Time Grid constants ──
const BLOCK_SIZE = 5;
const START_HOUR = 5;
const END_HOUR = 23;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / BLOCK_SIZE;
const ROW_HEIGHT = 22;

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return Math.floor((h * 60 + m - START_HOUR * 60) / BLOCK_SIZE);
}
function slotToTime(slot: number): string {
  const totalMin = slot * BLOCK_SIZE + START_HOUR * 60;
  return `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60).toString().padStart(2, "0")}`;
}
function slotSpan(s: string, e: string): number { return timeToSlot(e) - timeToSlot(s); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

type Panel = "brain" | "priority" | "grid";

// ── Sortable Priority Item ──
function SortablePriItem({ item, onRemove, onSchedule }: {
  item: PriorityItem; onRemove: () => void; onSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const config = CATEGORY_CONFIG[item.category];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs transition-all",
        item.scheduled
          ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 opacity-50"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",
        isDragging && "opacity-40 shadow-lg",
      )}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5">
        <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
      </button>
      <span>{config.icon}</span>
      <span className={cn("flex-1 truncate", item.scheduled && "line-through text-slate-400")}>{item.text}</span>
      <span className="text-[10px] text-slate-400 tabular-nums">{item.duration}m</span>
      {!item.scheduled && (
        <button onClick={onSchedule} className="w-6 h-6 rounded flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 sm:opacity-0 sm:group-hover:opacity-100" title="Schedule">
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onRemove} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 sm:opacity-0 sm:group-hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ElonScheduler() {
  const { blocks, selectedDate, setSelectedDate, fetchBlocks, addBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();

  const [activePanel, setActivePanel] = useState<Panel>("grid");
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

  useEffect(() => {
    if (scrollRef.current && isToday(parseISO(selectedDate))) {
      const now = new Date();
      const slot = timeToSlot(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
      scrollRef.current.scrollTop = Math.max(0, slot * ROW_HEIGHT - 150);
    }
  }, [selectedDate, activePanel]);

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

  const stats = useMemo(() => {
    let totalPlanned = 0, totalCompleted = 0;
    sortedBlocks.forEach((b) => {
      const mins = slotSpan(b.startTime, b.endTime) * BLOCK_SIZE;
      totalPlanned += mins;
      if (b.completed) totalCompleted += mins;
    });
    return { totalPlanned, totalCompleted };
  }, [sortedBlocks]);

  // ── Brain Box handlers ──
  const handleBrainAdd = () => {
    if (!brainInput.trim()) return;
    const newItems = [...brainItems, { id: uid(), text: brainInput.trim(), category: brainCategory, duration: brainDuration, promoted: false }];
    setBrainItems(newItems);
    saveBrainItems(selectedDate, newItems);
    setBrainInput("");
  };

  const handleBrainRemove = (id: string) => {
    const items = brainItems.filter((i) => i.id !== id);
    setBrainItems(items);
    saveBrainItems(selectedDate, items);
  };

  const handlePromote = (item: BrainItem) => {
    const newBrain = brainItems.map((i) => i.id === item.id ? { ...i, promoted: true } : i);
    setBrainItems(newBrain);
    saveBrainItems(selectedDate, newBrain);
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
    const items = priorityItems.filter((i) => i.id !== id);
    setPriorityItems(items);
    savePriorityItems(selectedDate, items);
  };

  const handleScheduleStart = (item: PriorityItem) => {
    setScheduleItem(item);
    setScheduleTime("09:00");
    setActivePanel("grid");
  };

  const handleScheduleConfirm = async () => {
    if (!scheduleItem) return;
    const config = CATEGORY_CONFIG[scheduleItem.category];
    const [sh, sm] = scheduleTime.split(":").map(Number);
    const endMin = sh * 60 + sm + scheduleItem.duration;
    const endTime = `${Math.floor(endMin / 60).toString().padStart(2, "0")}:${(endMin % 60).toString().padStart(2, "0")}`;
    await addBlock({ date: selectedDate, startTime: scheduleTime, endTime, title: scheduleItem.text, category: scheduleItem.category, color: config.color });
    const newPri = priorityItems.map((i) => i.id === scheduleItem.id ? { ...i, scheduled: true } : i);
    setPriorityItems(newPri);
    savePriorityItems(selectedDate, newPri);
    setScheduleItem(null);
  };

  const handleSlotClick = (slot: number) => {
    if (slotMap.has(slot)) return;
    if (scheduleItem) setScheduleTime(slotToTime(slot));
  };

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  const unpromotedBrain = brainItems.filter((i) => !i.promoted);
  const unscheduledPriority = priorityItems.filter((i) => !i.scheduled);

  // ── Render Grid ──
  const renderGrid = () => {
    const rows: JSX.Element[] = [];
    let i = 0;
    while (i < TOTAL_SLOTS) {
      const block = slotMap.get(i);
      const time = slotToTime(i);
      const isHour = (i * BLOCK_SIZE) % 60 === 0;
      const isHalf = (i * BLOCK_SIZE) % 30 === 0 && !isHour;
      const isCurr = i === currentTimeSlot;

      if (block && i === timeToSlot(block.startTime)) {
        const span = slotSpan(block.startTime, block.endTime);
        const cat = CATEGORY_CONFIG[block.category];
        const color = block.color || cat.color;
        rows.push(
          <div key={`b-${block.id}`}
            className={cn("flex group", block.completed && "opacity-50")}
            style={{ height: span * ROW_HEIGHT }}>
            <div className="w-12 flex-shrink-0 flex flex-col items-end justify-start pt-0.5 pr-2 border-r border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-mono leading-tight">{block.startTime}</span>
              <span className="text-[9px] text-slate-300 dark:text-slate-600 font-mono leading-tight">{block.endTime}</span>
            </div>
            <div className="flex-1 min-w-0 relative flex items-start px-2 py-1 border-l-[3px] overflow-hidden"
              style={{ borderLeftColor: color, backgroundColor: color + "12" }}>
              <div className="flex-1 min-w-0">
                <span className={cn("text-xs font-medium truncate block leading-tight", block.completed && "line-through text-slate-400")}>
                  {cat.icon} {block.title}
                </span>
                {span >= 3 && <span className="text-[10px] text-slate-400 block leading-tight">{cat.label} · {span * BLOCK_SIZE}m</span>}
              </div>
              <div className="flex items-center gap-0.5 sm:hidden sm:group-hover:flex absolute top-1 right-1" style={{ display: undefined }}>
                <button onClick={() => toggleCompleted(block.id)}
                  className={cn("w-6 h-6 rounded flex items-center justify-center", block.completed ? "bg-green-500 text-white" : "bg-white/90 dark:bg-slate-700/90 text-slate-500")}>
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => deleteBlock(block.id)}
                  className="w-6 h-6 rounded bg-white/90 dark:bg-slate-700/90 text-slate-400 hover:text-red-500 flex items-center justify-center">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>,
        );
        i += span; continue;
      }
      if (block) { i++; continue; }

      rows.push(
        <div key={`s-${i}`}
          className={cn(
            "flex",
            isHour ? "border-t border-slate-300 dark:border-slate-600" :
            isHalf ? "border-t border-slate-200 dark:border-slate-700/60" :
            "border-t border-slate-100 dark:border-slate-800/60",
            isCurr && "bg-red-50/80 dark:bg-red-900/10",
            !isCurr && scheduleItem && "hover:bg-green-50 dark:hover:bg-green-900/10 cursor-pointer",
            !isCurr && !scheduleItem && "hover:bg-blue-50/40 dark:hover:bg-blue-900/5 cursor-pointer",
          )}
          style={{ height: ROW_HEIGHT }}
          onClick={() => handleSlotClick(i)}>
          <div className="w-12 flex-shrink-0 flex items-center justify-end pr-2 border-r border-slate-200 dark:border-slate-700">
            {isHour && <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono">{time}</span>}
            {isHalf && <span className="text-[9px] text-slate-300 dark:text-slate-600 font-mono">{time.slice(3)}</span>}
          </div>
          <div className="flex-1">
            {isCurr && (
              <div className="h-full flex items-center px-2">
                <div className="w-2 h-2 rounded-full bg-red-500 mr-1 flex-shrink-0" />
                <div className="flex-1 h-[1.5px] bg-red-400" />
              </div>
            )}
          </div>
        </div>,
      );
      i++;
    }
    return rows;
  };

  // ── Panel tabs (visible on mobile) ──
  const panelTabs: { id: Panel; icon: typeof Brain; label: string; badge?: number }[] = [
    { id: "brain", icon: Brain, label: "Brain Box", badge: unpromotedBrain.length },
    { id: "priority", icon: ListOrdered, label: "Priority", badge: unscheduledPriority.length },
    { id: "grid", icon: Clock, label: "Time Grid" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="font-semibold text-sm text-slate-900 dark:text-white min-w-[100px] sm:min-w-[140px] text-center">
            {format(parseISO(selectedDate), "EEE, MMM d", { locale: enUS })}
          </h2>
          <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          {!isToday(parseISO(selectedDate)) && (
            <button onClick={goToday} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Today</button>
          )}
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:block tabular-nums">
          {Math.floor(stats.totalPlanned / 60)}h{stats.totalPlanned % 60 > 0 ? `${stats.totalPlanned % 60}m` : ""} planned
          {stats.totalCompleted > 0 && ` · ${Math.floor(stats.totalCompleted / 60)}h${stats.totalCompleted % 60 > 0 ? `${stats.totalCompleted % 60}m` : ""} done`}
        </span>
      </div>

      {/* Panel tabs — always visible on mobile, visible on desktop too */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {panelTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={cn(
              "flex-1 lg:flex-initial flex items-center justify-center gap-1.5 px-3 lg:px-4 py-2 text-xs font-medium transition-colors relative",
              activePanel === tab.id
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold tabular-nums px-1">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Scheduling banner */}
      {scheduleItem && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/15 border-b border-green-200 dark:border-green-800">
          <span className="text-xs text-green-700 dark:text-green-400">
            Placing: <strong>{scheduleItem.text}</strong> ({scheduleItem.duration}m)
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <input type="time" step="300" value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="text-xs bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 rounded px-2 py-1 outline-none w-24" />
            <button onClick={handleScheduleConfirm}
              className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-500">Place</button>
            <button onClick={() => setScheduleItem(null)} className="p-1 text-slate-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content area — shows 1 panel on mobile, 3 panels side-by-side on lg+ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Brain Box ── */}
        <div className={cn(
          "flex flex-col bg-white dark:bg-slate-800 overflow-hidden",
          activePanel === "brain" ? "flex-1" : "hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:border-r lg:border-slate-200 lg:dark:border-slate-700",
        )}>
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 space-y-2">
            <input
              type="text"
              value={brainInput}
              onChange={(e) => setBrainInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBrainAdd()}
              placeholder="Dump everything here..."
              className="w-full text-sm bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-400"
            />
            <div className="flex items-center gap-1.5">
              <select value={brainCategory} onChange={(e) => setBrainCategory(e.target.value as TimeBlockCategory)}
                className="flex-1 text-xs bg-slate-50 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 outline-none">
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
              <select value={brainDuration} onChange={(e) => setBrainDuration(Number(e.target.value))}
                className="w-20 text-xs bg-slate-50 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 outline-none">
                {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}m</option>)}
              </select>
              <button onClick={handleBrainAdd} disabled={!brainInput.trim()}
                className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-xs font-medium">
                Add
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {unpromotedBrain.map((item) => {
              const config = CATEGORY_CONFIG[item.category];
              return (
                <div key={item.id} className="group flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors">
                  <span className="text-sm">{config.icon}</span>
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{item.text}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{item.duration}m</span>
                  <button onClick={() => handlePromote(item)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/20 sm:opacity-0 sm:group-hover:opacity-100" title="Move to Priority">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleBrainRemove(item.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 sm:opacity-0 sm:group-hover:opacity-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {unpromotedBrain.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Dump all your tasks here first</p>
            )}
          </div>
        </div>

        {/* ── Priority ── */}
        <div className={cn(
          "flex flex-col bg-white dark:bg-slate-800 overflow-hidden",
          activePanel === "priority" ? "flex-1" : "hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:border-r lg:border-slate-200 lg:dark:border-slate-700",
        )}>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityReorder}>
              <SortableContext items={priorityItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {priorityItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-5 text-xs font-bold text-center tabular-nums flex-shrink-0",
                      idx === 0 ? "text-red-500" : idx <= 2 ? "text-amber-500" : "text-slate-400",
                    )}>
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <SortablePriItem item={item} onRemove={() => handlePriorityRemove(item.id)} onSchedule={() => handleScheduleStart(item)} />
                    </div>
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            {priorityItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                Move items from Brain Box,<br />then drag to reorder
              </p>
            )}
          </div>
        </div>

        {/* ── Time Grid ── */}
        <div className={cn(
          "flex flex-col min-w-0 bg-white dark:bg-slate-900 overflow-hidden",
          activePanel === "grid" ? "flex-1" : "hidden lg:flex lg:flex-1",
        )}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {renderGrid()}
          </div>
        </div>
      </div>
    </div>
  );
}
