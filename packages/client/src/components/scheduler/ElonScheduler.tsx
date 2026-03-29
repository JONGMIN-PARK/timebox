import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  GripVertical,
  Clock,
  ZoomIn,
  ZoomOut,
  Copy,
  Target,
  Pencil,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/useI18n";
import { usePageVisible } from "@/lib/useVisibility";
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
  type TimeBlock,
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
import { timeToMinutes } from "../calendar/calendarTypes";
import { timeblockApi } from "@/lib/apiService";
import { showToast } from "@/components/ui/Toast";
import ElonTimeCanvas from "./ElonTimeCanvas";
import ElonBlockSheet, { type BlockSheetInitial } from "./ElonBlockSheet";
import {
  type BrainItem,
  type Top3Tuple,
  type TimeBlockMeta,
  loadBrainItems,
  saveBrainItems,
  loadTop3,
  saveTop3,
  uid,
  DAY_START_MIN,
  DAY_END_MIN,
  snapToStep,
  parseTimeToMinutes,
  minutesToTime,
  parseBlockMeta,
  stringifyBlockMeta,
  compactMeta,
  PX_PER_MINUTE_BASE,
  ELON_VIEW_PREFS_KEY,
  ELON_ZOOM_MULTIPLIERS,
  loadDaySketch,
  saveDaySketch,
  type FreehandSketchStroke,
} from "./elonStorage";

