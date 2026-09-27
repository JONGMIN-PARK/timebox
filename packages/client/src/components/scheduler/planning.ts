import type { TimeBlock } from '@timebox/shared';

export function minuteOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
type Interval = { start: number; end: number };

function mergeIntervals(intervals: Interval[]) {
  const merged: Interval[] = [];
  for (const interval of intervals.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

export function analyzeDay(blocks: TimeBlock[], start = 8 * 60, end = 22 * 60) {
  const clip = (block: TimeBlock): Interval => ({
    start: Math.max(start, minuteOfDay(block.startTime)),
    end: Math.min(end, minuteOfDay(block.endTime)),
  });
  const intervals = (items: TimeBlock[]) =>
    mergeIntervals(items.map(clip).filter((interval) => interval.end > interval.start));
  const minutes = (items: TimeBlock[]) =>
    intervals(items).reduce((sum, interval) => sum + interval.end - interval.start, 0);
  const busy = intervals(blocks);
  const free: Interval[] = [];
  let cursor = start;
  for (const interval of busy) {
    if (interval.start > cursor) free.push({ start: cursor, end: interval.start });
    cursor = interval.end;
  }
  if (cursor < end) free.push({ start: cursor, end });
  const conflicts = new Set<number>();
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (
        minuteOfDay(blocks[i].startTime) < minuteOfDay(blocks[j].endTime) &&
        minuteOfDay(blocks[j].startTime) < minuteOfDay(blocks[i].endTime)
      ) {
        conflicts.add(blocks[i].id);
        conflicts.add(blocks[j].id);
      }
    }
  }
  return {
    capacity: Math.max(0, end - start),
    planned: minutes(blocks),
    focus: minutes(blocks.filter((block) => block.category === 'deep_work')),
    completed: minutes(blocks.filter((block) => block.completed)),
    free,
    conflicts,
  };
}

export function findAvailableStart(
  blocks: TimeBlock[],
  duration: number,
  step: number,
  start = 8 * 60,
  end = 22 * 60,
) {
  if (duration <= 0 || step <= 0) return null;
  for (const gap of analyzeDay(blocks, start, end).free) {
    const candidate = Math.ceil(gap.start / step) * step;
    if (candidate + duration <= gap.end) return candidate;
  }
  return null;
}

export function displayDuration(minutes: number, locale: string) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (locale === 'ko') return hours ? `${hours}시간${rest ? ` ${rest}분` : ''}` : `${rest}분`;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

/** Keep overlapping blocks visible in separate lanes for their entire overlap group. */
export function overlapLanes(blocks: TimeBlock[]) {
  const result = new Map<number, { column: number; columns: number }>();
  const sorted = [...blocks].sort((a, b) => minuteOfDay(a.startTime) - minuteOfDay(b.startTime));
  let group: TimeBlock[] = [];
  let groupEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const placements = group.map((block) => {
      let column = ends.findIndex((end) => end <= minuteOfDay(block.startTime));
      if (column < 0) column = ends.length;
      ends[column] = minuteOfDay(block.endTime);
      return { id: block.id, column };
    });
    for (const placement of placements)
      result.set(placement.id, { column: placement.column, columns: ends.length });
    group = [];
  };
  for (const block of sorted) {
    if (minuteOfDay(block.startTime) >= groupEnd && group.length) flush();
    group.push(block);
    groupEnd = Math.max(group.length === 1 ? -1 : groupEnd, minuteOfDay(block.endTime));
  }
  flush();
  return result;
}
