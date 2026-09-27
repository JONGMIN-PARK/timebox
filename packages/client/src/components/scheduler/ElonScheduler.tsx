import './planner.css';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { enUS, ko as koLocale } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  GripVertical,
  Target,
  ZoomIn,
  ZoomOut,
  Copy,
  Pencil,
  Undo2,
  Check,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/useI18n';
import {
  useTimeBlockStore,
  CATEGORY_CONFIG,
  type TimeBlockCategory,
  type TimeBlock,
} from '@/stores/timeblockStore';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { timeToMinutes } from '../calendar/calendarTypes';
import { timeblockApi } from '@/lib/apiService';
import { showToast } from '@/components/ui/Toast';
import FocusSession from './FocusSession';
import SchedulerOverview from './SchedulerOverview';
import PriorityPanel from './PriorityPanel';
import SortableBrainRow from './SortableBrainRow';
import { useDayPlan } from './useDayPlan';
import { analyzeDay, findAvailableStart, displayDuration } from './planning';
import { todayDate } from '@/lib/dateUtils';
import ElonTimeCanvas from './ElonTimeCanvas';
import ElonBlockSheet, { type BlockSheetInitial } from './ElonBlockSheet';
import {
  type BrainItem,
  type Top3Tuple,
  type TimeBlockMeta,
  loadBrainItems,
  saveBrainItems,
  uid,
  DAY_START_MIN,
  DAY_END_MIN,
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
} from './elonStorage';

/** An AI-proposed placement for an unscheduled task (from POST /api/ai/optimize). */
interface OptSuggestion {
  title: string;
  startTime: string;
  endTime: string;
  category?: string;
  brainId?: string;
  reason?: string;
}