function safeSave(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

/** Normalize `<input type="time">` values to HH:MM for API validation. */
function normTime(t: string): string {
  const parts = t.split(":");
  const h = Math.min(24, Math.max(0, parseInt(parts[0] || "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] || "0", 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const MIN_BLOCK_MIN = 10;

const SKETCH_PALETTE = ["#6366f1", "#e11d48", "#059669", "#d97706", "#64748b"] as const;

function nextFreeStart(blocks: TimeBlock[], durationMin: number, snapStep: number): number {
  const segs = blocks
    .map((b) => ({
      s: parseTimeToMinutes(b.startTime),
      e: Math.max(parseTimeToMinutes(b.endTime), parseTimeToMinutes(b.startTime) + MIN_BLOCK_MIN),
    }))
    .sort((a, b) => a.s - b.s);
  const snap = (m: number) => snapToStep(m, snapStep);
  for (let t = DAY_START_MIN; t <= DAY_END_MIN - Math.max(durationMin, MIN_BLOCK_MIN); t += 5) {
    const start = snap(t);
    const end = start + durationMin;
    if (end > DAY_END_MIN) continue;
    const clash = segs.some((o) => !(end <= o.s || start >= o.e));
    if (!clash) return start;
  }
  return snap(DAY_START_MIN + 10 * 60);
}

function blockToSheetInitial(b: TimeBlock): Partial<BlockSheetInitial> {
  const m = parseBlockMeta(b.meta ?? null);
  const cat = (b.category in CATEGORY_CONFIG ? b.category : "other") as TimeBlockCategory;
  return {
    blockId: b.id,
    title: b.title,
    notes: b.notes ?? "",
    startTime: b.startTime,
    endTime: b.endTime,
    category: cat,
    color: b.color ?? CATEGORY_CONFIG[cat].color,
    showArrow: m.showArrow ?? false,
    variant: m.variant ?? "solid",
    caption: m.caption ?? "",
    linkToBlockId: m.linkToBlockId ?? null,
  };
}

type SheetState = {
  mode: "add" | "edit";
  initial: Partial<BlockSheetInitial>;
  metaBase: TimeBlockMeta;
  /** Set when adding from brain dump (forces brainId in meta). */
  linkBrainId?: string;
  linkPrioritySlot?: 1 | 2 | 3;
} | null;

function SortableBrainRow({
  item,
  onRemove,
  onQuickSchedule,
  onCustomSchedule,
}: {
  item: BrainItem;
  onRemove: () => void;
  onQuickSchedule: (duration: number) => void;
  onCustomSchedule: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const config = CATEGORY_CONFIG[item.category];
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg border border-slate-100 dark:border-slate-700/80 p-1.5 space-y-1", isDragging && "opacity-50")}
    >
      <div className="flex items-start gap-1">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5 mt-0.5 shrink-0">
          <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{config.icon} {item.text}</p>
          {item.notes ? <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{item.notes}</p> : null}
        </div>
        <button type="button" onClick={onRemove} className="p-0.5 text-slate-300 hover:text-red-500 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-5">
        {[15, 30, 45, 60].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onQuickSchedule(m)}
            className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            {m}m
          </button>
        ))}
        <button
          type="button"
          onClick={onCustomSchedule}
          className="text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 text-slate-500 flex items-center gap-0.5"
        >
          <Clock className="w-2.5 h-2.5" />
          …
        </button>
      </div>
    </div>
  );
}

export default function ElonScheduler() {
  const { t } = useI18n();
  const pageVisible = usePageVisible();
  const { blocks, selectedDate, setSelectedDate, fetchBlocks, addBlock, updateBlock, deleteBlock } = useTimeBlockStore();

  const [brainItems, setBrainItems] = useState<BrainItem[]>([]);
  const [top3, setTop3] = useState<Top3Tuple>(["", "", ""]);
  const [memoText, setMemoText] = useState("");
  const [brainTitle, setBrainTitle] = useState("");
  const [brainNotes, setBrainNotes] = useState("");
  const [brainCategory, setBrainCategory] = useState<TimeBlockCategory>("deep_work");
  const [brainDuration, setBrainDuration] = useState(30);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [snapStep, setSnapStep] = useState<5 | 10 | 15 | 30>(10);
  const [focusPriority, setFocusPriority] = useState(false);
  const [copyingDay, setCopyingDay] = useState(false);
  const [sketchStrokes, setSketchStrokes] = useState<FreehandSketchStroke[]>([]);
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchColor, setSketchColor] = useState<string>(SKETCH_PALETTE[0]);
  const top3Debounce = useRef<ReturnType<typeof setTimeout>>();
  const sketchDebounce = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ELON_VIEW_PREFS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { zoomIdx?: number; snap?: number; focusPriority?: boolean };
        if (typeof j.zoomIdx === "number") {
          setZoomIdx(Math.min(ELON_ZOOM_MULTIPLIERS.length - 1, Math.max(0, j.zoomIdx)));
        }
        if (j.snap === 5 || j.snap === 10 || j.snap === 15 || j.snap === 30) {
          setSnapStep(j.snap);
        }
        if (typeof j.focusPriority === "boolean") setFocusPriority(j.focusPriority);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    safeSave(ELON_VIEW_PREFS_KEY, JSON.stringify({ zoomIdx, snap: snapStep, focusPriority }));
  }, [zoomIdx, snapStep, focusPriority]);

  const pxPerMinute = PX_PER_MINUTE_BASE * ELON_ZOOM_MULTIPLIERS[zoomIdx];

  useEffect(() => {
    void fetchBlocks(selectedDate);
    setBrainItems(loadBrainItems(selectedDate));
    setTop3(loadTop3(selectedDate));
    setSketchStrokes(loadDaySketch(selectedDate));
    setSketchMode(false);
    try {
      setMemoText(localStorage.getItem(`tb_memo_${selectedDate}`) || "");
    } catch {
      setMemoText("");
    }
  }, [selectedDate]);

  useEffect(() => {
    if (pageVisible) {
      const today = format(new Date(), "yyyy-MM-dd");
      if (selectedDate !== today) setSelectedDate(today);
    }
  }, [pageVisible, selectedDate, setSelectedDate]);

  const sortedBlocks = useMemo(
    () => [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [blocks],
  );

  const incomingLinkCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of sortedBlocks) {
      const tid = parseBlockMeta(b.meta ?? null).linkToBlockId;
      if (tid != null && tid > 0) m.set(tid, (m.get(tid) ?? 0) + 1);
    }
    return m;
  }, [sortedBlocks]);

  const stats = useMemo(() => {
    const total = sortedBlocks.length;
    const done = sortedBlocks.filter((b) => b.completed).length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, rate, brain: brainItems.length };
  }, [sortedBlocks, brainItems.length]);

  const persistTop3 = useCallback((next: Top3Tuple) => {
    setTop3(next);
    if (top3Debounce.current) clearTimeout(top3Debounce.current);
    top3Debounce.current = setTimeout(() => saveTop3(selectedDate, next), 280);
  }, [selectedDate]);

  const persistSketch = useCallback(
    (next: FreehandSketchStroke[]) => {
      setSketchStrokes(next);
      if (sketchDebounce.current) clearTimeout(sketchDebounce.current);
      sketchDebounce.current = setTimeout(() => saveDaySketch(selectedDate, next), 350);
    },
    [selectedDate],
  );

  const sketchUndo = useCallback(() => {
    if (sketchStrokes.length === 0) return;
    persistSketch(sketchStrokes.slice(0, -1));
  }, [sketchStrokes, persistSketch]);

  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  const handleBrainAdd = () => {
    if (!brainTitle.trim()) return;
    const next: BrainItem[] = [
      { id: uid(), text: brainTitle.trim(), notes: brainNotes.trim(), category: brainCategory, duration: brainDuration },
      ...brainItems,
    ];
    setBrainItems(next);
    saveBrainItems(selectedDate, next);
    setBrainTitle("");
    setBrainNotes("");
  };

  const handleBrainReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = brainItems.findIndex((i) => i.id === active.id);
    const newIdx = brainItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(brainItems, oldIdx, newIdx);
    setBrainItems(reordered);
    saveBrainItems(selectedDate, reordered);
  };

  const openSheetForBrain = (item: BrainItem, durationMin: number) => {
    const start = nextFreeStart(sortedBlocks, durationMin, snapStep);
    const end = Math.min(DAY_END_MIN, start + durationMin);
    setSheet({
      mode: "add",
      metaBase: {},
      linkBrainId: item.id,
      initial: {
        title: item.text,
        notes: item.notes,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        category: item.category,
        color: CATEGORY_CONFIG[item.category].color,
        showArrow: false,
        variant: "solid",
      },
    });
  };

  const openSheetCustomBrain = (item: BrainItem) => {
    const start = nextFreeStart(sortedBlocks, item.duration, snapStep);
    const end = Math.min(DAY_END_MIN, start + item.duration);
    setSheet({
      mode: "add",
      metaBase: {},
      linkBrainId: item.id,
      initial: {
        title: item.text,
        notes: item.notes,
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        category: item.category,
        color: CATEGORY_CONFIG[item.category].color,
        showArrow: false,
        variant: "solid",
      },
    });
  };

  const openSheetForTop3 = (slot: 1 | 2 | 3, title: string) => {
    if (!title.trim()) return;
    const start = nextFreeStart(sortedBlocks, 60, snapStep);
    const end = Math.min(DAY_END_MIN, start + 60);
    setSheet({
      mode: "add",
      metaBase: {},
      linkPrioritySlot: slot,
      initial: {
        title: title.trim(),
        notes: "",
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        category: "deep_work",
        color: CATEGORY_CONFIG.deep_work.color,
        showArrow: false,
        variant: "solid",
      },
    });
  };

  const openSheetFromGrid = (startMin: number) => {
    const end = Math.min(DAY_END_MIN, startMin + 30);
    setSheet({
      mode: "add",
      metaBase: {},
      initial: {
        title: "",
        notes: "",
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(end),
        category: "deep_work",
        color: CATEGORY_CONFIG.deep_work.color,
        showArrow: false,
        variant: "solid",
      },
    });
  };

  const openSheetEditBlock = (b: TimeBlock) => {
    setSheet({
      mode: "edit",
      initial: blockToSheetInitial(b),
      metaBase: parseBlockMeta(b.meta ?? null),
    });
  };

  const sheetOtherBlocks = useMemo(() => {
    const id = sheet?.initial.blockId;
    return sortedBlocks
      .filter((b) => b.id > 0 && b.id !== id)
      .map((b) => ({ id: b.id, title: b.title }));
  }, [sortedBlocks, sheet?.initial.blockId]);

  const handleBlockTimeCommit = useCallback(
    async (blockId: number, startTime: string, endTime: string) => {
      await updateBlock(blockId, {
        startTime: normTime(startTime),
        endTime: normTime(endTime),
      });
      void fetchBlocks(selectedDate);
    },
    [updateBlock, fetchBlocks, selectedDate],
  );

  const copyYesterdaySchedule = useCallback(async () => {
    const prev = format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd");
    setCopyingDay(true);
    try {
      const res = await timeblockApi.getAll(prev);
      if (!res.success || !res.data?.length) {
        showToast("error", t("elon.copyYesterdayEmpty"));
        return;
      }
      for (const b of res.data) {
        const meta = b.meta ? parseBlockMeta(b.meta) : {};
        delete meta.brainId;
        if (meta.annotations?.length) {
          meta.annotations = meta.annotations.map((a) => ({ ...a, id: uid() }));
        }
        await addBlock({
          date: selectedDate,
          startTime: normTime(b.startTime),
          endTime: normTime(b.endTime),
          title: b.title,
          category: b.category,
          color: b.color,
          notes: b.notes ?? null,
          meta: stringifyBlockMeta(compactMeta(meta)),
        });
      }
      showToast("success", t("elon.copyYesterdayDone"));
      void fetchBlocks(selectedDate);
    } catch {
      showToast("error", t("elon.copyYesterdayFail"));
    } finally {
      setCopyingDay(false);
    }
  }, [selectedDate, addBlock, fetchBlocks, t]);

  const handleDuplicateBlock = useCallback(async () => {
    const id = sheet?.initial.blockId;
    if (!id || id < 0) return;
    const b = sortedBlocks.find((x) => x.id === id);
    if (!b) return;
    const s = parseTimeToMinutes(b.startTime);
    const e = parseTimeToMinutes(b.endTime);
    const dur = Math.max(MIN_BLOCK_MIN, e - s);
    const ns = nextFreeStart(sortedBlocks, dur, snapStep);
    const ne = Math.min(DAY_END_MIN, ns + dur);
    const meta = { ...parseBlockMeta(b.meta ?? null) };
    delete meta.brainId;
    if (meta.annotations?.length) {
      meta.annotations = meta.annotations.map((a) => ({ ...a, id: uid() }));
    }
    await addBlock({
      date: selectedDate,
      title: `${b.title} (2)`,
      notes: b.notes ?? null,
      meta: stringifyBlockMeta(compactMeta(meta)),
      startTime: normTime(minutesToTime(ns)),
      endTime: normTime(minutesToTime(ne)),
      category: (b.category in CATEGORY_CONFIG ? b.category : "other") as TimeBlockCategory,
      color: b.color,
    });
    void fetchBlocks(selectedDate);
    showToast("success", t("elon.duplicated"));
  }, [sheet?.initial.blockId, sortedBlocks, snapStep, selectedDate, addBlock, fetchBlocks, t]);

  const handleSheetSave = async (payload: {
    blockId?: number;
    title: string;
    notes: string | null;
    startTime: string;
    endTime: string;
    category: TimeBlockCategory;
    color: string | null;
    meta: string | null;
  }) => {
    const body = {
      date: selectedDate,
      title: payload.title,
      notes: payload.notes,
      meta: payload.meta,
      startTime: normTime(payload.startTime),
      endTime: normTime(payload.endTime),
      category: payload.category,
      color: payload.color,
    };
    if (payload.blockId != null && payload.blockId > 0) {
      await updateBlock(payload.blockId, body);
    } else {
      await addBlock(body);
    }
    fetchBlocks(selectedDate);
  };

  const handleMemoChange = (val: string) => {
    setMemoText(val);
    safeSave(`tb_memo_${selectedDate}`, val);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="text-center min-w-[120px]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {format(parseISO(selectedDate), "MMM d (EEE)", { locale: enUS })}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {!isToday(parseISO(selectedDate)) && (
          <button type="button" onClick={goToday} className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
            {t("elon.today")}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 p-3 space-y-3 pb-6">
        {/* Summary — top */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("elon.summary")}</span>
          </div>
          <div className="px-3 py-2.5 grid grid-cols-4 gap-1 text-center">
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{stats.brain}</div>
              <div className="text-[9px] text-slate-400 leading-tight">{t("elon.brainShort")}</div>
            </div>
            <div>
              <div className="text-base font-bold text-blue-500 tabular-nums">{stats.total}</div>
              <div className="text-[9px] text-slate-400 leading-tight">{t("elon.scheduled")}</div>
            </div>
            <div>
              <div className="text-base font-bold text-green-500 tabular-nums">{stats.done}</div>
              <div className="text-[9px] text-slate-400 leading-tight">{t("elon.doneBlocks")}</div>
            </div>
            <div>
              <div className="text-base font-bold text-amber-500 tabular-nums">{stats.rate}%</div>
              <div className="text-[9px] text-slate-400 leading-tight">{t("elon.achievement")}</div>
            </div>
          </div>
        </div>

        {/* Top 3 priorities */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-amber-50/80 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">{t("elon.top3Title")}</span>
            <p className="text-[9px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">{t("elon.top3Hint")}</p>
          </div>
          <div className="p-2 space-y-2">
            {([1, 2, 3] as const).map((slot) => (
              <div key={slot} className="flex items-center gap-1.5">
                <span className="w-5 text-center text-[11px] font-bold text-amber-600 dark:text-amber-400">{slot}</span>
                <input
                  value={top3[slot - 1]}
                  onChange={(e) => {
                    const next = [...top3] as Top3Tuple;
                    next[slot - 1] = e.target.value;
                    persistTop3(next);
                  }}
                  placeholder={t("elon.top3Placeholder")}
                  className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={!top3[slot - 1].trim()}
                  onClick={() => openSheetForTop3(slot, top3[slot - 1])}
                  className="shrink-0 p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 disabled:opacity-30"
                  title={t("elon.schedulePriority")}
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-0.5">
          <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 w-full sm:w-auto">{t("elon.timelineTools")}</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
              disabled={zoomIdx <= 0}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
              title={t("elon.zoomOut")}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] tabular-nums w-9 text-center text-slate-500">
              {zoomIdx + 1}/{ELON_ZOOM_MULTIPLIERS.length}
            </span>
            <button
              type="button"
              onClick={() => setZoomIdx((z) => Math.min(ELON_ZOOM_MULTIPLIERS.length - 1, z + 1))}
              disabled={zoomIdx >= ELON_ZOOM_MULTIPLIERS.length - 1}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
              title={t("elon.zoomIn")}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <select
            value={snapStep}
            onChange={(e) => setSnapStep(Number(e.target.value) as 5 | 10 | 15 | 30)}
            className="text-[10px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200"
            title={t("elon.snap")}
          >
            <option value={5}>5m</option>
            <option value={10}>10m</option>
            <option value={15}>15m</option>
            <option value={30}>30m</option>
          </select>
          <button
            type="button"
            onClick={() => setFocusPriority((f) => !f)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1",
              focusPriority
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300",
            )}
          >
            <Target className="w-3 h-3" />
            {t("elon.focusTop")}
          </button>
          <button
            type="button"
            onClick={() => void copyYesterdaySchedule()}
            disabled={copyingDay}
            className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 disabled:opacity-50"
          >
            <Copy className="w-3 h-3" />
            {copyingDay ? "…" : t("elon.copyYesterday")}
          </button>
          <button
            type="button"
            onClick={() => setSketchMode((m) => !m)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1",
              sketchMode
                ? "border-violet-400 bg-violet-50 dark:bg-violet-950/35 text-violet-900 dark:text-violet-100"
                : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300",
            )}
            title={sketchMode ? t("elon.sketchArrange") : t("elon.sketchDraw")}
          >
            <Pencil className="w-3 h-3" />
            {sketchMode ? t("elon.sketchArrange") : t("elon.sketchDraw")}
          </button>
          {sketchMode && (
            <div className="flex items-center gap-1 pl-0.5">
              {SKETCH_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSketchColor(c)}
                  className={cn(
                    "w-4 h-4 rounded-full border-2 shrink-0",
                    sketchColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={sketchUndo}
            disabled={sketchStrokes.length === 0}
            className="text-[10px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 disabled:opacity-35"
            title={t("elon.sketchUndo")}
          >
            <Undo2 className="w-3 h-3" />
            {t("elon.sketchUndo")}
          </button>
        </div>

        {/* Time table + Brain dump row */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 min-w-0 order-2 md:order-1">
            <ElonTimeCanvas
              blocks={sortedBlocks}
              pxPerMinute={pxPerMinute}
              snapStep={snapStep}
              focusPriorityOnly={focusPriority}
              incomingLinkCount={incomingLinkCounts}
              onTapBackground={openSheetFromGrid}
              onTapBlock={openSheetEditBlock}
              onBlockTimeChange={handleBlockTimeCommit}
              sketchStrokes={sketchStrokes}
              onSketchStrokesChange={persistSketch}
              sketchMode={sketchMode}
              sketchColor={sketchColor}
            />
          </div>
          <div className="flex-1 min-w-0 order-1 md:order-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[min(50vh,380px)] md:max-h-[min(55vh,420px)]">
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("elon.brainDump")}</span>
              <p className="text-[9px] text-slate-400 mt-0.5">{t("elon.brainDumpHint")}</p>
            </div>
            <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700/50 space-y-1.5 shrink-0">
              <input
                type="text"
                value={brainTitle}
                onChange={(e) => setBrainTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBrainAdd()}
                placeholder={t("elon.addTaskTitle")}
                className="w-full text-[11px] bg-slate-50 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
              />
              <textarea
                value={brainNotes}
                onChange={(e) => setBrainNotes(e.target.value)}
                placeholder={t("elon.addTaskNotes")}
                rows={2}
                className="w-full text-[10px] bg-slate-50 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 placeholder-slate-400 outline-none resize-none"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={brainCategory}
                  onChange={(e) => setBrainCategory(e.target.value as TimeBlockCategory)}
                  className="text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 outline-none flex-1 min-w-[100px]"
                >
                  {(Object.keys(CATEGORY_CONFIG) as TimeBlockCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_CONFIG[k].icon} {CATEGORY_CONFIG[k].label}
                    </option>
                  ))}
                </select>
                <select
                  value={brainDuration}
                  onChange={(e) => setBrainDuration(Number(e.target.value))}
                  className="text-[10px] bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 outline-none"
                >
                  {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m}m
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBrainAdd}
                  disabled={!brainTitle.trim()}
                  className="w-8 h-8 rounded-lg bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBrainReorder}>
                <SortableContext items={brainItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  {brainItems.map((item) => (
                    <SortableBrainRow
                      key={item.id}
                      item={item}
                      onRemove={() => {
                        const next = brainItems.filter((i) => i.id !== item.id);
                        setBrainItems(next);
                        saveBrainItems(selectedDate, next);
                      }}
                      onQuickSchedule={(d) => openSheetForBrain(item, d)}
                      onCustomSchedule={() => openSheetCustomBrain(item)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {brainItems.length === 0 && <p className="text-[10px] text-slate-400 text-center py-6">{t("elon.brainEmpty")}</p>}
            </div>
          </div>
        </div>

        {/* Memo — bottom */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("elon.dayMemo")}</span>
          </div>
          <textarea
            value={memoText}
            onChange={(e) => handleMemoChange(e.target.value)}
            placeholder={t("elon.memoPlaceholder")}
            rows={4}
            className="w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 bg-transparent resize-none outline-none placeholder-slate-400 min-h-[88px]"
          />
        </div>
      </div>

      <ElonBlockSheet
        open={sheet != null}
        mode={sheet?.mode ?? "add"}
        initial={sheet?.initial ?? {}}
        metaBase={sheet?.metaBase ?? {}}
        otherBlocks={sheetOtherBlocks}
        linkBrainId={sheet?.linkBrainId}
        linkPrioritySlot={sheet?.linkPrioritySlot}
        onClose={() => setSheet(null)}
        onSave={handleSheetSave}
        onDelete={sheet?.mode === "edit" && sheet.initial.blockId ? (id) => void deleteBlock(id) : undefined}
        onDuplicate={sheet?.mode === "edit" && sheet.initial.blockId ? () => void handleDuplicateBlock() : undefined}
      />
    </div>
  );
}
