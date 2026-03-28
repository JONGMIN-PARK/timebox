import { useEffect, useState, useRef, useMemo } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Trash2, ArrowRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
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

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

const TASK_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 ~ 22:00
const TIMETABLE_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
const CATEGORIES = Object.keys(CATEGORY_CONFIG) as TimeBlockCategory[];

function timeToMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

// ── Sortable Priority Item ──
function SortableTaskItem({ item, onRemove, onToggle }: {
  item: PriorityItem; onRemove: () => void; onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const config = CATEGORY_CONFIG[item.category];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        "flex items-center gap-1 py-0.5 text-xs",
        isDragging && "opacity-40",
      )}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0">
        <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
      </button>
      <button onClick={onToggle}
        className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
          item.scheduled ? "bg-red-500 border-red-500 text-white" : "border-slate-300 dark:border-slate-600")}>
        {item.scheduled && <Check className="w-2.5 h-2.5" />}
      </button>
      <span className="text-[10px] text-slate-400 tabular-nums w-8 flex-shrink-0">{item.duration}m</span>
      <span className={cn("flex-1 truncate text-slate-700 dark:text-slate-300",
        item.scheduled && "line-through text-slate-400")}>{config.icon} {item.text}</span>
      <button onClick={onRemove}
        className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-red-500">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ElonScheduler() {
  const { t } = useI18n();
  const { blocks, selectedDate, setSelectedDate, fetchBlocks, addBlock, deleteBlock, toggleCompleted } =
    useTimeBlockStore();

  const [brainItems, setBrainItems] = useState<BrainItem[]>([]);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [memoText, setMemoText] = useState("");
  const [brainInput, setBrainInput] = useState("");
  const [brainCategory, setBrainCategory] = useState<TimeBlockCategory>("deep_work");
  const [brainDuration, setBrainDuration] = useState(30);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  useEffect(() => {
    fetchBlocks(selectedDate);
    setBrainItems(loadBrainItems(selectedDate));
    setPriorityItems(loadPriorityItems(selectedDate));
    try {
      setMemoText(localStorage.getItem(`tb_memo_${selectedDate}`) || "");
    } catch { setMemoText(""); }
  }, [selectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [blocks],
  );

  // Build timetable color map: hour -> category color
  const timetableMap = useMemo(() => {
    const map = new Map<number, string>(); // minute-slot -> color
    sortedBlocks.forEach((b) => {
      const start = timeToMinutes(b.startTime);
      const end = timeToMinutes(b.endTime);
      const color = b.color || CATEGORY_CONFIG[b.category]?.color || "#94a3b8";
      for (let m = start; m < end; m += 15) {
        map.set(m, color);
      }
    });
    return map;
  }, [sortedBlocks]);

  const stats = useMemo(() => {
    let total = 0, done = 0;
    sortedBlocks.forEach((b) => {
      const mins = timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
      total += mins;
      if (b.completed) done += mins;
    });
    return { total, done };
  }, [sortedBlocks]);

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  // ── Brain/Priority handlers ──
  const handleBrainAdd = () => {
    if (!brainInput.trim()) return;
    const item: BrainItem = { id: uid(), text: brainInput.trim(), category: brainCategory, duration: brainDuration, promoted: false };
    // Add directly to priority list
    const newPri = [...priorityItems, { id: uid(), text: item.text, category: item.category, duration: item.duration, rank: priorityItems.length, scheduled: false }];
    setPriorityItems(newPri);
    savePriorityItems(selectedDate, newPri);
    setBrainInput("");
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

  const handlePriorityToggle = (id: string) => {
    const items = priorityItems.map((i) => i.id === id ? { ...i, scheduled: !i.scheduled } : i);
    setPriorityItems(items);
    savePriorityItems(selectedDate, items);
  };

  const handleMemoChange = (val: string) => {
    setMemoText(val);
    localStorage.setItem(`tb_memo_${selectedDate}`, val);
  };

  const completedCount = priorityItems.filter((i) => i.scheduled).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      {/* ── DATE Header ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="text-center min-w-[120px]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {format(parseISO(selectedDate), "MMM d (EEE)", { locale: enUS })}
            </h2>
          </div>
          <button onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!isToday(parseISO(selectedDate)) && (
            <button onClick={goToday} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">오늘</button>
          )}
          <span className="text-[10px] text-slate-400 tabular-nums">
            {completedCount}/{priorityItems.length} done
          </span>
        </div>
      </div>

      {/* ── Main Content: single scroll ── */}
      <div className="flex-1 min-h-0 p-3 space-y-3">

        {/* ── MEMO Section ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MEMO</span>
          </div>
          <textarea
            value={memoText}
            onChange={(e) => handleMemoChange(e.target.value)}
            placeholder="오늘의 메모..."
            rows={2}
            className="w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 bg-transparent resize-none outline-none placeholder-slate-300"
          />
        </div>

        {/* ── TASK + TIMETABLE side by side ── */}
        <div className="flex gap-3">
          {/* TASK List */}
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TASK</span>
              <span className="text-[10px] text-slate-400">{completedCount}/{priorityItems.length}</span>
            </div>

            {/* Add task input */}
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-1">
              <select value={brainCategory} onChange={(e) => setBrainCategory(e.target.value as TimeBlockCategory)}
                className="text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1 py-1 text-slate-600 dark:text-slate-400 outline-none w-16">
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon}</option>)}
              </select>
              <select value={brainDuration} onChange={(e) => setBrainDuration(Number(e.target.value))}
                className="text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1 py-1 text-slate-600 dark:text-slate-400 outline-none w-14">
                {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}m</option>)}
              </select>
              <input
                type="text"
                value={brainInput}
                onChange={(e) => setBrainInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBrainAdd()}
                placeholder="할 일 추가..."
                className="flex-1 text-xs bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-300 outline-none min-w-0"
              />
              <button onClick={handleBrainAdd} disabled={!brainInput.trim()}
                className="w-5 h-5 rounded bg-blue-600 disabled:bg-slate-300 text-white flex items-center justify-center flex-shrink-0">
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Task items */}
            <div className="px-2 py-1 max-h-[280px] overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePriorityReorder}>
                <SortableContext items={priorityItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {priorityItems.map((item) => (
                    <SortableTaskItem
                      key={item.id}
                      item={item}
                      onRemove={() => handlePriorityRemove(item.id)}
                      onToggle={() => handlePriorityToggle(item.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {priorityItems.length === 0 && (
                <p className="text-[10px] text-slate-300 text-center py-4">할 일을 추가하세요</p>
              )}
            </div>
          </div>

          {/* TIMETABLE Grid */}
          <div className="w-[100px] flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TIME</span>
            </div>
            <div className="px-1 py-1 max-h-[280px] overflow-y-auto">
              {TIMETABLE_HOURS.map((hour) => {
                const slots = [0, 15, 30, 45].map((m) => {
                  const min = hour * 60 + m;
                  return timetableMap.get(min) || null;
                });
                return (
                  <div key={hour} className="flex items-center gap-px mb-px">
                    <span className="text-[8px] text-slate-400 w-5 text-right tabular-nums flex-shrink-0 mr-0.5">
                      {hour}
                    </span>
                    {slots.map((color, i) => (
                      <div
                        key={i}
                        className="flex-1 h-3 rounded-[2px]"
                        style={{
                          backgroundColor: color || (
                            document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9'
                          ),
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            {/* Category legend */}
            <div className="px-1.5 py-1 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                {CATEGORIES.slice(0, 4).map((cat) => (
                  <div key={cat} className="flex items-center gap-0.5">
                    <div className="w-2 h-2 rounded-[1px]" style={{ backgroundColor: CATEGORY_CONFIG[cat].color }} />
                    <span className="text-[7px] text-slate-400">{CATEGORY_CONFIG[cat].icon}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Time Blocks (scheduled) ── */}
        {sortedBlocks.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SCHEDULE</span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {Math.floor(stats.total / 60)}h{stats.total % 60 > 0 ? `${stats.total % 60}m` : ""}
                {stats.done > 0 && ` · ${Math.floor(stats.done / 60)}h${stats.done % 60 > 0 ? `${stats.done % 60}m` : ""} done`}
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sortedBlocks.map((block) => {
                const cat = CATEGORY_CONFIG[block.category];
                const color = block.color || cat.color;
                return (
                  <div key={block.id} className={cn("flex items-center gap-2 px-3 py-1.5 group", block.completed && "opacity-50")}>
                    <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-slate-400 tabular-nums w-16 flex-shrink-0">
                      {block.startTime}-{block.endTime}
                    </span>
                    <span className={cn("text-xs flex-1 truncate text-slate-700 dark:text-slate-300",
                      block.completed && "line-through text-slate-400")}>
                      {cat.icon} {block.title}
                    </span>
                    <button onClick={() => toggleCompleted(block.id)}
                      className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
                        block.completed ? "bg-green-500 text-white" : "border border-slate-200 dark:border-slate-600 text-slate-400")}>
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteBlock(block.id)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUMMARY ── */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">SUMMARY</span>
          </div>
          <div className="px-3 py-2 flex items-center justify-around">
            <div className="text-center">
              <div className="text-lg font-bold text-slate-900 dark:text-white">{priorityItems.length}</div>
              <div className="text-[10px] text-slate-400">할 일</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">{completedCount}</div>
              <div className="text-[10px] text-slate-400">완료</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">{sortedBlocks.length}</div>
              <div className="text-[10px] text-slate-400">스케줄</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-500">
                {priorityItems.length > 0 ? Math.round((completedCount / priorityItems.length) * 100) : 0}%
              </div>
              <div className="text-[10px] text-slate-400">달성률</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