function safeSave(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

/** Normalize `<input type="time">` values to HH:MM for API validation. */
function normTime(t: string): string {
  const parts = t.split(':');
  const h = Math.min(24, Math.max(0, parseInt(parts[0] || '0', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10) || 0));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MIN_BLOCK_MIN = 10;

const SKETCH_PALETTE = ['#6366f1', '#e11d48', '#059669', '#d97706', '#64748b'] as const;

/** Top 3 타임라인 블록 ↔ 브레인 덤프 연동 (meta.brainId). */
function syncBrainForPriorityBlock(
  brainItems: BrainItem[],
  meta: TimeBlockMeta,
  payload: {
    title: string;
    notes: string | null;
    category: TimeBlockCategory;
    startTime: string;
    endTime: string;
  },
): { nextBrain: BrainItem[]; meta: TimeBlockMeta } {
  const slot = meta.prioritySlot;
  if (slot !== 1 && slot !== 2 && slot !== 3) {
    return { nextBrain: brainItems, meta };
  }
  const duration = Math.max(
    MIN_BLOCK_MIN,
    parseTimeToMinutes(payload.endTime) - parseTimeToMinutes(payload.startTime),
  );
  const notes = payload.notes ?? '';
  const cat = (
    payload.category in CATEGORY_CONFIG ? payload.category : 'other'
  ) as TimeBlockCategory;

  if (meta.brainId) {
    const idx = brainItems.findIndex((i) => i.id === meta.brainId);
    if (idx >= 0) {
      const next = brainItems.map((i) =>
        i.id === meta.brainId ? { ...i, text: payload.title, notes, category: cat, duration } : i,
      );
      return { nextBrain: next, meta };
    }
    const item: BrainItem = {
      id: meta.brainId,
      text: payload.title,
      notes,
      category: cat,
      duration,
    };
    return { nextBrain: [item, ...brainItems], meta };
  }

  const brainId = uid();
  const item: BrainItem = {
    id: brainId,
    text: payload.title,
    notes,
    category: cat,
    duration,
  };
  return {
    nextBrain: [item, ...brainItems],
    meta: { ...meta, brainId },
  };
}

function blockToSheetInitial(b: TimeBlock): Partial<BlockSheetInitial> {
  const m = parseBlockMeta(b.meta ?? null);
  const cat = (b.category in CATEGORY_CONFIG ? b.category : 'other') as TimeBlockCategory;
  return {
    blockId: b.id,
    title: b.title,
    notes: b.notes ?? '',
    startTime: b.startTime,
    endTime: b.endTime,
    category: cat,
    color: b.color ?? CATEGORY_CONFIG[cat].color,
    showArrow: m.showArrow ?? false,
    variant: m.variant ?? 'solid',
    caption: m.caption ?? '',
    linkToBlockId: m.linkToBlockId ?? null,
  };
}

type SheetState = {
  mode: 'add' | 'edit';
  initial: Partial<BlockSheetInitial>;
  metaBase: TimeBlockMeta;
  /** Set when adding from brain dump (forces brainId in meta). */
  linkBrainId?: string;
  linkPrioritySlot?: 1 | 2 | 3;
} | null;

export default function ElonScheduler() {
  const { t, locale } = useI18n();
  const ko = locale === 'ko';
  const { blocks, selectedDate, setSelectedDate, fetchBlocks, addBlock, updateBlock, deleteBlock } =
    useTimeBlockStore();

  const { brainItems, setBrainItems, top3, setTop3, memoText, setMemoText, brainRef, top3Ref } =
    useDayPlan(selectedDate);
  const [planStart, setPlanStart] = useState(8 * 60);
  const [planEnd, setPlanEnd] = useState(22 * 60);
  const [brainFilter, setBrainFilter] = useState<'pending' | 'all'>('pending');
  const [placingBrain, setPlacingBrain] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'timeline' | 'planning'>('timeline');
  const [brainTitle, setBrainTitle] = useState('');
  const [brainNotes, setBrainNotes] = useState('');
  const [brainCategory, setBrainCategory] = useState<TimeBlockCategory>('deep_work');
  const [brainDuration, setBrainDuration] = useState(30);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [zoomIdx, setZoomIdx] = useState(1);
  const [snapStep, setSnapStep] = useState<5 | 10 | 15 | 30>(10);
  const [focusPriority, setFocusPriority] = useState(false);
  const [copyingDay, setCopyingDay] = useState(false);
  const [sketchStrokes, setSketchStrokes] = useState<FreehandSketchStroke[]>([]);
  const [sketchMode, setSketchMode] = useState(false);
  const [sketchColor, setSketchColor] = useState<string>(SKETCH_PALETTE[0]);
  const [editMode, setEditMode] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const applyingOptimize = useRef(false);
  const [optSuggestions, setOptSuggestions] = useState<
    (OptSuggestion & { accepted: boolean })[] | null
  >(null);
  const sketchDebounce = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ELON_VIEW_PREFS_KEY);
      if (raw) {
        const j = JSON.parse(raw) as {
          zoomIdx?: number;
          snap?: number;
          focusPriority?: boolean;
          planStart?: number;
          planEnd?: number;
        };
        if (typeof j.zoomIdx === 'number') {
          setZoomIdx(Math.min(ELON_ZOOM_MULTIPLIERS.length - 1, Math.max(0, j.zoomIdx)));
        }
        if (j.snap === 5 || j.snap === 10 || j.snap === 15 || j.snap === 30) {
          setSnapStep(j.snap);
        }
        if (typeof j.focusPriority === 'boolean') setFocusPriority(j.focusPriority);
        if (
          typeof j.planStart === 'number' &&
          typeof j.planEnd === 'number' &&
          j.planStart >= DAY_START_MIN &&
          j.planEnd <= DAY_END_MIN &&
          j.planStart < j.planEnd
        ) {
          setPlanStart(j.planStart);
          setPlanEnd(j.planEnd);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    safeSave(
      ELON_VIEW_PREFS_KEY,
      JSON.stringify({ zoomIdx, snap: snapStep, focusPriority, planStart, planEnd }),
    );
  }, [zoomIdx, snapStep, focusPriority, planStart, planEnd]);

  const pxPerMinute = PX_PER_MINUTE_BASE * ELON_ZOOM_MULTIPLIERS[zoomIdx];

  useEffect(() => {
    void fetchBlocks(selectedDate);
    setSketchStrokes(loadDaySketch(selectedDate));
    setSketchMode(false);
    setSheet(null);
    setOptSuggestions(null);
  }, [selectedDate]);

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

  const dayAnalysis = useMemo(
    () => analyzeDay(sortedBlocks, planStart, planEnd),
    [sortedBlocks, planStart, planEnd],
  );
  const nextFreeStart = (blocks: TimeBlock[], duration: number, step: number) =>
    findAvailableStart(blocks, duration, step, planStart, planEnd);
  const noSpace = () =>
    showToast(
      'info',
      ko
        ? '이 길이의 빈 시간이 없습니다. 계획 범위를 늘리거나 블록을 조정해 주세요.'
        : 'No free slot of this length. Extend your planning window or adjust a block.',
    );
  const persistTop3 = setTop3;

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

  const goToday = () => setSelectedDate(todayDate());

  const handleBrainAdd = () => {
    if (!brainTitle.trim()) return;
    const next: BrainItem[] = [
      {
        id: uid(),
        text: brainTitle.trim(),
        notes: brainNotes.trim(),
        category: brainCategory,
        duration: brainDuration,
      },
      ...brainItems,
    ];
    setBrainItems(next);

    setBrainTitle('');
    setBrainNotes('');
  };

  const handleBrainReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = brainItems.findIndex((i) => i.id === active.id);
    const newIdx = brainItems.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(brainItems, oldIdx, newIdx);
    setBrainItems(reordered);
  };

  /** A brain item maps to at most one scheduled block (found by meta.brainId). */
  const findBlockForBrain = (brainId: string) =>
    sortedBlocks.find((b) => b.id > 0 && parseBlockMeta(b.meta ?? null).brainId === brainId);

  const placementLock = useRef(false);
  const quickScheduleBrain = async (item: BrainItem, duration: number) => {
    if (placementLock.current) return;
    const existing = findBlockForBrain(item.id);
    if (existing) {
      openSheetEditBlock(existing);
      return;
    }
    const start = nextFreeStart(sortedBlocks, duration, snapStep);
    if (start === null) {
      noSpace();
      return;
    }
    placementLock.current = true;
    setPlacingBrain(item.id);
    try {
      const saved = await addBlock({
        date: selectedDate,
        title: item.text,
        notes: item.notes || null,
        startTime: minutesToTime(start),
        endTime: minutesToTime(start + duration),
        category: item.category,
        color: CATEGORY_CONFIG[item.category]?.color ?? CATEGORY_CONFIG.other.color,
        meta: stringifyBlockMeta({ brainId: item.id }),
      });
      if (saved) {
        setMobileView('timeline');
        showToast(
          'success',
          ko
            ? `${minutesToTime(start)}에 ${duration}분 배치했습니다.`
            : `Planned ${duration} minutes at ${minutesToTime(start)}.`,
        );
      }
    } finally {
      placementLock.current = false;
      setPlacingBrain(null);
    }
  };

  const openSheetCustomBrain = (item: BrainItem) => {
    // Already scheduled? Edit the existing block instead of adding a duplicate.
    const existing = findBlockForBrain(item.id);
    if (existing) {
      setSheet({
        mode: 'edit',
        metaBase: parseBlockMeta(existing.meta ?? null),
        linkBrainId: item.id,
        initial: blockToSheetInitial(existing),
      });
      return;
    }
    const start = nextFreeStart(sortedBlocks, item.duration, snapStep);
    if (start === null) {
      noSpace();
      return;
    }
    const end = Math.min(DAY_END_MIN, start + item.duration);
    setSheet({
      mode: 'add',
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
        variant: 'solid',
      },
    });
  };

  const openSheetForTop3 = (slot: 1 | 2 | 3, title: string) => {
    if (!title.trim()) return;
    const existing = sortedBlocks.find((block) => parseBlockMeta(block.meta).prioritySlot === slot);
    if (existing) {
      openSheetEditBlock(existing);
      return;
    }
    const start = nextFreeStart(sortedBlocks, 60, snapStep);
    if (start === null) {
      noSpace();
      return;
    }
    const end = Math.min(DAY_END_MIN, start + 60);
    setSheet({
      mode: 'add',
      metaBase: {},
      linkPrioritySlot: slot,
      initial: {
        title: title.trim(),
        notes: '',
        startTime: minutesToTime(start),
        endTime: minutesToTime(end),
        category: 'deep_work',
        color: CATEGORY_CONFIG.deep_work.color,
        showArrow: false,
        variant: 'solid',
      },
    });
  };

  const openSheetFromGrid = (startMin: number) => {
    const end = Math.min(DAY_END_MIN, startMin + 30);
    setSheet({
      mode: 'add',
      metaBase: {},
      initial: {
        title: '',
        notes: '',
        startTime: minutesToTime(startMin),
        endTime: minutesToTime(end),
        category: 'deep_work',
        color: CATEGORY_CONFIG.deep_work.color,
        showArrow: false,
        variant: 'solid',
      },
    });
  };

  const openSheetEditBlock = (b: TimeBlock) => {
    setSheet({
      mode: 'edit',
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
    const prev = format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
    setCopyingDay(true);
    try {
      const res = await timeblockApi.getAll(prev);
      if (!res.success || !res.data?.length) {
        showToast('error', t('elon.copyYesterdayEmpty'));
        return;
      }
      for (const b of res.data) {
        const meta = b.meta ? parseBlockMeta(b.meta) : {};
        delete meta.brainId;
        if (meta.annotations?.length) {
          meta.annotations = meta.annotations.map((a) => ({ ...a, id: uid() }));
        }
        const saved = await addBlock({
          date: selectedDate,
          startTime: normTime(b.startTime),
          endTime: normTime(b.endTime),
          title: b.title,
          category: b.category,
          color: b.color,
          notes: b.notes ?? null,
          meta: stringifyBlockMeta(compactMeta(meta)),
        });
        if (!saved) throw new Error('Block could not be copied');
      }
      showToast('success', t('elon.copyYesterdayDone'));
      void fetchBlocks(selectedDate);
    } catch {
      showToast('error', t('elon.copyYesterdayFail'));
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
    if (ns === null) {
      noSpace();
      return;
    }
    const ne = Math.min(DAY_END_MIN, ns + dur);
    const meta = { ...parseBlockMeta(b.meta ?? null) };
    delete meta.brainId;
    if (meta.annotations?.length) {
      meta.annotations = meta.annotations.map((a) => ({ ...a, id: uid() }));
    }
    const saved = await addBlock({
      date: selectedDate,
      title: `${b.title} (2)`,
      notes: b.notes ?? null,
      meta: stringifyBlockMeta(compactMeta(meta)),
      startTime: normTime(minutesToTime(ns)),
      endTime: normTime(minutesToTime(ne)),
      category: (b.category in CATEGORY_CONFIG ? b.category : 'other') as TimeBlockCategory,
      color: b.color,
    });
    if (!saved) return false;
    void fetchBlocks(selectedDate);
    showToast('success', t('elon.duplicated'));
    return true;
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
    const date = selectedDate;
    let metaForSave = parseBlockMeta(payload.meta);
    if (metaForSave.prioritySlot && !metaForSave.brainId)
      metaForSave = { ...metaForSave, brainId: uid() };
    const body = {
      date,
      title: payload.title,
      notes: payload.notes,
      meta: stringifyBlockMeta(compactMeta(metaForSave)),
      startTime: normTime(payload.startTime),
      endTime: normTime(payload.endTime),
      category: payload.category,
      color: payload.color,
    };
    const saved =
      payload.blockId != null && payload.blockId > 0
        ? await updateBlock(payload.blockId, body)
        : await addBlock(body);
    if (!saved)
      throw new Error(
        ko ? '저장에 실패했습니다. 입력은 유지됩니다.' : 'Save failed. Your input is preserved.',
      );
    if (metaForSave.prioritySlot) {
      const current = useTimeBlockStore.getState().selectedDate === date;
      const { nextBrain } = syncBrainForPriorityBlock(
        current ? brainRef.current : loadBrainItems(date),
        metaForSave,
        payload,
      );
      if (current) setBrainItems(nextBrain);
      else saveBrainItems(date, nextBrain);
    }
  };

  const handleBlockDelete = useCallback(
    async (blockId: number) => {
      const b = sortedBlocks.find((x) => x.id === blockId);
      const date = selectedDate;
      if (!(await deleteBlock(blockId))) return false;
      if (useTimeBlockStore.getState().selectedDate !== date) return;
      if (b && b.id > 0) {
        const meta = parseBlockMeta(b.meta ?? null);
        const duration = Math.max(
          MIN_BLOCK_MIN,
          parseTimeToMinutes(b.endTime) - parseTimeToMinutes(b.startTime),
        );
        const cat = (b.category in CATEGORY_CONFIG ? b.category : 'other') as TimeBlockCategory;
        if (meta.brainId) {
          const exists = brainRef.current.some((i) => i.id === meta.brainId);
          if (!exists) {
            const item: BrainItem = {
              id: meta.brainId,
              text: b.title,
              notes: b.notes ?? '',
              category: cat,
              duration,
            };
            const next = [item, ...brainRef.current];
            setBrainItems(next);
          }
        } else if (meta.prioritySlot === 1 || meta.prioritySlot === 2 || meta.prioritySlot === 3) {
          const item: BrainItem = {
            id: uid(),
            text: b.title,
            notes: b.notes ?? '',
            category: cat,
            duration,
          };
          const next = [item, ...brainRef.current];
          setBrainItems(next);
        }
        if (meta.prioritySlot === 1 || meta.prioritySlot === 2 || meta.prioritySlot === 3) {
          const idx = meta.prioritySlot - 1;
          const line = top3Ref.current[idx]?.trim();
          if (line && line === b.title.trim()) {
            const nextTop: Top3Tuple = [...top3Ref.current];
            nextTop[idx] = '';
            setTop3(nextTop);
          }
        }
      }
      setSheet(null);
      void fetchBlocks(selectedDate);
      return true;
    },
    [sortedBlocks, brainItems, top3, selectedDate, deleteBlock, fetchBlocks],
  );

  const handleMemoChange = setMemoText;

  // ── AI schedule optimization ──
  const runOptimize = useCallback(async () => {
    if (brainItems.length === 0) return;
    setOptimizing(true);
    const payload = {
      dayStart: minutesToTime(planStart),
      dayEnd: minutesToTime(planEnd),
      blocks: sortedBlocks.map((b) => ({
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        protected: parseBlockMeta(b.meta ?? null).protected === true,
        completed: b.completed,
      })),
      unscheduled: brainItems.map((i) => ({
        brainId: i.id,
        title: i.text,
        duration: i.duration,
        category: i.category,
      })),
    };
    try {
      const res = await api.post<{ suggestions: OptSuggestion[] }>('/ai/optimize', payload);
      if (useTimeBlockStore.getState().selectedDate !== selectedDate) return;
      if (res.success && res.data) {
        const list = res.data.suggestions || [];
        if (list.length === 0) {
          showToast('info', t('elon.optimizeNone'));
          return;
        }
        setOptSuggestions(list.map((s) => ({ ...s, accepted: true })));
      } else {
        showToast('error', res.status === 503 ? t('ai.unavailable') : t('elon.optimizeFailed'));
      }
    } catch {
      showToast('error', t('elon.optimizeFailed'));
    } finally {
      setOptimizing(false);
    }
  }, [brainItems, sortedBlocks, selectedDate, planStart, planEnd, t]);

  const applyOptimize = useCallback(async () => {
    if (!optSuggestions || applyingOptimize.current) return;
    const chosen = optSuggestions.filter((s) => s.accepted);
    if (chosen.length === 0) {
      setOptSuggestions(null);
      return;
    }
    applyingOptimize.current = true;
    try {
      const scheduledBrainIds = new Set<string>();
      let savedCount = 0;
      for (const s of chosen) {
        const cat = (
          s.category && s.category in CATEGORY_CONFIG ? s.category : 'other'
        ) as TimeBlockCategory;
        const metaStr = s.brainId ? stringifyBlockMeta(compactMeta({ brainId: s.brainId })) : null;
        const saved = await addBlock({
          date: selectedDate,
          title: s.title,
          notes: null,
          meta: metaStr,
          startTime: normTime(s.startTime),
          endTime: normTime(s.endTime),
          category: cat,
          color: CATEGORY_CONFIG[cat].color,
        });
        if (saved && s.brainId) scheduledBrainIds.add(s.brainId);
        if (saved) savedCount++;
        if (!saved) {
          showToast('error', t('elon.optimizeFailed'));
          break;
        }
      }
      if (scheduledBrainIds.size > 0) {
        const current = useTimeBlockStore.getState().selectedDate === selectedDate;
        const items = current ? brainRef.current : loadBrainItems(selectedDate);
        const next = items.filter((i) => !scheduledBrainIds.has(i.id));
        if (current) setBrainItems(next);
        else saveBrainItems(selectedDate, next);
      }
      setOptSuggestions(null);
      fetchBlocks(selectedDate);
      if (savedCount === chosen.length) showToast('success', t('elon.optimizeApplied'));
    } finally {
      applyingOptimize.current = false;
    }
  }, [optSuggestions, brainItems, selectedDate, addBlock, fetchBlocks, t]);

  return (
    <div className={`planner-page is-${mobileView}`}>
      <header className="planner-header">
        <div className="planner-heading">
          <span className="planner-eyebrow">
            {ko ? '하루를 설계하는 공간' : 'MAKE TIME FOR WHAT MATTERS'}
          </span>
          <h1>{ko ? '오늘의 타임박스' : 'Daily timebox'}</h1>
          <p>
            {ko
              ? '중요한 일에 집중하고, 하나씩 끝내세요.'
              : 'Plan with intention. Finish one thing at a time.'}
          </p>
        </div>
        <div className="planner-header-actions">
          <div className="planner-date-nav">
            <button
              type="button"
              className="planner-icon-button"
              aria-label={ko ? '이전 날짜' : 'Previous day'}
              onClick={() =>
                setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
              }
            >
              <ChevronLeft size={17} />
            </button>
            <label className="planner-date-label">
              <span>
                {format(parseISO(selectedDate), ko ? 'M월 d일 EEEE' : 'EEE, MMM d', {
                  locale: ko ? koLocale : enUS,
                })}
              </span>
              <input
                type="date"
                aria-label={ko ? '계획 날짜 선택' : 'Choose a date'}
                value={selectedDate}
                onChange={(event) => {
                  if (event.target.value) setSelectedDate(event.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="planner-icon-button"
              aria-label={ko ? '다음 날짜' : 'Next day'}
              onClick={() =>
                setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))
              }
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <button type="button" className="planner-secondary-button" onClick={goToday}>
            {ko ? '오늘' : 'Today'}
          </button>
          <button
            type="button"
            className="planner-primary-button"
            onClick={() => {
              const start = nextFreeStart(sortedBlocks, 30, snapStep);
              if (start === null) noSpace();
              else openSheetFromGrid(start);
            }}
          >
            <Plus size={17} />
            {ko ? '블록 추가' : 'Add block'}
          </button>
        </div>
      </header>

      <div
        className="planner-mobile-switch"
        role="tablist"
        aria-label={ko ? '하루 계획 보기' : 'Planner view'}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'timeline'}
          onClick={() => setMobileView('timeline')}
        >
          {ko ? '시간표 · 집중' : 'Timeline & focus'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === 'planning'}
          onClick={() => setMobileView('planning')}
        >
          {ko ? '할 일 · 우선순위' : 'Tasks & priorities'}
        </button>
      </div>
      <div className="planner-content">
        <SchedulerOverview
          blocks={sortedBlocks}
          start={planStart}
          end={planEnd}
          onRangeChange={(start, end) => {
            setPlanStart(start);
            setPlanEnd(end);
          }}
        />
        <div className="planner-workspace">
          <aside className="planner-workbench">
            <PriorityPanel
              priorities={top3}
              blocks={sortedBlocks}
              onChange={persistTop3}
              onSchedule={openSheetForTop3}
            />
            <div className="planner-card planner-task-panel">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <div className="planner-section-heading">
                  <span className="planner-section-icon">
                    <Check size={18} />
                  </span>
                  <div>
                    <h3>{ko ? '할 일 모아두기' : 'Task inbox'}</h3>
                    <p>
                      {ko
                        ? '시간 버튼으로 빈 곳에 바로 배치하세요.'
                        : 'Tap a duration to place a task in a free slot.'}
                    </p>
                  </div>
                </div>
                <div className="planner-task-tabs">
                  <button
                    type="button"
                    aria-pressed={brainFilter === 'pending'}
                    onClick={() => setBrainFilter('pending')}
                  >
                    {ko ? '배치 대기' : 'Unplanned'}{' '}
                    <span>
                      {
                        brainItems.filter((item) => !item.done && !findBlockForBrain(item.id))
                          .length
                      }
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={brainFilter === 'all'}
                    onClick={() => setBrainFilter('all')}
                  >
                    {ko ? '전체' : 'All'} <span>{brainItems.length}</span>
                  </button>
                </div>
              </div>
              <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-700/50 space-y-1.5 shrink-0">
                <input
                  type="text"
                  aria-label={ko ? '새 할 일' : 'New task'}
                  value={brainTitle}
                  onChange={(e) => setBrainTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBrainAdd()}
                  placeholder={t('elon.addTaskTitle')}
                  className="w-full text-[13px] bg-slate-50 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
                />
                <details className="planner-task-note">
                  <summary>{ko ? '메모 추가' : 'Add a note'}</summary>{' '}
                  <textarea
                    aria-label={ko ? '할 일 메모' : 'Task notes'}
                    value={brainNotes}
                    onChange={(e) => setBrainNotes(e.target.value)}
                    placeholder={t('elon.addTaskNotes')}
                    rows={2}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-700 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 placeholder-slate-400 outline-none resize-none"
                  />
                </details>
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label={ko ? '할 일 유형' : 'Task category'}
                    value={brainCategory}
                    onChange={(e) => setBrainCategory(e.target.value as TimeBlockCategory)}
                    className="text-xs bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 outline-none flex-1 min-w-[100px]"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as TimeBlockCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_CONFIG[k].icon} {CATEGORY_CONFIG[k].label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={ko ? '예상 소요 시간' : 'Estimated duration'}
                    value={brainDuration}
                    onChange={(e) => setBrainDuration(Number(e.target.value))}
                    className="text-xs bg-slate-50 dark:bg-slate-700 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 outline-none"
                  >
                    {[5, 10, 15, 20, 25, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m}m
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={ko ? '할 일 추가' : 'Add task'}
                    onClick={handleBrainAdd}
                    disabled={!brainTitle.trim()}
                    className="w-8 h-8 rounded-lg bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleBrainReorder}
                >
                  <SortableContext
                    items={brainItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {brainItems
                      .filter(
                        (item) =>
                          brainFilter === 'all' || (!item.done && !findBlockForBrain(item.id)),
                      )
                      .map((item) => (
                        <SortableBrainRow
                          key={item.id}
                          item={item}
                          scheduledBlock={findBlockForBrain(item.id)}
                          busy={placingBrain !== null}
                          onRemove={() => {
                            const next = brainItems.filter((i) => i.id !== item.id);
                            setBrainItems(next);
                          }}
                          onToggleDone={() => {
                            const next = brainItems.map((i) =>
                              i.id === item.id ? { ...i, done: !i.done } : i,
                            );
                            setBrainItems(next);
                          }}
                          onQuickSchedule={(duration) => void quickScheduleBrain(item, duration)}
                          onCustomSchedule={() => openSheetCustomBrain(item)}
                        />
                      ))}
                  </SortableContext>
                </DndContext>
                {brainItems.filter(
                  (item) => brainFilter === 'all' || (!item.done && !findBlockForBrain(item.id)),
                ).length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    {brainItems.length
                      ? ko
                        ? '모든 할 일이 배치되었습니다. 시간표에서 하나씩 끝내세요.'
                        : 'All tasks are planned. Finish them one at a time.'
                      : t('elon.brainEmpty')}
                  </p>
                )}
              </div>
            </div>
            {/* Memo — bottom */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('elon.dayMemo')}
                </span>
              </div>
              <textarea
                value={memoText}
                onChange={(e) => handleMemoChange(e.target.value)}
                placeholder={t('elon.memoPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 bg-transparent resize-none outline-none placeholder-slate-400 min-h-[88px]"
              />
            </div>
          </aside>
          <section className="planner-timeline-pane">
            <FocusSession
              blocks={sortedBlocks}
              date={selectedDate}
              onComplete={(id) => updateBlock(id, { completed: true })}
              onGoToDate={setSelectedDate}
            />
            <div className="planner-timeline-tools">
              <div className="planner-timeline-title">
                <Clock size={18} />
                <h3>{ko ? '시간표' : 'Your timeline'}</h3>
                <span>
                  {sortedBlocks.length}
                  {ko ? '개 블록' : ' blocks'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void runOptimize()}
                disabled={optimizing || brainItems.length === 0}
                className="planner-ai-button"
              >
                <Wand2 size={15} />
                {optimizing ? t('ai.parsing') : t('elon.optimize')}
              </button>
              <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 w-full sm:w-auto">
                {t('elon.timelineTools')}
              </span>
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
                  disabled={zoomIdx <= 0}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                  title={t('elon.zoomOut')}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[13px] tabular-nums w-9 text-center text-slate-500">
                  {zoomIdx + 1}/{ELON_ZOOM_MULTIPLIERS.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoomIdx((z) => Math.min(ELON_ZOOM_MULTIPLIERS.length - 1, z + 1))
                  }
                  disabled={zoomIdx >= ELON_ZOOM_MULTIPLIERS.length - 1}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                  title={t('elon.zoomIn')}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
              <select
                value={snapStep}
                onChange={(e) => setSnapStep(Number(e.target.value) as 5 | 10 | 15 | 30)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-200"
                title={t('elon.snap')}
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
                  'text-xs px-2 py-1 rounded-lg border flex items-center gap-1',
                  focusPriority
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                )}
              >
                <Target className="w-3 h-3" />
                {t('elon.focusTop')}
              </button>
              <button
                type="button"
                onClick={() => void copyYesterdaySchedule()}
                disabled={copyingDay}
                className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 disabled:opacity-50"
              >
                <Copy className="w-3 h-3" />
                {copyingDay ? '…' : t('elon.copyYesterday')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditMode((m) => !m);
                  setSketchMode(false);
                }}
                className={cn(
                  'text-xs px-2 py-1 rounded-lg border flex items-center gap-1',
                  editMode
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/35 text-blue-900 dark:text-blue-100'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                )}
                title={t('elon.editModeHint')}
                aria-pressed={editMode}
              >
                <GripVertical className="w-3 h-3" />
                {t('elon.editMode')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSketchMode((m) => !m);
                  setEditMode(false);
                }}
                className={cn(
                  'text-xs px-2 py-1 rounded-lg border flex items-center gap-1',
                  sketchMode
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/35 text-violet-900 dark:text-violet-100'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300',
                )}
                title={sketchMode ? t('elon.sketchArrange') : t('elon.sketchDraw')}
              >
                <Pencil className="w-3 h-3" />
                {sketchMode ? t('elon.sketchArrange') : t('elon.sketchDraw')}
              </button>
              {sketchMode && (
                <div className="flex items-center gap-1 pl-0.5">
                  {SKETCH_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSketchColor(c)}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 shrink-0',
                        sketchColor === c
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent',
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
                className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1 disabled:opacity-35"
                title={t('elon.sketchUndo')}
              >
                <Undo2 className="w-3 h-3" />
                {t('elon.sketchUndo')}
              </button>
            </div>

            <div className="planner-free-slots">
              <span>{ko ? '빈 시간' : 'Free slots'}</span>
              {dayAnalysis.free
                .filter((gap) => gap.end - gap.start >= 15)
                .slice(0, 4)
                .map((gap) => (
                  <button
                    type="button"
                    key={gap.start}
                    onClick={() => openSheetFromGrid(gap.start)}
                  >
                    {minutesToTime(gap.start)}{' '}
                    <span>{displayDuration(gap.end - gap.start, locale)}</span>
                    <Plus size={12} />
                  </button>
                ))}
              {dayAnalysis.free.length === 0 && (
                <span>{ko ? '계획 시간이 모두 채워졌습니다' : 'Your planning window is full'}</span>
              )}
            </div>
            {/* Time table */}
            <div className="planner-canvas-wrap">
              <div className="min-w-0">
                <ElonTimeCanvas
                  blocks={sortedBlocks}
                  selectedDate={selectedDate}
                  onToggleComplete={(id) => void useTimeBlockStore.getState().toggleCompleted(id)}
                  pxPerMinute={pxPerMinute}
                  snapStep={snapStep}
                  focusPriorityOnly={focusPriority}
                  incomingLinkCount={incomingLinkCounts}
                  onTapBackground={openSheetFromGrid}
                  onTapBlock={openSheetEditBlock}
                  onBlockTimeChange={handleBlockTimeCommit}
                  editMode={editMode}
                  sketchStrokes={sketchStrokes}
                  onSketchStrokesChange={persistSketch}
                  sketchMode={sketchMode}
                  sketchColor={sketchColor}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <ElonBlockSheet
        open={sheet != null}
        mode={sheet?.mode ?? 'add'}
        initial={sheet?.initial ?? {}}
        metaBase={sheet?.metaBase ?? {}}
        otherBlocks={sheetOtherBlocks}
        linkBrainId={sheet?.linkBrainId}
        linkPrioritySlot={sheet?.linkPrioritySlot}
        onClose={() => setSheet(null)}
        onSave={handleSheetSave}
        onDelete={
          sheet?.mode === 'edit' && sheet.initial.blockId
            ? (id) => handleBlockDelete(id)
            : undefined
        }
        onDuplicate={
          sheet?.mode === 'edit' && sheet.initial.blockId ? () => handleDuplicateBlock() : undefined
        }
      />

      {/* AI optimize suggestions */}
      {optSuggestions && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          onClick={() => setOptSuggestions(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl flex flex-col max-h-[85dvh] pb-[calc(var(--mobile-nav-h,56px)+env(safe-area-inset-bottom,0px))] sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-violet-500" /> {t('elon.optimizeTitle')}
              </h3>
              <button
                onClick={() => setOptSuggestions(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto">
              <p className="text-[13px] text-slate-400 px-1">{t('elon.optimizeSubtitle')}</p>
              {optSuggestions.map((s, i) => (
                <label
                  key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={s.accepted}
                    onChange={(e) =>
                      setOptSuggestions((cur) =>
                        cur
                          ? cur.map((x, j) => (j === i ? { ...x, accepted: e.target.checked } : x))
                          : cur,
                      )
                    }
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-violet-600 dark:text-violet-300 tabular-nums shrink-0">
                        {s.startTime}–{s.endTime}
                      </span>
                      <span className="text-sm text-slate-900 dark:text-white truncate">
                        {s.title}
                      </span>
                    </span>
                    {s.reason && (
                      <span className="block text-[13px] text-slate-400 mt-0.5">{s.reason}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 p-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setOptSuggestions(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={applyOptimize}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
              >
                {t('elon.optimizeApply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
