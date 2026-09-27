import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import {
  loadBrainItems,
  loadTop3,
  loadMemo,
  saveBrainItems,
  saveTop3,
  saveMemo,
  fetchDayPlan,
  pushDayPlan,
  cacheDayPlanLocal,
  type BrainItem,
  type Top3Tuple,
} from './elonStorage';

/** Own cached day data, reconciliation, and debounced saves in one place. */
export function useDayPlan(date: string) {
  const [brainItems, updateBrain] = useState<BrainItem[]>(() => loadBrainItems(date));
  const [top3, updateTop3] = useState<Top3Tuple>(() => loadTop3(date));
  const [memoText, updateMemo] = useState(() => loadMemo(date));
  const brainRef = useRef(brainItems);
  const top3Ref = useRef(top3);
  const dirty = useRef(0);
  const pending = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; save: () => void }>(),
  );
  const defer = useCallback((key: string, save: () => void) => {
    const previous = pending.current.get(key);
    if (previous) clearTimeout(previous.timer);
    pending.current.set(key, {
      save,
      timer: setTimeout(() => {
        pending.current.delete(key);
        save();
      }, 300),
    });
  }, []);

  useEffect(() => {
    const cached = { brain: loadBrainItems(date), top3: loadTop3(date), memo: loadMemo(date) };
    brainRef.current = cached.brain;
    top3Ref.current = cached.top3;
    updateBrain(cached.brain);
    updateTop3(cached.top3);
    updateMemo(cached.memo);
    const version = dirty.current;
    let active = true;
    void fetchDayPlan(date).then((plan) => {
      if (!active || !plan || dirty.current !== version) return;
      if (plan.exists) {
        brainRef.current = plan.brain;
        top3Ref.current = plan.top3;
        updateBrain(plan.brain);
        updateTop3(plan.top3);
        updateMemo(plan.memo);
        cacheDayPlanLocal(date, plan);
      } else if (cached.brain.length || cached.top3.some(Boolean) || cached.memo)
        pushDayPlan(date, cached);
    });
    const saves = pending.current;
    return () => {
      active = false;
      // Flush the old date's edits before a date switch or unmount.
      for (const entry of saves.values()) {
        clearTimeout(entry.timer);
        entry.save();
      }
      saves.clear();
    };
  }, [date]);

  const setBrainItems = useCallback(
    (value: SetStateAction<BrainItem[]>) => {
      const next = typeof value === 'function' ? value(brainRef.current) : value;
      dirty.current++;
      brainRef.current = next;
      updateBrain(next);
      saveBrainItems(date, next);
    },
    [date],
  );
  const setTop3 = useCallback(
    (value: SetStateAction<Top3Tuple>) => {
      const next = typeof value === 'function' ? value(top3Ref.current) : value;
      dirty.current++;
      top3Ref.current = next;
      updateTop3(next);
      defer('top3', () => saveTop3(date, next));
    },
    [date, defer],
  );
  const setMemoText = useCallback(
    (value: string) => {
      dirty.current++;
      updateMemo(value);
      defer('memo', () => saveMemo(date, value));
    },
    [date, defer],
  );
  return { brainItems, setBrainItems, top3, setTop3, memoText, setMemoText, brainRef, top3Ref };
}
